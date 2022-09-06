const axios = require("axios")
const fs = require("fs")
const path = require("path")
const util = require("util")
const stream = require("stream")
const pipeline = util.promisify(stream.pipeline)

async function getChannelMessages(channelId, token) {
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