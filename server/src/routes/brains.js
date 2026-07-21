import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storage } from '../storage/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const brainsRouter = Router()

// Built-in brains every user starts with. Users can also create their own.
const BUILTINS = [
  { id: 'company', name: 'Company Brain' },
  { id: 'personal', name: 'Personal Brain' },
  { id: 'vibecoding', name: 'Vibe Coding Instructor' },
]
const BUILTIN_IDS = new Set(BUILTINS.map((b) => b.id))
const MAX_CONTENT = 200_000

function vibeContent() {
  try {
    return readFileSync(join(__dirname, '..', '..', 'config', 'vibecoding-brain.md'), 'utf8')
  } catch {
    return ''
  }
}

/** Ensures a user has their built-in brains (idempotent, lazy on first read). */
async function ensureBuiltins(userId) {
  const existing = await storage.listBrains(userId)
  const have = new Set(existing.map((b) => b.id))
  for (const def of BUILTINS) {
    if (!have.has(def.id)) {
      await storage.upsertBrain(userId, {
        id: def.id,
        name: def.name,
        content: def.id === 'vibecoding' ? vibeContent() : '',
        enabled: true,
        updated_at: new Date().toISOString(),
      })
    }
  }
  return storage.listBrains(userId)
}

brainsRouter.get('/brains', async (req, res, next) => {
  try {
    const brains = await ensureBuiltins(req.user.id)
    res.json(brains.map((b) => ({ ...b, builtin: BUILTIN_IDS.has(b.id) })))
  } catch (err) {
    next(err)
  }
})

// Create a custom knowledge base.
brainsRouter.post('/brains', async (req, res, next) => {
  try {
    const { name, content = '' } = req.body ?? {}
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'A name is required' })
    }
    const brain = {
      id: `kb_${randomUUID().slice(0, 8)}`,
      name: name.trim().slice(0, 80),
      content: String(content).slice(0, MAX_CONTENT),
      enabled: true,
      updated_at: new Date().toISOString(),
    }
    await storage.upsertBrain(req.user.id, brain)
    res.status(201).json({ ...brain, builtin: false })
  } catch (err) {
    next(err)
  }
})

brainsRouter.put('/brains/:id', async (req, res, next) => {
  try {
    const brains = await storage.listBrains(req.user.id)
    const existing = brains.find((b) => b.id === req.params.id)
    const builtin = BUILTINS.find((b) => b.id === req.params.id)
    if (!existing && !builtin) return res.status(404).json({ error: 'Unknown brain' })
    const { content, enabled, name } = req.body ?? {}
    const brain = {
      id: req.params.id,
      name: (name ?? existing?.name ?? builtin?.name ?? 'Knowledge').slice(0, 80),
      content: String(content ?? existing?.content ?? '').slice(0, MAX_CONTENT),
      enabled: enabled === undefined ? (existing?.enabled ?? true) : Boolean(enabled),
      updated_at: new Date().toISOString(),
    }
    await storage.upsertBrain(req.user.id, brain)
    res.json({ ...brain, builtin: BUILTIN_IDS.has(brain.id) })
  } catch (err) {
    next(err)
  }
})

brainsRouter.delete('/brains/:id', async (req, res, next) => {
  try {
    if (BUILTIN_IDS.has(req.params.id)) {
      return res.status(400).json({ error: 'Built-in brains cannot be deleted — clear or disable them instead' })
    }
    await storage.deleteBrain(req.user.id, req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

brainsRouter.post('/brains/vibecoding/reset', async (req, res, next) => {
  try {
    const brain = {
      id: 'vibecoding',
      name: 'Vibe Coding Instructor',
      content: vibeContent(),
      enabled: true,
      updated_at: new Date().toISOString(),
    }
    await storage.upsertBrain(req.user.id, brain)
    res.json({ ...brain, builtin: true })
  } catch (err) {
    next(err)
  }
})
