const axios = require("axios")

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