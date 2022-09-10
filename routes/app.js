const express = require("express")
const router = express.Router()

const dbHelper = require("../src/db")

router.get("/", (req, res) => {
	const db = req.app.get("db")
	
	const messages = dbHelper.getDiscordMessages(db, process.env.DISCORD_CHANNEL_ID, 20)
	res.render("pages/messages", { messages: messages })
})

module.exports = router