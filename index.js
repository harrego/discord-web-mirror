require("dotenv").config()

const express = require("express")
const app = express()

const dbHelper = require("./src/db")
const configHelper = require("./src/config")
const discord = require("./src/discord")
const { log } = require("./src/log")

const config = configHelper.readConfig()

const db = require("better-sqlite3")("discord-web-mirror.sqlite3")
dbHelper.setup(db)

if (config.server.log) {
	const morgan = require("morgan")
	app.use(morgan("combined"))
}

app.use("/", require("./routes/app"))
app.use("/static", express.static("static"))

app.set("view engine", "ejs")
app.set("config", config)
app.set("db", db)

// start the web server if enabled

if (config.server.enabled) {
	const port = config.server.port || process.env.PORT || 3000
	app.listen(port, () => {
		log("web server", "info", `web server hosted on port ${port}`)
	})
} else {
	log("web server", "info", "web server disabled in config")
}

// archive channel messages

async function discordArchiveInterval(channelId) {
	await discord.archiveChannelMessages(db, config.discord.token, channelId)
	const min = Math.max(config.discord.approx_interval - 120, 0)
	const max = config.discord.approx_interval + 120
	const intervalSeconds = Math.floor(Math.random() * (max - min + 1)) + min
	log("discord", "info", `archiving channel ${channelId} again in ${intervalSeconds} seconds (${intervalSeconds / 60} minutes)`)
	setTimeout(() => {
		discordArchiveInterval(channelId)
	}, intervalSeconds * 1000)
}

for (const channelId of config.discord.channels) {
	discordArchiveInterval(channelId)
}