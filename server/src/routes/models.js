import { Router } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storage } from '../storage/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const modelsRouter = Router()

function configuredModels() {
  const raw = readFileSync(join(__dirname, '..', '..', 'config', 'models.json'), 'utf8')
  return JSON.parse(raw)
}

async function customModels() {
  const raw = await storage.getSetting('custom_models')
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Base list is configuration (server/config/models.json); users can add any
// other OpenRouter model id at runtime via settings.
modelsRouter.get('/models', async (_req, res, next) => {
  try {
    const custom = await customModels()
    res.json([
      ...configuredModels(),
      ...custom.map((m) => ({ ...m, custom: true })),
    ])
  } catch (err) {
    next(err)
  }
})

modelsRouter.post('/models/custom', async (req, res, next) => {
  try {
    const { id, label } = req.body ?? {}
    if (typeof id !== 'string' || !id.includes('/')) {
      return res
        .status(400)
        .json({ error: 'Model id must look like provider/model, e.g. mistralai/mistral-large' })
    }
    const custom = await customModels()
    if (!custom.some((m) => m.id === id) && !configuredModels().some((m) => m.id === id)) {
      custom.push({ id, label: label?.trim() || id, description: 'Custom model' })
      await storage.setSetting('custom_models', JSON.stringify(custom))
    }
    res.status(201).json(custom)
  } catch (err) {
    next(err)
  }
})

// Model ids contain slashes, so the id travels as a query parameter.
modelsRouter.delete('/models/custom', async (req, res, next) => {
  try {
    const custom = await customModels()
    const next_ = custom.filter((m) => m.id !== req.query.id)
    await storage.setSetting('custom_models', JSON.stringify(next_))
    res.json(next_)
  } catch (err) {
    next(err)
  }
})
