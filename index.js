require("dotenv").config()

const express = require("express")
const app = express()

const dbHelper = require("./src/db")
const discord = require("./src/discord")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

app.use("/", require("./routes/app"))
app.use("/static", express.static("static"))

app.set("view engine", "ejs")
app.set("db", db)

// if (process.env.NODE_ENV == "DEBUG") {
// 	var message = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1)
// 	while (message != null) {
// 		const rows = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1, message.id)
// 		message = rows.length > 0 ? rows[0] : null
// 		console.log(message)
// 	}
// }

const port = process.env.PORT || 3000
app.listen(port, () => {
	console.log(`[discord-web-mirror] hosted on port ${port}`)
})