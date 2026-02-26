import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import WebTorrent from 'webtorrent'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 3014

// Track active conversions to avoid duplicate DHT lookups
const activeJobs = new Map()

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ico': 'image/x-icon'
}

function serveStatic(req, res) {
    const safePath = req.url === '/' ? '/index.html' : req.url
    const filePath = path.join(__dirname, 'public', safePath)
    const ext = path.extname(filePath)
    const contentType = MIME_TYPES[ext] || 'text/plain'

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404)
            res.end('Not found')
            return
        }
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(data)
    })
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => {
            body += chunk.toString()
        })
        req.on('end', () => {
            try {
                resolve(JSON.parse(body))
            } catch {
                reject(new Error('Invalid JSON'))
            }
        })
        req.on('error', reject)
    })
}

function jsonResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
}

async function convertMagnet(magnetURI) {
    return new Promise((resolve, reject) => {
        const client = new WebTorrent()
        const timeout = setTimeout(() => {
            client.destroy()
            reject(new Error('Timeout: no se pudo obtener metadata del torrent. Intenta con otro magnet link.'))
        }, 60000)

        client.add(magnetURI, { store: false }, torrent => {
            clearTimeout(timeout)

            // torrent.torrentFile is already the ready-to-serve .torrent Buffer
            const buffer = Buffer.from(torrent.torrentFile)
            const name = torrent.name || 'torrent'

            torrent.destroy(() => client.destroy())
            resolve({ buffer, name })
        })

        client.on('error', err => {
            clearTimeout(timeout)
            client.destroy()
            reject(err)
        })
    })
}

const server = http.createServer(async (req, res) => {
    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
    }

    // API: convert magnet to torrent
    if (req.method === 'POST' && req.url === '/api/convert') {
        let body
        try {
            body = await parseBody(req)
        } catch {
            return jsonResponse(res, 400, { error: 'Body inválido' })
        }

        const { magnet } = body
        if (!magnet || !magnet.startsWith('magnet:')) {
            return jsonResponse(res, 400, { error: 'Magnet link inválido. Debe comenzar con "magnet:"' })
        }

        // Deduplicate: if same magnet is already being processed, queue response
        if (activeJobs.has(magnet)) {
            try {
                const result = await activeJobs.get(magnet)
                res.writeHead(200, {
                    'Content-Type': 'application/x-bittorrent',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(result.name)}.torrent"`,
                    'Content-Length': result.buffer.length
                })
                res.end(result.buffer)
            } catch (err) {
                jsonResponse(res, 500, { error: err.message })
            }
            return
        }

        const job = convertMagnet(magnet)
        activeJobs.set(magnet, job)

        try {
            const result = await job
            activeJobs.delete(magnet)
            res.writeHead(200, {
                'Content-Type': 'application/x-bittorrent',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(result.name)}.torrent"`,
                'Content-Length': result.buffer.length
            })
            res.end(result.buffer)
        } catch (err) {
            activeJobs.delete(magnet)
            console.error('[convert error]', err.message)
            jsonResponse(res, 500, { error: err.message })
        }
        return
    }

    // Serve static files
    serveStatic(req, res)
})

server.listen(PORT, () => {
    console.log(`Torrent Converter corriendo en http://localhost:${PORT}`)
})
