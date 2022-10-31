function log(type, subsystem, msg) {
    if (process.env.SILENCE == "1") {
        return
    }
    if (process.env.WARN_ONLY == "1" && type != "warn") {
        return
    }
    const dateString = (new Date()).toISOString()
    console.log(`[${dateString}][${type}][${subsystem}] ${msg}`)
}
exports.log = log