import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { updateMapsJsonContent } from './src/lib/prompt-generation.js'

const MAPS_JSON_FILE_PATH = fileURLToPath(new URL('./src/data/maps.json', import.meta.url))
const NORMALIZED_MAPS_JSON_FILE_PATH = normalizePath(MAPS_JSON_FILE_PATH)
const ADMIN_ENDPOINTS = new Set(['/__admin/maps-json', '/IHTDData/__admin/maps-json'])

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function mapsAdminPlugin() {
  const handler = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!ADMIN_ENDPOINTS.has(url.pathname)) {
      next()
      return
    }

    try {
      if (req.method === 'GET') {
        const text = await fs.readFile(MAPS_JSON_FILE_PATH, 'utf8')
        sendJson(res, 200, { ok: true, text })
        return
      }

      if (req.method === 'PUT') {
        const rawBody = await readRequestBody(req)
        const body = JSON.parse(rawBody || '{}')
        if (typeof body.mapId !== 'string' || !Array.isArray(body.spots)) {
          sendJson(res, 400, { ok: false, error: 'Request body must include mapId and spots.' })
          return
        }

        const currentText = await fs.readFile(MAPS_JSON_FILE_PATH, 'utf8')
        const nextText = updateMapsJsonContent(currentText, body.mapId, body.spots)
        await fs.writeFile(MAPS_JSON_FILE_PATH, nextText, 'utf8')
        sendJson(res, 200, { ok: true, text: nextText, path: MAPS_JSON_FILE_PATH })
        return
      }

      sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Unknown server error.' })
    }
  }

  return {
    name: 'local-maps-json-admin',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    handleHotUpdate(context) {
      if (normalizePath(context.file) === NORMALIZED_MAPS_JSON_FILE_PATH) {
        return []
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mapsAdminPlugin()],
  base: '/IHTDData/',
  server: {
    open: '/IHTDData/',
  },
  build: {
    chunkSizeWarningLimit: 525,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/App.jsx')) {
            return 'app-shell'
          }

          if (id.includes('node_modules/@dnd-kit')) {
            return 'loadout-vendor'
          }

          if (id.includes('node_modules/react')) {
            return 'react-vendor'
          }

          if (id.includes('node_modules')) {
            return 'vendor'
          }

          if (id.includes('/src/data/')) {
            return 'game-data'
          }
        },
      },
    },
  },
}) 
