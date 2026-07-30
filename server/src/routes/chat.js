import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { streamCompletion } from '../openrouter.js'
import { STUDY_PROMPT, awardStudy, parseMasteredSteps } from '../study.js'
import { BERMI_FEATURES_PROMPT } from '../features.js'
import { getMemory, remember } from '../memory.js'
import { summarizeVideo } from '../video.js'

export const chatRouter = Router()

const BASE_PROMPT =
  'You are Bermi AI, a helpful, precise, highly capable assistant. ' +
  'Before you answer, silently refine the request: work out the true intent, fill obvious gaps, and plan the ' +
  'clearest, most complete response — then reply with that improved understanding (never show this planning). ' +
  'STAY ON TOPIC: answer exactly what the user asked, directly and fully; do not drift into unrelated tangents, ' +
  'filler, or unrequested topics. If the request is broad, cover it thoroughly and stay within its scope. ' +
  'Be genuinely useful and expansive when depth helps, concise when it does not. ' +
  'Format responses in Markdown. Use tables where they aid clarity. ' +
  'IMPORTANT: only include code blocks when the user is actually asking about programming or explicitly wants ' +
  'code. For everyday, factual, or non-technical questions, answer in prose and DO NOT append example code, ' +
  'commands, or snippets. Match the format to the question. ' +
  'Write ALL mathematics in LaTeX: $...$ for inline and $$...$$ for display equations. ' +
  'For any math problem, show clear step-by-step working, then give the final answer on its own line as ' +
  '**Answer:** $...$. When a function, curve, inequality region or dataset would be clearer as a graph, add a ' +
  'fenced code block with the language `plot` containing one expression in x per line ' +
  '(for example a block with `y = x^2` then `y = sin(x)`); Bermi renders these as an interactive graph. ' +
  'Optionally set the range with a first line like `# x: -10..10`. ' +
  'To play a course video, add a fenced code block with the language `video` containing `url: <link>` and ' +
  'optionally `title: <text>` on their own lines — Bermi renders it as an inline player with captions when ' +
  'available. Only ever use a real video_url given to you in context; never fabricate one.'

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

  const [name, role, prefs, memory] = await Promise.all([
    storage.getSetting(`u:${userId}:profile_name`),
    storage.getSetting(`u:${userId}:profile_role`),
    storage.getSetting(`u:${userId}:profile_preferences`),
    getMemory(userId),
  ])
  const personal = []
  if (name) personal.push(`The user's name is ${name}.`)
  if (role) personal.push(`About their work: ${role}.`)
  if (prefs) personal.push(`Preferences for how you should respond: ${prefs}`)
  if (personal.length) parts.push(`# About the user\n${personal.join('\n')}`)

  // Cross-conversation memory: what Bermi remembers about this person from
  // EVERY past conversation, not just the current one — this is what makes
  // it feel continuous rather than starting fresh every time.
  if (memory) {
    parts.push(
      `# What you remember about this person (from past conversations)\n${memory}\n\n` +
        'Use this naturally where relevant — do not recite it verbatim or announce that you are "recalling" it.',
    )
  }

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

// Only touch the LMS when the message is actually about learning/courses, so
// normal chats stay fast and lean.
const LEARN_RE =
  /\b(courses?|classes?|lessons?|enroll?|enrol|enrolled|apply|applying|study|studying|learn(ing)?|certificate|programs?|programme|curriculum|syllabus|tutor|progress|recommend\w*|continue|graduate|what.{0,12}next)\b/i
const ENROLL_RE = /\b(enroll?|enrol|apply|applying|sign me up|sign up for|register|join)\b/i
const VIDEO_SUMMARY_RE = /\b(summar(y|ize|ise)|tl;?dr|recap)\b.{0,25}\bvideo\b|\bvideo\b.{0,25}\b(summar(y|ize|ise)|tl;?dr|recap)\b/i
const VIDEO_PLAY_RE = /\b(play|watch|show|open)\b.{0,25}\bvideo\b/i

/**
 * Lets Bermi access the course catalog and act on it agentically from chat:
 * it can discuss/recommend any published course, and enroll the user directly
 * when they ask. Returns a context block (the catalog) and an action note
 * (what the system already did) to append to the system prompt.
 */
async function learningContext(userId, message) {
  if (!LEARN_RE.test(message)) return { block: '', note: '' }
  let courses = []
  let instById = new Map()
  try {
    const [cs, insts] = await Promise.all([
      storage.listPublishedCourses(),
      storage.listPublishedInstitutions(),
    ])
    courses = cs || []
    instById = new Map((insts || []).map((i) => [i.id, i]))
  } catch {
    return { block: '', note: '' }
  }
  if (!courses.length) return { block: '', note: '' }

  const list = courses
    .slice(0, 40)
    .map((c) => {
      const inst = instById.get(c.institution_id)
      const obj = (c.objectives || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      return (
        `- "${c.title}" (${c.level || 'All levels'}) by ${inst?.name || 'an organization'}${c.summary ? ` — ${c.summary}` : ''}` +
        (obj ? `\n    Objectives: ${obj}` : '')
      )
    })
    .join('\n')

  // The learner's own progress — powers "show my progress" and "what next".
  // Also collects any lesson videos across their enrolled courses, so a
  // "play the video" / "summarize the video" request can be resolved to an
  // actual video_url the institution attached, without the learner naming it.
  let progressBlock = ''
  const videoLessons = [] // { course, lesson, nextUp }
  try {
    const enrollments = await storage.listEnrollmentsByUser(userId)
    const rows = []
    for (const e of (enrollments || []).slice(0, 15)) {
      const course = await storage.getCourse(e.course_id)
      if (!course) continue
      const lessons = await storage.listLessons(course.id)
      const progress = e.progress || {}
      const done = Object.values(progress).filter((p) => p && p.done).length
      const withVideo = lessons.filter((l) => l.video_url?.trim())
      const nextUpId = lessons.find((l) => !progress[l.id]?.done)?.id
      for (const l of withVideo) videoLessons.push({ course, lesson: l, nextUp: l.id === nextUpId })
      rows.push(
        `- "${course.title}": ${e.status}` +
          (lessons.length ? `, ${done}/${lessons.length} lessons done` : '') +
          (e.score != null ? `, average score ${e.score}%` : '') +
          (withVideo.length ? `. Has video for: ${withVideo.map((l) => `"${l.title}"`).join(', ')}` : ''),
      )
    }
    if (rows.length) {
      progressBlock = `\n\n# This learner's progress\n${rows.join('\n')}`
    }
  } catch {
    /* progress optional */
  }

  const block =
    `# Bermi Learn — courses available right now (you can discuss, recommend and enroll the user in these)\n${list}` +
    progressBlock +
    '\n\nGuidance: If the user asks to enroll/apply, the system enrolls them directly (see any Live action below), ' +
    'then start teaching them right here, in this chat, immediately. ' +
    'For "show my progress", summarize their progress above clearly. ' +
    'For "what should I learn next", recommend the best next step — finish an in-progress course first, otherwise ' +
    'suggest a fitting course from the catalog (name it). Recommend only courses from this list. ' +
    'When you teach a course, TEACH AND EVALUATE AGAINST ITS OBJECTIVES: work through them in order, quiz the ' +
    "learner on them, and note how well they understand and how independently they work. Learning happens here in " +
    'Bermi AI — never tell the learner to go to the portal (the portal is for institutions only).'

  let note = ''
  if (ENROLL_RE.test(message)) {
    const lower = message.toLowerCase()
    let best = courses.find((c) => lower.includes(c.title.toLowerCase()))
    if (!best) {
      let bestHits = 0
      for (const c of courses) {
        const words = c.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
        const hits = words.filter((w) => lower.includes(w)).length
        if (hits > bestHits && hits >= Math.max(1, Math.ceil(words.length / 2))) {
          best = c
          bestHits = hits
        }
      }
    }
    if (best) {
      try {
        const existing = await storage.getEnrollment(best.id, userId)
        if (existing) {
          note = `Live action: the user is ALREADY enrolled in "${best.title}". Confirm briefly, then continue teaching them right here in this chat from where they left off.`
        } else {
          await storage.createEnrollment({
            id: randomUUID(),
            course_id: best.id,
            user_id: userId,
            status: best.enrollment === 'approval' ? 'applied' : 'enrolled',
            progress: {},
            score: null,
            enrolled_at: new Date().toISOString(),
          })
          const inst = instById.get(best.institution_id)
          note = `Live action: you HAVE NOW enrolled the user in "${best.title}"${inst ? ` by ${inst.name}` : ''}. Confirm warmly, briefly say what it covers, then immediately begin teaching the first lesson right here in this chat. State only what actually happened.`
        }
      } catch (e) {
        note = `Live action: enrollment failed (${e.message}). Apologize briefly and offer to try again right here in chat.`
      }
    } else {
      note =
        'Live action: the user wants to enroll but did not name a course that matches the catalog. Ask which one, listing 2-3 relevant available courses by name.'
    }
  }

  // Playing/summarizing a lesson video — resolve to an actual video_url an
  // institution attached, never a guessed or fabricated link.
  if (videoLessons.length && (VIDEO_PLAY_RE.test(message) || VIDEO_SUMMARY_RE.test(message))) {
    const lower = message.toLowerCase()
    const target =
      videoLessons.find((v) => lower.includes(v.lesson.title.toLowerCase())) ||
      videoLessons.find((v) => lower.includes(v.course.title.toLowerCase())) ||
      videoLessons.find((v) => v.nextUp) ||
      videoLessons[0]

    if (VIDEO_SUMMARY_RE.test(message)) {
      const result = await summarizeVideo(target.lesson.video_url, { title: target.lesson.title })
      note = result.ok
        ? `Live action: you already reviewed the video for lesson "${target.lesson.title}" (course "${target.course.title}"). ` +
          `Present this summary to the user in your own words, well-formatted — do not say "transcript" or "captions", just summarize what the video covers:\n\n${result.summary}`
        : `Live action: could not summarize the video for lesson "${target.lesson.title}" — ${result.reason} Tell the user plainly and offer to keep teaching the lesson from its written content instead.`
    } else {
      note =
        `Live action: playing the video for lesson "${target.lesson.title}" (course "${target.course.title}"). ` +
        'In your reply, include exactly one fenced code block with language "video" containing only:\n' +
        `url: ${target.lesson.video_url}\ntitle: ${target.lesson.title}\n` +
        'Do not print the raw URL anywhere else. Add one short sentence introducing it, and mention captions play automatically if the source provides them.'
    }
  }

  return { block, note }
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

    const [systemPromptBase, history, learn] = await Promise.all([
      buildSystemPrompt(req.user.id, study),
      storage.listMessages(conversation.id),
      learningContext(req.user.id, message),
    ])
    let systemPrompt = systemPromptBase
    if (learn.block) systemPrompt += `\n\n${learn.block}`
    if (learn.note) systemPrompt += `\n\n# Live action (already performed by the system)\n${learn.note}`

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
    // Real, in-context web citations (the sources the grounded answer used).
    const citations = []
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
            // Capture the real sources the web-grounded answer actually cited.
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
      // Only surface sources that are real and tied to this answer's context.
      if (web && citations.length) sse(res, { type: 'citations', items: citations })
    } catch (err) {
      if (!abort.signal.aborted) {
        sse(res, { type: 'error', error: err.message })
        res.end()
        return
      }
    }

    if (assistantText) {
      // Persist real sources inline so they survive a reload.
      let toSave = assistantText
      if (web && citations.length) {
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

      // Fire-and-forget: fold this exchange into the user's persistent,
      // cross-conversation memory so future chats (any of them) can draw on
      // it — never blocks or affects the response already sent.
      remember(req.user.id, message, assistantText)

      // Gamify Study Mode — but only for real progress: XP is granted solely
      // when the tutor's own reply just confirmed mastery of a lesson (its
      // "✅ **Mastered:** …" marker), never for the act of exchanging a
      // message. No marker this turn means no XP, no streak, no toast.
      if (study) {
        try {
          const mastered = parseMasteredSteps(assistantText)
          if (mastered.length) {
            const result = await awardStudy(req.user.id, conversation.title, mastered)
            if (result) sse(res, { type: 'study', ...result })
          }
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
