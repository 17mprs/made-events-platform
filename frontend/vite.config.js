import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Single source of truth for EVENT-TALENT match scoring lives in
// backend/shared/matchScore.js (pushed to GAS as a plain global script —
// GAS can't parse ES module syntax). This plugin reads that same file's
// source at build/dev time, cuts the GAS-only tail, and appends a real
// `export` so the frontend can import the exact backend logic verbatim —
// no manually-duplicated copy to drift out of sync again.
function sharedMatchScorePlugin() {
  const virtualId = 'virtual:match-score'
  const resolvedId = '\0' + virtualId
  const sourcePath = path.resolve(__dirname, '../backend/shared/matchScore.js')

  return {
    name: 'shared-match-score',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) {
        const src = fs.readFileSync(sourcePath, 'utf-8')
        const marker = '// === GAS_ONLY_BELOW ==='
        const idx = src.indexOf(marker)
        const body = idx === -1 ? src : src.slice(0, idx)
        return body + '\nexport { calculateEventMatch, calculateEventMatchBreakdown }\n'
      }
    },
    configureServer(server) {
      server.watcher.add(sourcePath)
      server.watcher.on('change', file => {
        if (file === sourcePath) server.ws.send({ type: 'full-reload' })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), sharedMatchScorePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: { port: 3000 }
})
