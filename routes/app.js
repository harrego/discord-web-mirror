const crypto = require("crypto")

const express = require("express")
const router = express.Router()

const sanitizeHtml = require("sanitize-html")
const marked = require("marked")

const dbHelper = require("../src/db")

function generateUrl(config, url, type) {
    console.log(`generate url, "${url}", "${type}"`)
    const urlHash = crypto.createHash("md5").update(url).digest("hex")
    const urlObj = new URL(url)
    console.log(config)
    return config.server.url + `/static/${type}/${urlHash}/` + urlObj.pathname.split("/").at(-1)
}

router.get("/:channel_id/feed", (req, res) => {
    const db = req.app.get("db")
    const config = req.app.get("config")

    const channelId = req.params.channel_id
    if (!config.discord.channels.includes(channelId)) {
        res.sendStatus(404)
        return
    }

    const posts = dbHelper.getDiscordMessages(db, channelId, 50)
	posts.forEach(post => {
        const basename = config.server.url + "/static"
		post.html_content = sanitizeHtml(marked.parse(post.content))
        post.iso_timestamp = new Date(post.timestamp * 1000).toISOString()
        post.attachments?.forEach(postAttachment => {
            postAttachment.proxy_url_local = generateUrl(config, postAttachment.proxy_url, "attachments") 
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
	res.render("pages/atom.ejs", { posts: posts })
})

// router.get("/", (req, res) => {
// 	const db = req.app.get("db")
	
// 	const messages = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 20)
// 	res.render("pages/messages", { messages: messages })
// })

module.exports = router
