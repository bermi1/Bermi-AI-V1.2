import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { streamCompletion } from '../openrouter.js'

export const chatRouter = Router()

const SYSTEM_PROMPT =
  'You are Bermi AI, a helpful, precise assistant. Format responses in Markdown. ' +
  'Use code blocks with language tags for code, and tables where they aid clarity.'

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * POST /api/chat  { conversationId?, message, model }
 *
 * OpenRouter has no server-side memory between calls, so the full stored
 * history for the conversation is replayed on every request. The response
 * streams back as SSE: `conversation`, then `token` events, then [DONE].
 */
chatRouter.post('/chat', async (req, res) => {
  const { conversationId, message, model } = req.body ?? {}
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }
  if (typeof model !== 'string' || !model) {
    return res.status(400).json({ error: 'model is required' })
  }

  const now = new Date().toISOString()
  let conversation
  if (conversationId) {
    conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId)
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
  } else {
    const title = message.trim().slice(0, 60) + (message.trim().length > 60 ? '…' : '')
    conversation = {
      id: randomUUID(),
      title,
      model,
      created_at: now,
      updated_at: now,
    }
    db.prepare(
      'INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(conversation.id, conversation.title, model, now, now)
  }

  db.prepare(
    'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(randomUUID(), conversation.id, 'user', message, now)
  db.prepare('UPDATE conversations SET model = ?, updated_at = ? WHERE id = ?').run(
    model,
    now,
    conversation.id,
  )

  const history = db
    .prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid',
    )
    .all(conversation.id)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  sse(res, { type: 'conversation', conversation: { ...conversation, model } })

  // Abort the upstream call if the client disconnects mid-stream. This must
  // watch the response: req 'close' fires as soon as the body is consumed.
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })

  let assistantText = ''
  try {
    const upstream = await streamCompletion({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      signal: abort.signal,
    })

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') continue
        try {
          const chunk = JSON.parse(payload)
          const token = chunk.choices?.[0]?.delta?.content
          if (token) {
            assistantText += token
            sse(res, { type: 'token', token })
          }
        } catch {
          /* keep-alive comments / partial JSON */
        }
      }
    }
  } catch (err) {
    if (!abort.signal.aborted) {
      sse(res, { type: 'error', error: err.message })
      res.end()
      return
    }
  }

  if (assistantText) {
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      randomUUID(),
      conversation.id,
      'assistant',
      assistantText,
      model,
      new Date().toISOString(),
    )
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      conversation.id,
    )
  }

  res.write('data: [DONE]\n\n')
  res.end()
})
