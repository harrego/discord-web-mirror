const axios = require("axios")
const fs = require("fs")
const path = require("path")
const util = require("util")
const stream = require("stream")
const pipeline = util.promisify(stream.pipeline)
const dbHelper = require("./db")
const { DiscordError } = require("./error")
const { log } = require("./log")

async function getChannelMessages(token, channelId) {
    const response = await axios(`https://discord.com/api/v9/channels/${channelId}/messages?limit=50`, {
        headers: {
            "authorization": token,
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
        }
    })
    
    if (response.status == 200) {
        return response.data
    } else {
        throw new Error(`Discord responsed with status code ${response.status}`)
    }
}
exports.getChannelMessages = getChannelMessages

async function saveMessageAttachment(rawUrl) {
	const url = new URL(rawUrl)
	const filename = url.pathname.split("/").at(-1)
	const dirPath = path.join("static", url.pathname.split("/").slice(1, -1).join("/"))
	const fullPath = path.join(dirPath, filename)
	
	if (fs.existsSync(fullPath)) {
		// annoyingly verbose
		// log("discord dl", "info", `${rawUrl} already downloaded, skipping`)
		return
	}
	
	await fs.promises.mkdir(dirPath, { recursive: true })
	
	log("discord dl", "info", `downloading ${rawUrl} to ${fullPath}`)
	const response = await axios.get(rawUrl, {
		responseType: "stream"
	})
	await pipeline(response.data, fs.createWriteStream(fullPath))
	log("discord dl", "info", `download complete of ${rawUrl}`)
}
exports.saveMessageAttachment = saveMessageAttachment

async function archiveChannelMessages(db, discordToken, discordChannelId) {
	log("discord", "info", `archiving messages in channel ${discordChannelId}`)
	let msgs
	try {
		msgs = await getChannelMessages(discordToken, discordChannelId)
		log("discord", "info", `retrieved ${msgs.length} messages from channel ${discordChannelId}`)
	} catch (err) {
		// wrap discord api provided errors
		
		if (err instanceof axios.AxiosError && err.response?.status != 200) {
			throw new DiscordError(err.response.data.message)	
		} else {
			throw err
		}
// 		throw err
	}
	
	// save the msgs to the database
	dbHelper.insertDiscordMessages(db, msgs)
	
	log("discord", "info", `downloading attachments from channel ${discordChannelId}`)
	// download each attachment from each message
	const downloads = msgs.reduce((filtered, message) => {
		if (message.attachments.length > 0)
			filtered.push(...message.attachments.map(attachment => saveMessageAttachment(attachment.proxy_url)))
		if (message.embeds.length > 0) {
			filtered.push(...message.embeds.map(embed => {
				if (embed.author?.proxy_icon_url)
					filtered.push(saveMessageAttachment(embed.author.proxy_icon_url))
				if (embed.image?.proxy_url)
					filtered.push(saveMessageAttachment(embed.image.proxy_url))
				if (embed.thumbnail?.proxy_url)
					filtered.push(saveMessageAttachment(embed.thumbnail.proxy_url))
			}))
		}
		return filtered
	}, [])
	try {
		await Promise.all(downloads)
	} catch (err) {
		log("discord dl", "warn", `downloaded failed - ${err.response.status} ${err.config.method} ${err.config.url}`)
	}
	
	log("discord", "info", `downloaded all attachments from channel ${discordChannelId}`)
}
exports.archiveChannelMessages = archiveChannelMessages
