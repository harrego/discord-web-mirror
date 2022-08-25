const dbHelper = require("./src/db")
const discord = require("./src/discord")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

async function test() {
    const msgs = await discord.getChannelMessages("x", "x")
    dbHelper.insertDiscordMessages(db, msgs)
}
test()


