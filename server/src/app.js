import './env.js'
import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachUser, requireAuth, requireVerified } from './auth.js'
import { authRouter, verificationRequired } from './routes/auth.js'
import { chatRouter } from './routes/chat.js'
import { conversationsRouter } from './routes/conversations.js'
import { documentsRouter } from './routes/documents.js'
import { extractRouter } from './routes/extract.js'
import { modelsRouter } from './routes/models.js'
import { settingsRouter } from './routes/settings.js'
import { brainsRouter, seedBrains } from './routes/brains.js'
import { connectorsRouter } from './routes/connectors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

// Behind reverse proxies (Vercel, Railway, nginx, Cloudflare) the original
// protocol arrives in X-Forwarded-Proto; needed for correct cookie flags.
app.set('trust proxy', 1)

app.use(cors({ credentials: true, origin: true }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Session resolution for every API request; auth endpoints stay public,
// everything else requires a signed-in user.
app.use('/api', attachUser)
app.use('/api', authRouter)
app.use('/api', requireAuth)
app.use('/api', requireVerified(verificationRequired))

app.use('/api', chatRouter)
app.use('/api', conversationsRouter)
app.use('/api', documentsRouter)
app.use('/api', extractRouter)
app.use('/api', modelsRouter)
app.use('/api', settingsRouter)
app.use('/api', brainsRouter)
app.use('/api', connectorsRouter)

// Async route errors land here instead of crashing the process.
app.use((err, _req, res, _next) => {
  console.error(err)
  if (!res.headersSent) res.status(500).json({ error: err.message })
})

// When the built client exists locally, serve it from the same process.
// (On Vercel the static build is served by the CDN instead.)
const clientDist = join(__dirname, '..', '..', 'client', 'dist')
if (!process.env.VERCEL && existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')))
}

// Pre-loaded knowledge (Vibe Coding Instructor) — idempotent.
await seedBrains()

export default app
