class DiscordError extends Error {
	constructor(message = "", ...args) {
		super(message, ...args)
		this.name = "DiscordError"
	}
}
exports.DiscordError = DiscordError