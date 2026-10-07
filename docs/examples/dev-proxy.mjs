// Read-only dev proxy used to capture the screenshots in docs/media.
//
//   /api/backend/*  ->  the public deployment (GET only, everything else gets 405)
//   everything else ->  a local build of the web app on 127.0.0.1:3000
//
// It mirrors what the production reverse proxy does (the app calls /api/backend on its own origin),
// so the app can be built with its default NEXT_PUBLIC_API_URL and run without a local backend.
//
//   LIVE_HOST=graph-series.katzer.ru node docs/examples/dev-proxy.mjs     # listens on 127.0.0.1:3100
//
// SIMULATE_500=/api/backend/api/search/persons,/api/backend/api/series  makes matching paths answer
// "500 Internal Server Error" without contacting the deployment (used only for the error-state screenshot).
import http from 'node:http'
import https from 'node:https'

const LIVE_HOST = process.env.LIVE_HOST ?? 'graph-series.katzer.ru'
const APP_PORT = Number(process.env.APP_PORT ?? 3000)
const PORT = Number(process.env.PORT ?? 3100)
const SIMULATE_500 = (process.env.SIMULATE_500 ?? '').split(',').filter(Boolean)

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api/backend/')) {
      if (req.method !== 'GET') {
        res.writeHead(405)
        return res.end()
      }
      if (SIMULATE_500.some(p => req.url.startsWith(p))) {
        res.writeHead(500, { 'content-type': 'text/plain' })
        return res.end('Internal Server Error')
      }
      const up = https.request(
        { host: LIVE_HOST, path: req.url, method: 'GET', headers: { accept: 'application/json' } },
        r => {
          res.writeHead(r.statusCode, r.headers)
          r.pipe(res)
        },
      )
      up.on('error', () => {
        res.writeHead(502)
        res.end()
      })
      return up.end()
    }
    const local = http.request(
      { host: '127.0.0.1', port: APP_PORT, path: req.url, method: req.method, headers: req.headers },
      r => {
        res.writeHead(r.statusCode, r.headers)
        r.pipe(res)
      },
    )
    local.on('error', () => {
      res.writeHead(502)
      res.end()
    })
    req.pipe(local)
  })
  .listen(PORT, '127.0.0.1', () => console.log(`dev proxy on http://127.0.0.1:${PORT}`))
