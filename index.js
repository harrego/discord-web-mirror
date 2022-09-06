require("dotenv").config()

const dbHelper = require("./src/db")
const discord = require("./src/discord")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

if (process.env.NODE_ENV == "DEBUG") {
	discord.getChannelMessages(process.env.DISCORD_CHANNEL_ID, process.env.DISCORD_TOKEN)
	.then(async msgs => {
		console.log(JSON.stringify(msgs))
		await dbHelper.insertDiscordMessages(db, msgs)
		
		const downloads = msgs.reduce((filtered, message) => {
			if (message.attachments.length > 0)
				filtered.push(...message.attachments.map(attachment => discord.saveMessageAttachment(attachment.proxy_url)))
			if (message.embeds.length > 0)
				filtered.push(...message.embeds.map(embed => discord.saveMessageAttachment(embed.thumbnail.proxy_url)))
			return filtered
		}, [])
		await Promise.all(downloads)
	})
	.catch(err => {
		if (err.response == undefined) {
			console.log(err)
		} else if (err.response.status != 200) {
			console.log(`discord error: ${err.response.data.message}`)
		} else {
			console.log(error)
		}
	})
}
