import { Router } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storage } from '../storage/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const brainsRouter = Router()

// Fixed knowledge stores. Their content is injected into every chat's system
// prompt while enabled. The Vibe Coding Instructor brain ships pre-loaded.
const BRAIN_DEFS = [
  { id: 'company', name: 'Company Brain' },
  { id: 'personal', name: 'Personal Brain' },
  { id: 'vibecoding', name: 'Vibe Coding Instructor' },
]

const MAX_CONTENT = 120_000

function defaultVibeContent() {
  try {
    return readFileSync(join(__dirname, '..', '..', 'config', 'vibecoding-brain.md'), 'utf8')
  } catch {
    return ''
  }
}

/** Seeds the pre-loaded brains once, at server startup. */
export async function seedBrains() {
  try {
    const existing = await storage.listBrains()
    if (!existing.some((b) => b.id === 'vibecoding')) {
      const content = defaultVibeContent()
      if (content) {
        await storage.upsertBrain({
          id: 'vibecoding',
          name: 'Vibe Coding Instructor',
          content,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        console.log('Seeded Vibe Coding Instructor brain (%d chars)', content.length)
      }
    }
  } catch (err) {
    console.error('Brain seeding failed:', err.message)
  }
}

brainsRouter.get('/brains', async (_req, res, next) => {
  try {
    const existing = await storage.listBrains()
    const byId = new Map(existing.map((b) => [b.id, b]))
    res.json(
      BRAIN_DEFS.map(
        (def) =>
          byId.get(def.id) ?? {
            ...def,
            content: '',
            enabled: true,
            updated_at: null,
          },
      ),
    )
  } catch (err) {
    next(err)
  }
})

brainsRouter.put('/brains/:id', async (req, res, next) => {
  try {
    const def = BRAIN_DEFS.find((b) => b.id === req.params.id)
    if (!def) return res.status(404).json({ error: 'Unknown brain' })
    const { content = '', enabled = true } = req.body ?? {}
    const brain = {
      id: def.id,
      name: def.name,
      content: String(content).slice(0, MAX_CONTENT),
      enabled: Boolean(enabled),
      updated_at: new Date().toISOString(),
    }
    await storage.upsertBrain(brain)
    res.json(brain)
  } catch (err) {
    next(err)
  }
})

// Restore the shipped Vibe Coding curriculum (e.g. after accidental edits).
brainsRouter.post('/brains/vibecoding/reset', async (_req, res, next) => {
  try {
    const brain = {
      id: 'vibecoding',
      name: 'Vibe Coding Instructor',
      content: defaultVibeContent(),
      enabled: true,
      updated_at: new Date().toISOString(),
    }
    await storage.upsertBrain(brain)
    res.json(brain)
  } catch (err) {
    next(err)
  }
})
