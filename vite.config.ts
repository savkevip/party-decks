import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'
import { readPlaylist } from './playlist'

type GuestRequest = { id: number; videoId: string; by: string }

// Guests' phones send songs here, the host page picks them up. Lives in memory while the server runs.
function guestRequests(): Plugin {
  const boot = Date.now().toString(36)
  const items: GuestRequest[] = []
  let seq = 0

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.startsWith('/api/playlist')) return playlist(req.url, res)
    if (!req.url?.startsWith('/api/requests')) return next()
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        try {
          const { videoId, by } = JSON.parse(body)
          if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId)) throw new Error('bad id')
          items.push({ id: ++seq, videoId, by: String(by ?? '').trim().slice(0, 30) })
          if (items.length > 500) items.shift()
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false }))
        }
      })
      return
    }

    const after = Number(new URL(req.url, 'http://local').searchParams.get('after') ?? 0)
    res.end(JSON.stringify({ boot, items: items.filter((i) => i.id > after) }))
  }

  return {
    name: 'guest-requests',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

async function playlist(url: string, res: Parameters<Connect.NextHandleFunction>[1]) {
  res.setHeader('Content-Type', 'application/json')
  const list = new URL(url, 'http://local').searchParams.get('list') ?? ''
  try {
    if (!/^[\w-]+$/.test(list)) throw new Error('bad list id')
    res.end(JSON.stringify({ songs: await readPlaylist(list) }))
  } catch {
    res.statusCode = 404
    res.end(JSON.stringify({ songs: [] }))
  }
}

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

export default defineConfig({
  plugins: [react(), guestRequests()],
  server: { host: true, port: 5199 },
  preview: { host: true, port: 5199 },
  define: { __LAN_IP__: JSON.stringify(lanAddress()) },
})
