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
		thumbnail_url TEXT,
		thumbnail_proxy_url TEXT,
		FOREIGN KEY(message_id) REFERENCES messages(id)
	)`).run()
}
exports.setup = setup

async function insertDiscordMessages(db, messages) {
    function epochTimestamp(dateString) {
        const date = new Date(dateString)
        return Math.floor(date.getTime() / 1000)
    }

    function insertMessage(message, referencedMessageId = null) {
        let editedTimestamp = null
        if (message.edited_timestamp != null) {
            editedTimestamp = epochTimestamp(message.edited_timestamp)
        }

        db.prepare(`UPDATE messages SET content=?, edited_timestamp=? WHERE id=?`).run(message.content, message.edited_timestamp, message.id)
        db.prepare(`INSERT or IGNORE INTO messages (id, type, content, channel_id, timestamp, edited_timestamp, referenced_message_id, contains_attachments, contains_embeds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(message.id, message.type, message.content, message.channel_id, epochTimestamp(message.timestamp), editedTimestamp, referencedMessageId, message.attachments.length > 0 ? 1 : 0, message.embeds.length > 0 ? 1 : 0)
        
        for (const embedIndex in message.embeds) {
        	const embed = message.embeds[embedIndex]
        	const hash = crypto.createHash("md5").update(`${message.id}${embedIndex}`).digest("hex")
        	db.prepare(`INSERT or IGNORE INTO message_embeds (hash, message_id, sort_index, type, url, title, description, color, thumbnail_url, thumbnail_proxy_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        	.run(hash, message.id, embedIndex, embed.type, embed.url, embed.title, embed.description, embed.color, embed.thumbnail.url, embed.thumbnail.proxy_url)
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