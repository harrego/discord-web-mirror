const { parse, stringify } = require("yaml")
const path = require("path")
const fs = require("fs")
const { log } = require("./log")

function exit(msg) {
    log("error", "config", msg)
    process.exit(1)
}

function readConfig() {
    const configPath = path.join(__dirname, "..", "config.yaml")
    const data = fs.readFileSync(configPath, "utf8")
    const config = parse(data)

    if (!config) { exit("invalid config, must be valid yaml") }

    if (!config.discord) { config.discord = {} }
    if (!config.discord?.token) { exit("missing discord token") }
    if (!config.discord?.channels) { exit("missing discord channels") }
    if (!config.discord?.approx_interval) { config.discord.approx_interval = 600 }

    if (!config.server) { config.server = {} }
    if (!config.server.url) { exit("missing server url") }
    if (config.server.log == undefined) { config.server.log = false }
    if (config.server.enabled == undefined) { config.server.enabled = true }

    return config
}
exports.readConfig = readConfig