const axios = require("axios")
const fs = require("fs")
const path = require("path")
const util = require("util")
const stream = require("stream")
const pipeline = util.promisify(stream.pipeline)
const dbHelper = require("./db")
const { DiscordError } = require("./error")

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
		return
	}
	
	await fs.promises.mkdir(dirPath, { recursive: true })
	
	const response = await axios.get(rawUrl, {
		responseType: "stream"
	})
	await pipeline(response.data, fs.createWriteStream(fullPath))
}
exports.saveMessageAttachment = saveMessageAttachment

async function archiveChannelMessages(db, discordToken, discordChannelId) {
	let msgs
	try {
		msgs = await getChannelMessages(discordToken, discordChannelId)
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
	
	// download each attachment from each message
	const downloads = msgs.reduce((filtered, message) => {
		if (message.attachments.length > 0)
			filtered.push(...message.attachments.map(attachment => saveMessageAttachment(attachment.proxy_url)))
		if (message.embeds.length > 0) {
				filtered.push(...message.embeds.map(embed => {
				if (embed.author?.proxy_icon_url)
					saveMessageAttachment(embed.author.proxy_icon_url)
				if (embed.image?.proxy_url)
					saveMessageAttachment(embed.image.proxy_url)
				if (embed.thumbnail?.proxy_url)
					saveMessageAttachment(embed.thumbnail.proxy_url)
			}))
		}
		return filtered
	}, [])
	await Promise.all(downloads)
}
exports.archiveChannelMessages = archiveChannelMessages
