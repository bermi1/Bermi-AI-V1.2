import './env.js'
import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chatRouter } from './routes/chat.js'
import { conversationsRouter } from './routes/conversations.js'
import { documentsRouter } from './routes/documents.js'
import { modelsRouter } from './routes/models.js'
import { settingsRouter } from './routes/settings.js'
import { brainsRouter } from './routes/brains.js'
import { connectorsRouter } from './routes/connectors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use('/api', chatRouter)
app.use('/api', conversationsRouter)
app.use('/api', documentsRouter)
app.use('/api', modelsRouter)
app.use('/api', settingsRouter)
app.use('/api', brainsRouter)
app.use('/api', connectorsRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Async route errors land here instead of crashing the process.
app.use((err, _req, res, _next) => {
  console.error(err)
  if (!res.headersSent) res.status(500).json({ error: err.message })
})

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
