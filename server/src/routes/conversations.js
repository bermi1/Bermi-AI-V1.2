import { Router } from 'express'
import { storage } from '../storage/index.js'

export const conversationsRouter = Router()

conversationsRouter.get('/conversations', async (_req, res, next) => {
  try {
    res.json(await storage.listConversations())
  } catch (err) {
    next(err)
  }
})

conversationsRouter.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversation = await storage.getConversation(req.params.id)
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
    res.json(await storage.listMessages(req.params.id))
  } catch (err) {
    next(err)
  }
})

conversationsRouter.patch('/conversations/:id', async (req, res, next) => {
  try {
    const { title } = req.body ?? {}
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' })
    }
    const updated = await storage.updateConversation(req.params.id, {
      title: title.trim(),
      updated_at: new Date().toISOString(),
    })
    if (!updated) return res.status(404).json({ error: 'Conversation not found' })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

conversationsRouter.delete('/conversations/:id', async (req, res, next) => {
  try {
    const existing = await storage.getConversation(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Conversation not found' })
    await storage.deleteConversation(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
