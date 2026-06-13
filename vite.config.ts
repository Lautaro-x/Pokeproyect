import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const CATEGORY_FILE: Record<string, string> = {
  gym:        'gym.json',
  bad_team:   'bad_team.json',
  final_boss: 'final_boss.json',
  random:     'random.json',
  other:      'other.json',
}

function sceneSaverPlugin(): Plugin {
  return {
    name: 'scene-saver',
    configureServer(server) {
      server.middlewares.use('/api/save-scene', (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405); res.end('Method not allowed'); return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { scene } = JSON.parse(body) as { scene: { scene_id: string; category: string } }
            const filename = CATEGORY_FILE[scene.category] ?? 'other.json'
            const filePath = path.resolve(__dirname, 'src/assets/scenes', filename)

            let list: unknown[] = []
            if (fs.existsSync(filePath)) {
              list = JSON.parse(fs.readFileSync(filePath, 'utf8'))
            }

            const idx = list.findIndex((s: any) => s.scene_id === scene.scene_id)
            if (idx >= 0) list[idx] = scene
            else          list.push(scene)

            fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8')

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, file: filename, action: idx >= 0 ? 'updated' : 'added' }))
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), sceneSaverPlugin()],
})
