import { Router } from 'express'
import { storage } from '../storage/index.js'

export const brainsRouter = Router()

// Two fixed knowledge stores. Their content is injected into every chat's
// system prompt while enabled.
const BRAIN_DEFS = [
  { id: 'company', name: 'Company Brain' },
  { id: 'personal', name: 'Personal Brain' },
]

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
      content: String(content).slice(0, 24000),
      enabled: Boolean(enabled),
      updated_at: new Date().toISOString(),
    }
    await storage.upsertBrain(brain)
    res.json(brain)
  } catch (err) {
    next(err)
  }
})
