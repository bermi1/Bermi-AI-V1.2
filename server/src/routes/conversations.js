import { Router } from 'express'
import { storage } from '../storage/index.js'

export const conversationsRouter = Router()

async function ownedConversation(req) {
  const conversation = await storage.getConversation(req.params.id)
  return conversation && conversation.user_id === req.user.id ? conversation : null
}

conversationsRouter.get('/conversations', async (req, res, next) => {
  try {
    res.json(await storage.listConversations(req.user.id))
  } catch (err) {
    next(err)
  }
})

conversationsRouter.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversation = await ownedConversation(req)
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
    if (!(await ownedConversation(req))) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const updated = await storage.updateConversation(req.params.id, {
      title: title.trim(),
      updated_at: new Date().toISOString(),
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

conversationsRouter.delete('/conversations/:id', async (req, res, next) => {
  try {
    if (!(await ownedConversation(req))) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    await storage.deleteConversation(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
