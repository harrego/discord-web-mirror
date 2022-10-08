# discord-web-mirror

Create RSS mirrors of Discord channels, complete with embed and attachment support.

## Why?

`discord-web-mirror` was intended to mirror news-based Discord channels, a lot of community news is crowd-sourced and published in Discord channels.

## Setup

### Requirements
- Node.js v14.0+
- Full-time server
- Discord private token
  1. Discord doesn't like when you do this, so accept that this might result in an account ban.
  2. Open Discord in your browser.
  3. Open your browser's web tools and look in the *Network* tab.
  4. Find a request to the Discord API (try typing in the message box to trigger `typing`) and look at the request headers.
  5. Copy the token under the *Authorization* header.

### Guide
1. Install NPM dependencies with `npm install`.
2. Rename `config.yaml.example` to `config.yaml` and enter your Discord and web server info in the file.
3. Run the server with `node index.js`.

## How?

`discord-web-mirror` works by making interval requests to the private Discord API to pull recent messages from a channel and then saving those messages in a database. These archived messages are then formatted into an RSS feed at request.

### Infrastructure

1. Interval GET requests to the Discord API (`/api/v9/channels/${channelId}/messages`)
2. Saves all message data to the SQLite database
3. Saves all attachments and embed images to `static/`
4. Express.js serves the messages from the SQLite database in an RSS feed, alongside static hosting for the attachments (`/static`).

### Privacy

No author data is saved, not even randomized identifiers are attached to messages, it is impossible to determine who wrote a message from the message database.