const crypto = require("crypto")

function setup(db) {
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type INT NOT NULL,
        content TEXT,
        channel_id TEXT NOT NULL,
        timestamp INT NOT NULL,
        edited_timestamp INT,
        referenced_message_id TEXT,
        contains_attachments BOOLEAN,
        contains_embeds BOOLEAN,
        FOREIGN KEY(referenced_message_id) REFERENCES messages(id)
    )`).run()

    db.prepare(`CREATE TABLE IF NOT EXISTS message_attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        size INT NOT NULL,
        url TEXT NOT NULL,
        proxy_url TEXT,
        content_type TEXT,
        FOREIGN KEY(message_id) REFERENCES messages(id)
    )`).run()

	db.prepare(`CREATE TABLE IF NOT EXISTS message_embeds (
		hash TEXT PRIMARY KEY,
		message_id TEXT,
		sort_index NUMBER NOT NULL,
		type TEXT NOT NULL,
		url TEXT,
		title TEXT,
		description TEXT,
		color INT,
		
		author_name TEXT,
		author_url TEXT,
		author_icon_url TEXT,
		author_proxy_icon_url TEXT,
		
		image_url TEXT,
		image_proxy_url TEXT,
		
		thumbnail_url TEXT,
		thumbnail_proxy_url TEXT,
		
		footer_text TEXT,
		footer_icon_url TEXT,
		footer_proxy_icon_url TEXT,
		
		FOREIGN KEY(message_id) REFERENCES messages(id)
	)`).run()
}
exports.setup = setup

function insertDiscordMessages(db, messages) {
    function epochTimestamp(dateString) {
        const date = new Date(dateString)
        return Math.floor(date.getTime() / 1000)
    }

    function insertMessage(message, referencedMessageId = null) {
        let editedTimestamp = null
        if (message.edited_timestamp != null) {
            editedTimestamp = epochTimestamp(message.edited_timestamp)
        }

		const containsAttachments = message.attachments.length > 0 ? 1 : 0
		const containsEmbeds = message.embeds.length > 0 ? 1 : 0

        db.prepare(`UPDATE messages SET content=?, edited_timestamp=?, contains_attachments=?, contains_embeds=? WHERE id=?`).run(message.content, editedTimestamp, containsAttachments, containsEmbeds, message.id)
        db.prepare(`INSERT or IGNORE INTO messages (id, type, content, channel_id, timestamp, edited_timestamp, referenced_message_id, contains_attachments, contains_embeds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(message.id, message.type, message.content, message.channel_id, epochTimestamp(message.timestamp), editedTimestamp, referencedMessageId, containsAttachments, containsEmbeds)
        
        for (const embedIndex in message.embeds) {
        	const embed = message.embeds[embedIndex]
        	
        	const hash = crypto.createHash("md5").update(`${message.id}${embedIndex}`).digest("hex")
        	db.prepare(`INSERT or IGNORE INTO message_embeds (
        		hash, message_id, sort_index, type, url, title, description, color,
        		author_name, author_url, author_icon_url, author_proxy_icon_url,
        		image_url, image_proxy_url,
        		thumbnail_url, thumbnail_proxy_url,
        		footer_text, footer_icon_url, footer_proxy_icon_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        	.run(
        		hash, message.id, embedIndex, embed.type, embed.url, embed.title, embed.description, embed.color,
        		embed.author?.name, embed.author?.url, embed.author?.icon_url, embed.author?.proxy_icon_url,
        		embed.image?.url, embed.image?.proxy_url,
        		embed.thumbnail?.url, embed.thumbnail?.proxy_url,
        		embed.footer?.text, embed.footer?.icon_url, embed.footer?.proxy_icon_url)
        }
        
        for (const attachment of message.attachments) {
        	db.prepare(`INSERT or IGNORE INTO message_attachments (id, message_id, filename, size, url, proxy_url, content_type) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        	.run(attachment.id, message.id, attachment.filename, attachment.size, attachment.url, attachment.proxy_url, attachment.content_type)
        }
    }

    const insertManyMessages = db.transaction(messages => {
        for (const message of messages) {
            insertMessage(message)
            if (message.message_reference && message.referenced_message) {
                insertMessage(message.referenced_message)
                db.prepare("UPDATE messages SET referenced_message_id=? WHERE id=?").run(message.message_reference.message_id, message.id)
            }
        }
    })
    insertManyMessages(messages)
}
exports.insertDiscordMessages = insertDiscordMessages

function collectPrefixedKeys(obj, prefix) {
	var newObj = {}
	for (const key in obj) {
		if (key.startsWith(prefix)) {
			const newKey = key.slice(prefix.length)
			if (obj[key])
				newObj[newKey] = obj[key]
			delete obj[key]
		}
	}
	return Object.keys(newObj).length <= 0 ? null : newObj
}
function trimNullValues(obj) {
	for (const key in obj) {
		if (obj[key] == null) {
			delete obj[key]
		}
	}
}

function getDiscordMessages(db, channelId, count = 50, afterMessageId = undefined) {
	const messageCount = Math.min(Math.max(count, 0), 50)
	
	let rows = []
	if (afterMessageId) {
		rows = db.prepare("SELECT * FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?").all(channelId, afterMessageId, messageCount)
	} else {
		rows = db.prepare("SELECT * FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?").all(channelId, messageCount)
	}
	
	for (row of rows) {
		// pull in attachments
		if (row.contains_attachments) {
			const attachmentRows = db.prepare("SELECT * FROM message_attachments WHERE message_id = ?").all(row.id)
			for (const attachment of attachmentRows) {
				trimNullValues(attachment)
			}
			row.attachments = attachmentRows
		}
		delete row.contains_attachments
		
		// pull in embeds
		if (row.contains_embeds) {
			const embedRows = db.prepare("SELECT * FROM message_embeds WHERE message_id = ? ORDER BY sort_index ASC").all(row.id)
			var completeEmbeds = []
			for (const embedIndex in embedRows) {
				const embed = embedRows[embedIndex]
			
				embed.author = collectPrefixedKeys(embed, "author_")
				const image = collectPrefixedKeys(embed, "image_")
				embed.images = image != null ? [ image ] : []
				embed.thumbnail = collectPrefixedKeys(embed, "thumbnail_")
				embed.footer = collectPrefixedKeys(embed, "footer_")
				
				if (embed.color) {
					const hexColor = embed.color
					embed.color = "#" + hexColor.toString(16)
				}
				
				if (embed.author || embed.thumbnail || embed.footer || embed.title || embed.description) {
					completeEmbeds.push(embed)
				} else if (image != null && completeEmbeds.length > 0) {
					completeEmbeds.at(-1).images.push(image)
					continue
				}
				
				trimNullValues(embed)
				delete embed.sort_index
			}
			row.embeds = completeEmbeds
		}
		delete row.contains_embeds
		
		trimNullValues(row)
	}
	return rows
}
exports.getDiscordMessages = getDiscordMessages