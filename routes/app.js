const express = require("express")
const router = express.Router()

const sanitizeHtml = require("sanitize-html")
const marked = require("marked")

const dbHelper = require("../src/db")

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
		post.html_content = sanitizeHtml(marked.parse(post.content))
        post.iso_timestamp = new Date(post.timestamp * 1000).toISOString()
        post.attachments?.forEach(postAttachment => {
            const attachmentUrl = new URL(postAttachment.proxy_url)
            postAttachment.proxy_url_local = "http://localhost:3000/static" + attachmentUrl.pathname
        })
        post.embeds?.forEach(embed => {
            if (embed.description) {
                embed.html_description = sanitizeHtml(marked.parse(embed.description))
            }
            embed.images?.forEach(embedImage => {
                const imageUrl = new URL(embedImage.proxy_url)
                embedImage.proxy_url_local = "http://localhost:3000/static" + imageUrl.pathname
            })

            if (embed.thumbnail) {
                const thumbnailUrl = new URL(embed.thumbnail.proxy_url)
                embed.thumbnail.proxy_url_local = "http://localhost:3000/static" + thumbnailUrl.pathname
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