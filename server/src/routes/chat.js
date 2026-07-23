import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { streamCompletion } from '../openrouter.js'
import { STUDY_PROMPT, awardStudy } from '../study.js'
import { BERMI_FEATURES_PROMPT } from '../features.js'

export const chatRouter = Router()

const BASE_PROMPT =
  'You are Bermi AI, a helpful, precise assistant. ' +
  'Before you answer, silently refine the request: work out the true intent, fill obvious gaps, and plan the ' +
  'clearest, most complete response — then reply with that improved understanding (never show this planning). ' +
  'Format responses in Markdown. Use tables where they aid clarity. ' +
  'IMPORTANT: only include code blocks when the user is actually asking about programming or explicitly wants ' +
  'code. For everyday, factual, or non-technical questions, answer in prose and DO NOT append example code, ' +
  'commands, or snippets. Match the format to the question. ' +
  'Write ALL mathematics in LaTeX: $...$ for inline and $$...$$ for display equations. ' +
  'For any math problem, show clear step-by-step working, then give the final answer on its own line as ' +
  '**Answer:** $...$. When a function, curve, inequality region or dataset would be clearer as a graph, add a ' +
  'fenced code block with the language `plot` containing one expression in x per line ' +
  '(for example a block with `y = x^2` then `y = sin(x)`); Bermi renders these as an interactive graph. ' +
  'Optionally set the range with a first line like `# x: -10..10`.'

/**
 * System prompt = base + user personalization + enabled brains. The company
 * and personal brains are persistent knowledge stores the user curates; they
 * ride along on every request since the LLM API is stateless.
 */
async function buildSystemPrompt(userId, study = false) {
  const parts = [study ? STUDY_PROMPT : BASE_PROMPT]

  // Bermi's self-knowledge: current features & updates, so it can answer
  // "what's new?" / "what can you do?" accurately instead of guessing.
  parts.push(`# About Bermi (yourself)\n${BERMI_FEATURES_PROMPT}`)

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
    const { conversationId, message, model, web = false, study = false, attachments } = req.body ?? {}
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' })
    }

    // Attached documents are read INTERNALLY: their (OCR'd / parsed) text is
    // folded into this turn's context for the model, but never stored or shown
    // in the chat — the saved user message only carries the visible text.
    const docBlocks = Array.isArray(attachments)
      ? attachments
          .filter((a) => a && typeof a.text === 'string' && a.text.trim())
          .map(
            (a) =>
              `--- Attached document: ${a.name || 'file'} ---\n${a.text.slice(0, 24000)}\n--- End of document ---`,
          )
          .join('\n\n')
      : ''
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
      buildSystemPrompt(req.user.id, study),
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

    // Show the work Bermi does before answering. For web search this is a real
    // agentic loop: plan queries → search each → read sources → synthesize.
    if (web) {
      // Keep this light — no extra pre-call — so answers start fast.
      for (const label of ['Searching the web', 'Reading results', 'Writing the answer'])
        sse(res, { type: 'status', label })
    } else if (study) {
      for (const label of ['Assessing what you know', 'Planning the lesson', 'Preparing your next step'])
        sse(res, { type: 'status', label })
    } else {
      for (const label of ['Understanding your request', 'Reasoning through it', 'Composing an answer'])
        sse(res, { type: 'status', label })
    }

    let assistantText = ''
    try {
      const upstream = await streamCompletion({
        model,
        web,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map(({ role, content }, i, arr) => {
            // Fold attached-document text into the final user turn only.
            if (docBlocks && role === 'user' && i === arr.length - 1) {
              return {
                role,
                content: `${content}\n\n${docBlocks}\n\nRead the attached document(s) above carefully and use them to answer. Do not paste the document back verbatim; work from your understanding of it.`,
              }
            }
            return { role, content }
          }),
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
    } catch (err) {
      if (!abort.signal.aborted) {
        sse(res, { type: 'error', error: err.message })
        res.end()
        return
      }
    }

    if (assistantText) {
      const doneAt = new Date().toISOString()
      await storage.addMessage({
        id: randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: assistantText,
        model,
        created_at: doneAt,
      })
      await storage.updateConversation(conversation.id, { updated_at: doneAt })

      // Gamify study sessions: award XP, update streaks/badges, and tell the UI.
      if (study) {
        try {
          const result = await awardStudy(req.user.id, conversation.title)
          sse(res, { type: 'study', ...result })
        } catch {
          /* non-fatal */
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/chat/feedback { messageId, value }
 * Records a thumbs up/down on an answer so Bermi can learn what helps.
 * value: 'up' | 'down' | null (clears).
 */
chatRouter.post('/chat/feedback', async (req, res, next) => {
  try {
    const { messageId, value } = req.body ?? {}
    if (typeof messageId !== 'string' || !messageId) {
      return res.status(400).json({ error: 'messageId is required' })
    }
    const key = `fb:${req.user.id}:${messageId}`
    if (value === 'up' || value === 'down') {
      await storage.setSetting(key, value)
    } else {
      await storage.deleteSetting(key)
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
