import { Router } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const modelsRouter = Router()

// The model list is configuration, not code: edit server/config/models.json
// to change which OpenRouter models the UI offers.
modelsRouter.get('/models', (_req, res) => {
  const raw = readFileSync(join(__dirname, '..', '..', 'config', 'models.json'), 'utf8')
  res.json(JSON.parse(raw))
})
