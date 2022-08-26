require("dotenv").config()

const dbHelper = require("./src/db")
const discord = require("./src/discord")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

if (process.env.NODE_ENV == "DEBUG") {
    async function test() {
        const msgs = await discord.getChannelMessages(process.env.DISCORD_CHANNEL_ID, process.env.DISCORD_TOKEN)
        dbHelper.insertDiscordMessages(db, msgs)
    }
    test()
}
