require("dotenv").config()

const dbHelper = require("./src/db")
const discord = require("./src/discord")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

if (process.env.NODE_ENV == "DEBUG") {
	var message = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1)
	while (message != null) {
		const rows = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1, message.id)
		message = rows.length > 0 ? rows[0] : null
		console.log(message)
	}
}
