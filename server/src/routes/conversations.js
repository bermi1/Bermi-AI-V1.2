import { Router } from 'express'
import { db } from '../db.js'

export const conversationsRouter = Router()

conversationsRouter.get('/conversations', (_req, res) => {
  const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all()
  res.json(rows)
})

conversationsRouter.get('/conversations/:id/messages', (req, res) => {
  const conversation = db
    .prepare('SELECT id FROM conversations WHERE id = ?')
    .get(req.params.id)
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
  const rows = db
    .prepare(
      'SELECT id, role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid',
    )
    .all(req.params.id)
  res.json(rows)
})

conversationsRouter.patch('/conversations/:id', (req, res) => {
  const { title } = req.body ?? {}
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' })
  }
  const result = db
    .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
    .run(title.trim(), new Date().toISOString(), req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Conversation not found' })
  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id))
})

conversationsRouter.delete('/conversations/:id', (req, res) => {
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Conversation not found' })
  res.json({ ok: true })
})
