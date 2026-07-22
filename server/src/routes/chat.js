import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { streamCompletion } from '../openrouter.js'

export const chatRouter = Router()

const BASE_PROMPT =
  'You are Bermi AI, a helpful, precise assistant. Format responses in Markdown. ' +
  'Use code blocks with language tags for code, and tables where they aid clarity.'

/**
 * System prompt = base + user personalization + enabled brains. The company
 * and personal brains are persistent knowledge stores the user curates; they
 * ride along on every request since the LLM API is stateless.
 */
async function buildSystemPrompt(userId) {
  const parts = [BASE_PROMPT]

  const [name, role, prefs] = await Promise.all([
    storage.getSetting(`u:${userId}:profile_name`),
    storage.getSetting(`u:${userId}:profile_role`),
    storage.getSetting(`u:${userId}:profile_preferences`),
  ])
  const personal = []
  if (name) personal.push(`The user's name is ${name}.`)
  if (role) personal.push(`About their work: ${role}.`)
  if (prefs) personal.push(`Preferences for how you should respond: ${prefs}`)
  if (personal.length) parts.push(`# About the user\n${personal.join('\n')}`)

  const brains = await storage.listBrains(userId)
  for (const brain of brains) {
    if (brain.enabled && brain.content?.trim()) {
      // Cap each brain's contribution so an oversized knowledge base cannot
      // blow up the request; stored content can be much larger.
      const content = brain.content.trim().slice(0, 20_000)
      parts.push(
        `# ${brain.name} (persistent knowledge — treat as reliable context)\n${content}`,
      )
    }
  }
  return parts.join('\n\n')
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * POST /api/chat  { conversationId?, message, model }
 * Streams back SSE: `conversation`, then `token` events, then [DONE].
 */
chatRouter.post('/chat', async (req, res, next) => {
  try {
    const { conversationId, message, model, web = false } = req.body ?? {}
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' })
    }
    if (typeof model !== 'string' || !model) {
      return res.status(400).json({ error: 'model is required' })
    }

    const now = new Date().toISOString()
    let conversation
    if (conversationId) {
      conversation = await storage.getConversation(conversationId)
      if (!conversation || conversation.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Conversation not found' })
      }
      await storage.updateConversation(conversation.id, { model, updated_at: now })
    } else {
      const title = message.trim().slice(0, 60) + (message.trim().length > 60 ? '…' : '')
      conversation = await storage.createConversation({
        id: randomUUID(),
        user_id: req.user.id,
        title,
        model,
        created_at: now,
        updated_at: now,
      })
    }

    await storage.addMessage({
      id: randomUUID(),
      conversation_id: conversation.id,
      role: 'user',
      content: message,
      created_at: now,
    })

    const [systemPrompt, history] = await Promise.all([
      buildSystemPrompt(req.user.id),
      storage.listMessages(conversation.id),
    ])

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

    // Show the "triangulating" work Bermi does before answering — a visible
    // think/search/synthesize loop. With web search on, the steps are real
    // phases of the grounded request.
    const steps = web
      ? ['Understanding your request', 'Searching the web', 'Reading sources', 'Synthesizing an answer']
      : ['Understanding your request', 'Reasoning through it', 'Composing an answer']
    for (const label of steps) sse(res, { type: 'status', label })

    let assistantText = ''
    const citations = []
    try {
      const upstream = await streamCompletion({
        model,
        web,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map(({ role, content }) => ({ role, content })),
        ],
        signal: abort.signal,
      })

      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let firstToken = true
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
            const delta = chunk.choices?.[0]?.delta
            const token = delta?.content
            // Collect url citations from web-grounded answers.
            const anns = delta?.annotations || chunk.choices?.[0]?.message?.annotations
            if (Array.isArray(anns)) {
              for (const a of anns) {
                const u = a.url_citation || a
                if (u?.url && !citations.some((c) => c.url === u.url)) {
                  citations.push({ url: u.url, title: u.title || u.url })
                }
              }
            }
            if (token) {
              if (firstToken) {
                sse(res, { type: 'status', label: null }) // clear the loop
                firstToken = false
              }
              assistantText += token
              sse(res, { type: 'token', token })
            }
          } catch {
            /* keep-alive comments / partial JSON */
          }
        }
      }
      if (citations.length) sse(res, { type: 'citations', items: citations })
    } catch (err) {
      if (!abort.signal.aborted) {
        sse(res, { type: 'error', error: err.message })
        res.end()
        return
      }
    }

    if (assistantText) {
      // Persist citations inline so they survive a reload.
      let toSave = assistantText
      if (citations.length) {
        toSave +=
          '\n\n---\n**Sources**\n' +
          citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join('\n')
      }
      const doneAt = new Date().toISOString()
      await storage.addMessage({
        id: randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: toSave,
        model,
        created_at: doneAt,
      })
      await storage.updateConversation(conversation.id, { updated_at: doneAt })
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    next(err)
  }
})
