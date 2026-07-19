import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envDir = dirname(fileURLToPath(import.meta.url))
// Load server/.env first, then the repo-root .env as fallback, so the key is
// found no matter which directory the server is started from.
dotenv.config({ path: join(envDir, '..', '.env') })
dotenv.config({ path: join(envDir, '..', '..', '.env') })
import { chatRouter } from './routes/chat.js'
import { conversationsRouter } from './routes/conversations.js'
import { documentsRouter } from './routes/documents.js'
import { modelsRouter } from './routes/models.js'
import { settingsRouter } from './routes/settings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use('/api', chatRouter)
app.use('/api', conversationsRouter)
app.use('/api', documentsRouter)
app.use('/api', modelsRouter)
app.use('/api', settingsRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// In production, serve the built client from the same process.
const clientDist = join(__dirname, '..', '..', 'client', 'dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')))
}

const port = Number(process.env.PORT) || 3001
app.listen(port, () => {
  console.log(`Bermi AI server listening on http://localhost:${port}`)
})
