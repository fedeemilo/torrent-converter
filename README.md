# Magnet → Torrent Converter

A lightweight web app that converts magnet links into downloadable `.torrent` files by fetching metadata directly from the BitTorrent DHT network.

## How it works

1. Paste a magnet link into the web UI
2. The server connects to the DHT network via [WebTorrent](https://webtorrent.io/) to resolve the torrent metadata
3. The `.torrent` file is generated and downloaded automatically to your browser

Duplicate requests for the same magnet link are deduplicated server-side — only one DHT lookup runs at a time per unique link.

## Stack

- **Runtime:** Node.js 20 (ESM)
- **Server:** Vanilla `node:http` — no framework
- **Torrent:** [WebTorrent](https://github.com/webtorrent/webtorrent)
- **Frontend:** Single static HTML file (`public/index.html`)
- **Container:** Docker multi-stage build on `node:20-alpine`

## Requirements

- Node.js 20+
- npm

## Running locally

```bash
npm install
npm start
```

Open [http://localhost:3014](http://localhost:3014) in your browser.

## Running with Docker

```bash
docker compose up -d
```

The app will be available at [http://localhost:3014](http://localhost:3014).

To stop it:

```bash
docker compose down
```

## API

### `POST /api/convert`

Converts a magnet link to a `.torrent` file.

**Request body**

```json
{ "magnet": "magnet:?xt=urn:btih:..." }
```

**Success response**

Returns the `.torrent` file as `application/x-bittorrent` with a `Content-Disposition: attachment` header containing the torrent name.

**Error responses**

| Status | Reason |
|--------|--------|
| `400` | Missing or invalid magnet link |
| `500` | DHT lookup failed or timed out (60 s limit) |

## Project structure

```
torrent-converter/
├── server.js          # HTTP server + conversion logic
├── public/
│   └── index.html     # Frontend UI
├── Dockerfile         # Multi-stage build
├── docker-compose.yml
└── package.json
```
