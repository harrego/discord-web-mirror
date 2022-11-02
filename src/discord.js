const axios = require("axios")
const fs = require("fs")
const path = require("path")
const util = require("util")
const stream = require("stream")
const pipeline = util.promisify(stream.pipeline)
const dbHelper = require("./db")
const { DiscordError } = require("./error")
const { log } = require("./log")
const crypto = require("crypto")

// should return the server name and url to guild picture
async function getGuildMetadata(token, guildId) {
    const response = await axios(`https://discord.com/api/v9/guilds/${guildId}`, {
        headers: {
            "authorization": token,
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
        }
    })
    if (response.status != 200) {
        throw new Error(`Discord responded with status code ${response.status}`)
    }
    const guildIcon = `https://cdn.discordapp.com/icons/${guildId}/${response.data.icon}.jpeg`
    return {
        id: response.data.id,
        name: response.data.name,
        iconUrl: guildIcon
    }
}
exports.getGuildMetadata = getGuildMetadata

async function getChannelMetadata(token, channelId) {
    const response = await axios(`https://discord.com/api/v9/channels/${channelId}`, {
        headers: {
            "authorization": token,
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
        }
    })
    if (response.status != 200) {
        throw new Error(`Discord responded with status code ${response.status}`)
    }
    return {
        id: response.data.id,
        name: response.data.name,
        guildId: response.data.guild_id
    }
}
exports.getChannelMetadata = getChannelMetadata

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
        throw new Error(`Discord responded with status code ${response.status}`)
    }
}
exports.getChannelMessages = getChannelMessages

async function saveMessageAttachment(rawUrl, type = "attachments", override = false) {
	const url = new URL(rawUrl)
    const urlHash = crypto.createHash("md5").update(rawUrl).digest("hex")
	const filename = url.pathname.split("/").at(-1)
    const dirPath = path.join("static", type, urlHash)
	const fullPath = path.join(dirPath, filename)
	
	if (override == false && fs.existsSync(fullPath)) {
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
	/*
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
	*/
	
	try {
		for (const msg of msgs) {
			if (msg.attachments.length > 0) {
				for (const attachment of msg.attachments) {
					var url = attachment.proxy_url

					const sourceUrl = new URL(attachment.url)
					// fixing a bug where the proxied version of some cdn attachments fail to GET
					if (sourceUrl.hostname == "cdn.discordapp.com") {
						url = attachment.url
					}

					await saveMessageAttachment(url, "attachments")
				}
			}
			if ((msg.embeds?.length || 0) > 0) {
				for (const embed of msg.embeds) {
					if (embed.author?.proxy_icon_url)
						await saveMessageAttachment(embed.author.proxy_icon_url, "external")
					if (embed.image?.proxy_url)
						await saveMessageAttachment(embed.image.proxy_url, "external")
					if (embed.thumbnail?.proxy_url)
						await saveMessageAttachment(embed.thumbnail.proxy_url, "external")
				}
			}
		}
	} catch (err) {
		console.log(err)
	}
	
	
	
// 	try {
// 		await Promise.all(downloads)
// 	} catch (err) {
// 		if (err.response) {
// 			log("discord dl", "warn", `download failed - ${err.response.status}`)
// 		}
// 		log("discord dl", "warn", `downloaded failed`)
// 	}
	
	log("discord", "info", `downloaded all attachments from channel ${discordChannelId}`)
}
exports.archiveChannelMessages = archiveChannelMessages
