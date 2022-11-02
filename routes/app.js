const crypto = require("crypto")

const express = require("express")
const router = express.Router()

const sanitizeHtml = require("sanitize-html")
const marked = require("marked")
const { htmlTrimBlankLines } = require("html-trim-blank-lines")

const dbHelper = require("../src/db")


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

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

router.get("/channels", (req, res) => {
	const db = req.app.get("db")
	const config = req.app.get("config")
	
	const channels = config.discord.channels.reduce((filtered, channelId) => {
		const channel = dbHelper.getChannelMetadata(db, channelId)
		if (channel != null) {
			const guild = dbHelper.getGuildMetadata(db, channel.guildId)
			channel.guild = guild

            const recentMessageTimestamp = dbHelper.getRecentChannelMessage(db, channelId)?.timestamp
            if (recentMessageTimestamp) {
                channel.lastUpdated = recentMessageTimestamp
                const date = new Date(recentMessageTimestamp * 1000)
                var pm = date.getHours() > 12
                var hours = date.getHours() % 12
                const dateString = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${hours}:${String(date.getMinutes()).padStart(2, "0")} ${pm ? "pm" : "am"}`
                channel.humanLastUpdated = dateString
            } else {
                channel.lastUpdated = 0
                channel.humanLastUpdated = "No messages"
            }

			filtered.push(channel)
		}
		return filtered
	}, []).sort((a, b) => b.lastUpdated - a.lastUpdated)

    const channelsCount = `${channels.length} channel${channels.length == 0 || channels.length > 1 ? "s" : ""}`
	
	res.render("pages/channels_list.ejs", { channels: channels, config: config, metadata: { humanChannelsCount: channelsCount } })
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
        link: `${config.server.url}/${req.params.channel_id}/feed` 
    }

    const metadata = {
        id: channelMetadata.id,
        name: channelMetadata.name,
        guild: {
            id: guildMetadata.id,
            name: guildMetadata.name,
            icon_url_local: generateUrl(config, guildMetadata.iconUrl, "metadata")
        }
    } 

    const posts = dbHelper.getDiscordMessages(db, channelId, 50)
	posts.forEach(post => {
        const basename = config.server.url + "/static"
		post.html_content = sanitizeHtml(marked.parse(post.content))
        post.iso_timestamp = new Date(post.timestamp * 1000).toISOString()
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
	res.render("pages/atom.ejs", { server: server, metadata: metadata, posts: posts })
})

// router.get("/", (req, res) => {
// 	const db = req.app.get("db")
	
// 	const messages = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 20)
// 	res.render("pages/messages", { messages: messages })
// })

module.exports = router
