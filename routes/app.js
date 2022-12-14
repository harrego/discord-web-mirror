const crypto = require("crypto")

const express = require("express")
const router = express.Router()

const sanitizeHtml = require("sanitize-html")
const marked = require("marked")
const { htmlTrimBlankLines } = require("html-trim-blank-lines")

const dbHelper = require("../src/db")

function customDateFormatGMT(date) {
    const gmtDate = new Date(date.toLocaleString("en-US", { timeZone: "GMT" }))
    var pm = gmtDate.getHours() > 12
    var hours = gmtDate.getHours() % 12
    return `${months[gmtDate.getMonth()]} ${gmtDate.getDate()}, ${gmtDate.getFullYear()} at ${hours}:${String(gmtDate.getMinutes()).padStart(2, "0")} ${pm ? "pm" : "am"} GMT`
}

function generateUrl(config, url, type) {
    const urlHash = crypto.createHash("md5").update(url).digest("hex")
    const urlObj = new URL(url)
    return config.server.url + `/static/${type}/${urlHash}/` + urlObj.pathname.split("/").at(-1)
}

// wrapper for html trim blank lines
router.use((req, res, next) => {
	function process(callback) {
		return function(err, html) {
			res.send(htmlTrimBlankLines(html))
		}
	}

	res.oldRender = res.render
	res.render = function(view, options, callback) {
		res.oldRender(view, options, process(callback))
	}

	return next()
})

// const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const months = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"]

router.get("/channels", (req, res) => {
	const db = req.app.get("db")
	const config = req.app.get("config")
	
	const channels = config.discord.channels.reduce((filtered, channelId) => {
		const channel = dbHelper.getChannelMetadata(db, channelId)
		if (channel != null) {
			const guild = dbHelper.getGuildMetadata(db, channel.guildId)
			channel.guild = guild

            const recentMessage = dbHelper.getRecentChannelMessage(db, channelId)
            const recentMessageTimestamp = recentMessage?.editedTimestamp || recentMessage?.timestamp
            if (recentMessageTimestamp) {
                channel.lastUpdated = recentMessageTimestamp
                const dateString = customDateFormatGMT(new Date(recentMessageTimestamp * 1000))
                channel.humanLastUpdated = dateString
            } else {
                channel.lastUpdated = 0
                channel.humanLastUpdated = "No messages"
            }

			filtered.push(channel)
		}
		return filtered
	}, []).sort((a, b) => b.lastUpdated - a.lastUpdated)

    const channelsLastUpdated = channels.map(channel => {
        return { id: channel.id, lastUpdated: channel.lastUpdated }
    })

    const channelsCount = `${channels.length} channel${channels.length == 0 || channels.length > 1 ? "s" : ""}`
   
    const metadata = {
        app: config.app,
        humanChannelsCount: channelsCount,
        channelsLastUpdated: channelsLastUpdated
    }
	
	res.render("pages/channels_list.ejs", { channels: channels, config: config, metadata: metadata })
})

function fetchChannelPosts(db, config, channelId, postLimit) {
    const posts = dbHelper.getDiscordMessages(db, channelId, postLimit)
	posts.forEach(post => {
        const basename = config.server.url + "/static"
		post.html_content = sanitizeHtml(marked.parse(post.content))
        post.iso_timestamp = new Date(post.timestamp * 1000).toISOString()
        post.human_timestamp = customDateFormatGMT(new Date(post.timestamp * 1000))
        post.edited = post.editedTimestamp != null
        post.attachments?.forEach(postAttachment => {
            var url = postAttachment.proxy_url
            const sourceUrl = new URL(postAttachment.url)
            // fixing a bug where the proxied version of some cdn attachments fail to GET
            if (sourceUrl.hostname == "cdn.discordapp.com") {
                url = postAttachment.url
            }
            postAttachment.resolved_url_local = generateUrl(config, url, "attachments")
        })
        post.embeds?.forEach(embed => {
            if (embed.description) {
                embed.html_description = sanitizeHtml(marked.parse(embed.description))
            }
            embed.images?.forEach(embedImage => {
                embedImage.proxy_url_local = generateUrl(config, embedImage.proxy_url, "external")
            })

            if (embed.thumbnail) {
                embed.thumbnail.proxy_url_local = generateUrl(config, embed.thumbnail.proxy_url, "external")
            }
        })
	})
    return posts
}

router.get("/channels/:channel_id", (req, res) => {
    const db = req.app.get("db")
    const config = req.app.get("config")

    const channelId = req.params.channel_id
    if (!config.discord.channels.includes(channelId)) {
        res.sendStatus(404)
        return
    }

    let channelMetadata
    try {
        channelMetadata = dbHelper.getChannelMetadata(db, channelId)
    } catch (e) {
        console.log(e)
        res.sendStatus(404)
        return
    }
    
    let guildMetadata
    try {
        guildMetadata = dbHelper.getGuildMetadata(db, channelMetadata.guildId)
    } catch (e) {
        console.log(e)
        res.sendStatus(404)
        return
    }

    const posts = fetchChannelPosts(db, config, channelId, 50)

    const metadata = {
        id: channelMetadata.id,
        name: channelMetadata.name,
        guild: {
            id: guildMetadata.id,
            name: guildMetadata.name,
            icon_url_local: generateUrl(config, guildMetadata.iconUrl, "metadata")
        }
    } 

    res.render("pages/channel.ejs", { posts: posts, metadata: metadata, config: config })
})

router.get("/channels/:channel_id/feed", (req, res) => {
    const db = req.app.get("db")
    const config = req.app.get("config")

    const channelId = req.params.channel_id
    if (!config.discord.channels.includes(channelId)) {
        res.sendStatus(404)
        return
    }

    let channelMetadata
    try {
        channelMetadata = dbHelper.getChannelMetadata(db, channelId)
    } catch (e) {
        console.log(e)
        res.sendStatus(404)
        return
    }
    
    let guildMetadata
    try {
        guildMetadata = dbHelper.getGuildMetadata(db, channelMetadata.guildId)
    } catch (e) {
        console.log(e)
        res.sendStatus(404)
        return
    }

    const server = {
        link: `${config.server.url}/${channelId}/feed` 
    }

    const recentMessage = dbHelper.getRecentChannelMessage(db, channelId)
    const recentMessageTimestamp = recentMessage?.editedTimestamp || recentMessage?.timestamp
    const lastUpdated = recentMessageTimestamp != null ? new Date(parseInt(recentMessageTimestamp) * 1000) : new Date()

    const posts = fetchChannelPosts(db, config, channelId, 50)

    const metadata = {
        id: channelMetadata.id,
        name: channelMetadata.name,
        last_updated_iso: lastUpdated.toISOString(),
        guild: {
            id: guildMetadata.id,
            name: guildMetadata.name,
            icon_url_local: generateUrl(config, guildMetadata.iconUrl, "metadata")
        }
    } 

    res.setHeader("Content-Type", "text/xml; charset=utf-8")
	res.render("pages/atom.ejs", { server: server, metadata: metadata, posts: posts })
})

router.get("/", (req, res) => {
    const config = req.app.get("config")
	res.redirect(`${config.server.url}/channels`)
})

module.exports = router
