require("dotenv").config()

const express = require("express")
const app = express()

const morgan = require("morgan")

const dbHelper = require("./src/db")
const discord = require("./src/discord")
const { log } = require("./src/log")

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

app.use(morgan("combined"))

app.use("/atom", require("./routes/atom"))
app.use("/", require("./routes/app"))
app.use("/static", express.static("static"))

app.set("view engine", "ejs")
app.set("db", db)

if (process.env.NODE_ENV == "DEBUG") {
	discord.archiveChannelMessages(db, process.env.DISCORD_TOKEN, process.env.DISCORD_CHANNEL_ID)



// 	var message = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1)
// 	while (message != null) {
// 		const rows = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1, message.id)
// 		message = rows.length > 0 ? rows[0] : null
// 		console.log(message)
// 	}


// 	console.log(JSON.stringify(dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 1, "1017140450915786843")))
}

const port = process.env.PORT || 3000
app.listen(port, () => {
	log("web server", "info", `hosted on port ${port}`)
})