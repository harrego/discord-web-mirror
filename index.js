require("dotenv").config()

const dbHelper = require("./src/db")
const discord = require("./src/discord")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

if (process.env.NODE_ENV == "DEBUG") {
// 	discord.archiveChannelMessages(db, process.env.DISCORD_TOKEN, process.env.DISCORD_CHANNEL_ID)

	dbHelper.getDiscordMessages(db, "746818040590762036")

}
