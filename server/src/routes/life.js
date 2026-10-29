import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'
import { rateLimit } from '../rateLimit.js'
import * as credits from '../credits.js'
import { KINDS, KIND_NAMES, sanitizeItem, ValidationError, isDate, isTime } from '../life/kinds.js'
import { dayBlocks, findConflicts, freeSlots, busyMinutes, checkProposal, occursOn, minToTime } from '../life/schedule.js'
import { planSaving, monthSummary, contributed } from '../life/money.js'
import { publishedContent, pickDaily } from '../life/content.js'
import { sanitizeKit } from '../life/kinds.js'

export const lifeRouter = Router()

const PREFS_KEY = (userId) => `u:${userId}:prefs`

// A storage error that means "the Life OS tables don't exist yet" (the
// Supabase migration hasn't been applied) is reported as such, instead of a
// raw 500 — screens render an honest setup state from it.
const notProvisioned = (err) =>
  /relation .* does not exist|could not find the table|schema cache|bermi_life_items|bermi_credit_ledger|bermi_credit_apply/i.test(
    String(err?.message),
  )

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    if (notProvisioned(err)) {
      return res.status(503).json({
        code: 'life_not_provisioned',
        error: 'Life OS storage is not set up on this server yet. An administrator needs to apply server/migrations/001_life_os.sql.',
      })
    }
    next(err)
  }
}

// ---------------------------------------------------------------- preferences

lifeRouter.get(
  '/life/prefs',
  wrap(async (req, res) => {
    const raw = await storage.getSetting(PREFS_KEY(req.user.id))
    let prefs = null
    try {
      prefs = raw ? JSON.parse(raw) : null
    } catch {
      /* corrupt value — treat as none */
    }
    res.json({ prefs })
  }),
)

const PREF_ENUMS = {
  mode: ['light', 'dark', 'system'],
  accent: ['blue', 'orange', 'rose', 'violet', 'teal'],
  icon: ['blue', 'orange', 'rose', 'violet', 'teal'],
  density: ['comfortable', 'compact'],
  motion: ['system', 'reduce'],
  textSize: ['default', 'large', 'xlarge'],
  assistant: ['orb', 'wave'],
}

lifeRouter.put(
  '/life/prefs',
  wrap(async (req, res) => {
    const input = req.body?.prefs
    if (!input || typeof input !== 'object') throw new ValidationError('prefs is required')
    const clean = {}
    for (const [k, allowed] of Object.entries(PREF_ENUMS)) {
      if (!allowed.includes(input[k])) throw new ValidationError(`Invalid value for ${k}`)
      clean[k] = input[k]
    }
    clean.updatedAt = Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now()
    await storage.setSetting(PREFS_KEY(req.user.id), JSON.stringify(clean))
    res.json({ ok: true })
  }),
)

// ------------------------------------------------------------- generic items

const MAX_RANGE_ITEMS = 1000

lifeRouter.get(
  '/life/items',
  wrap(async (req, res) => {
    const kind = String(req.query.kind ?? '')
    if (!KINDS[kind]) throw new ValidationError('Unknown kind')
    const from = req.query.from ? String(req.query.from).slice(0, 20) : undefined
    const to = req.query.to ? String(req.query.to).slice(0, 20) : undefined
    const items = await storage.listLifeItems(req.user.id, kind, { from, to, limit: MAX_RANGE_ITEMS })
    res.json({ items })
  }),
)

lifeRouter.post(
  '/life/items',
  rateLimit({ windowMs: 60_000, max: 120, message: 'Slow down a little — too many changes at once.' }),
  wrap(async (req, res) => {
    const { kind, data } = req.body ?? {}
    if (!KINDS[kind]) throw new ValidationError('Unknown kind')
    const def = KINDS[kind]
    const existing = await storage.listLifeItems(req.user.id, kind, { limit: def.max + 1 })
    if (existing.length >= def.max) throw new ValidationError(`You have reached the limit for this item type (${def.max}).`)
    const { data: clean, when_key } = sanitizeItem(kind, data)
    // Singleton kinds (budget, wellbeing_prefs) reuse a fixed id.
    const id = def.max === 1 ? `${kind}_main` : `${kind}_${randomUUID().slice(0, 12)}`
    await storage.upsertLifeItem(req.user.id, { id, kind, data: clean, when_key })
    res.status(201).json({ item: await storage.getLifeItem(req.user.id, id) })
  }),
)

lifeRouter.patch(
  '/life/items/:id',
  rateLimit({ windowMs: 60_000, max: 240, message: 'Slow down a little — too many changes at once.' }),
  wrap(async (req, res) => {
    const prev = await storage.getLifeItem(req.user.id, req.params.id)
    if (!prev) return res.status(404).json({ error: 'Not found' })
    const { data: clean, when_key } = sanitizeItem(prev.kind, req.body?.data ?? {}, prev.data)
    await storage.upsertLifeItem(req.user.id, { id: prev.id, kind: prev.kind, data: clean, when_key })
    res.json({ item: await storage.getLifeItem(req.user.id, prev.id) })
  }),
)

lifeRouter.delete(
  '/life/items/:id',
  wrap(async (req, res) => {
    const ok = await storage.deleteLifeItem(req.user.id, req.params.id)
    res.json({ ok })
  }),
)

// -------------------------------------------------------------------- My Day

lifeRouter.get(
  '/life/day',
  wrap(async (req, res) => {
    const day = String(req.query.date ?? '')
    if (!isDate(day)) throw new ValidationError('date must be YYYY-MM-DD')
    const uid = req.user.id
    const [tasks, events, goals, focus, reflections] = await Promise.all([
      storage.listLifeItems(uid, 'task', { limit: 3000 }),
      storage.listLifeItems(uid, 'event', { limit: 3000 }),
      storage.listLifeItems(uid, 'goal', { limit: 200 }),
      storage.listLifeItems(uid, 'focus', { from: day, to: day, limit: 200 }),
      storage.listLifeItems(uid, 'reflection', { from: day, to: day, limit: 10 }),
    ])
    const todaysTasks = tasks
      .filter((t) => occursOn(t.data, day))
      .map((t) => ({ ...t, doneToday: t.data.recurring === 'none' ? t.data.done : t.data.doneDates.includes(day) }))
    const todaysEvents = events.filter((e) => occursOn(e.data, day))
    const blocks = dayBlocks(day, { events, tasks })
    // Open, undated tasks and overdue one-off tasks surface in an inbox so
    // nothing silently disappears.
    const inbox = tasks.filter(
      (t) => !t.data.done && ((!t.data.date) || (t.data.recurring === 'none' && t.data.date < day)),
    )
    res.json({
      date: day,
      tasks: todaysTasks,
      events: todaysEvents,
      inbox,
      conflicts: findConflicts(blocks),
      freeSlots: freeSlots(blocks).map((s) => ({ start: minToTime(s.start), end: minToTime(s.end) })),
      busyMinutes: busyMinutes(blocks),
      focusMinutes: focus.reduce((n, f) => n + f.data.minutes, 0),
      goals: goals.filter((g) => g.data.status === 'active'),
      reflections,
    })
  }),
)

// ------------------------------------------------------------------ My Money

lifeRouter.get(
  '/life/money',
  wrap(async (req, res) => {
    const today = String(req.query.date ?? '')
    if (!isDate(today)) throw new ValidationError('date must be YYYY-MM-DD')
    const uid = req.user.id
    const [budgetRows, expenses, savings] = await Promise.all([
      storage.listLifeItems(uid, 'budget', { limit: 1 }),
      storage.listLifeItems(uid, 'expense', { limit: 3000 }),
      storage.listLifeItems(uid, 'saving', { limit: 200 }),
    ])
    const budget = budgetRows[0]?.data ?? null
    const summary = monthSummary({ budget, expenses, savings, today })
    const plans = savings.map((s) => ({
      ...s,
      saved: contributed(s.data),
      plan: planSaving({ target: s.data.targetAmount, saved: contributed(s.data), today, due: s.data.dueDate, available: summary.availableAfterPlan }),
    }))
    res.json({ budget, summary, expenses, savings: plans })
  }),
)

// Pure what-if: no data is written and no credits are used.
lifeRouter.post(
  '/life/money/check',
  wrap(async (req, res) => {
    const { target, due, today, saved = 0 } = req.body ?? {}
    if (!isDate(due) || !isDate(today)) throw new ValidationError('Dates must be YYYY-MM-DD')
    const t = Number(target)
    if (!Number.isFinite(t) || t <= 0) throw new ValidationError('target must be a positive number')
    const budgetRows = await storage.listLifeItems(req.user.id, 'budget', { limit: 1 })
    const expenses = await storage.listLifeItems(req.user.id, 'expense', { limit: 3000 })
    const savings = await storage.listLifeItems(req.user.id, 'saving', { limit: 200 })
    const summary = monthSummary({ budget: budgetRows[0]?.data ?? null, expenses, savings, today })
    res.json({ plan: planSaving({ target: t, saved: Number(saved) || 0, today, due, available: summary.availableAfterPlan }) })
  }),
)

// ------------------------------------------------------------ credits & usage

lifeRouter.get(
  '/life/credits',
  wrap(async (req, res) => {
    res.json(await credits.accountSummary(req.user.id))
  }),
)

// ------------------------------------------------------------------ companion
//
// Natural language -> a *proposal* of structured actions. Nothing is saved
// until the user confirms (POST /life/companion/apply), and the confirmed
// actions are re-validated here from scratch — the model's output is treated
// as untrusted input, never as instructions.

const ACTION_KINDS = ['task', 'event', 'saving', 'goal']

const PLAN_PROMPT = (today, nowTime) =>
  `You turn a person's plain-language description of their day or plans into structured actions for a planner app.
Today's date is ${today}; the current local time is ${nowTime}.
Reply with ONLY a JSON object, no prose, no code fences:
{"summary": "one friendly sentence", "actions": [ ... ]}
Each action is one of:
{"type":"event","title":str,"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","eventType":"lecture|meeting|deadline|group|personal|study|errand"}
{"type":"task","title":str,"date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"durationMin":int|null}
{"type":"saving","title":str,"targetAmount":number,"dueDate":"YYYY-MM-DD","currency":"TZS"}
{"type":"goal","title":str,"dueDate":"YYYY-MM-DD"|null}
Rules: use 24-hour times; never invent facts the person did not state; if no time is given for a task leave time null; if a duration is not given use null (do not guess long ones); an hour of study is a task with durationMin 60; resolve words like "tomorrow" or "in two weeks" from today's date; at most 12 actions. If the text contains no plannable item return {"summary":"","actions":[]}.`

function extractJson(text) {
  if (!text) return null
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Turns one model-proposed action into a validated, storable shape or null. */
function normaliseAction(a, today) {
  if (!a || typeof a !== 'object' || !ACTION_KINDS.includes(a.type)) return null
  try {
    if (a.type === 'event') {
      if (!isTime(a.start) || !isTime(a.end)) return null
      const { data } = sanitizeItem('event', { title: a.title, type: a.eventType, date: a.date ?? today, start: a.start, end: a.end })
      return { type: 'event', kind: 'event', data }
    }
    if (a.type === 'task') {
      const { data } = sanitizeItem('task', {
        title: a.title,
        date: a.date ?? (a.time ? today : null),
        time: a.time || null,
        durationMin: a.durationMin || null,
      })
      return { type: 'task', kind: 'task', data }
    }
    if (a.type === 'saving') {
      const { data } = sanitizeItem('saving', { title: a.title, targetAmount: a.targetAmount, dueDate: a.dueDate, currency: a.currency || 'TZS' })
      return { type: 'saving', kind: 'saving', data }
    }
    const { data } = sanitizeItem('goal', { title: a.title, dueDate: a.dueDate || null })
    return { type: 'goal', kind: 'goal', data }
  } catch {
    return null // one bad action must not poison the rest
  }
}

lifeRouter.post(
  '/life/companion/plan',
  rateLimit({ windowMs: 60_000, max: 12, message: 'Give the assistant a moment, then try again.' }),
  wrap(async (req, res) => {
    const text = String(req.body?.text ?? '').trim().slice(0, 1500)
    const today = String(req.body?.date ?? '')
    const nowTime = isTime(req.body?.time) ? req.body.time : '09:00'
    if (!text) throw new ValidationError('Tell me what you have planned.')
    if (!isDate(today)) throw new ValidationError('date must be YYYY-MM-DD')

    const idemKey = String(req.body?.idemKey || randomUUID()).slice(0, 80)
    const reservation = await credits.reserve(req.user.id, { feature: 'companion_plan', idemKey })
    if (!reservation.ok) {
      const status = reservation.code === 'insufficient_credits' ? 402 : reservation.code === 'duplicate' ? 409 : 503
      return res.status(status).json({ code: reservation.code, error: reservation.message, balance: reservation.balance })
    }

    let raw
    try {
      raw = await complete({
        model: 'bermi-fast',
        maxTokens: 900,
        messages: [
          { role: 'system', content: PLAN_PROMPT(today, nowTime) },
          { role: 'user', content: text },
        ],
      })
    } catch (err) {
      await credits.refund(req.user.id, reservation, `provider error: ${err.message}`)
      return res.status(502).json({
        code: 'ai_unavailable',
        error: err.friendly || 'The assistant could not be reached just now. Your credits were not used.',
        retryAfter: err.retryAfter ?? null,
        refunded: true,
      })
    }
    if (raw == null) {
      await credits.refund(req.user.id, reservation, 'no provider configured')
      return res.status(503).json({ code: 'ai_unavailable', error: 'AI is not configured on this server. You can still add items yourself — your credits were not used.', refunded: true })
    }

    const parsed = extractJson(raw)
    const proposed = (Array.isArray(parsed?.actions) ? parsed.actions : []).slice(0, 12).map((a) => normaliseAction(a, today)).filter(Boolean)
    if (!proposed.length) {
      await credits.refund(req.user.id, reservation, 'no usable actions')
      return res.json({ summary: '', actions: [], conflicts: [], refunded: true, message: "I couldn't find anything to schedule in that. Try mentioning what, and roughly when." })
    }

    // Deterministic conflict check against what's already planned that day.
    const [events, tasks] = await Promise.all([
      storage.listLifeItems(req.user.id, 'event', { limit: 3000 }),
      storage.listLifeItems(req.user.id, 'task', { limit: 3000 }),
    ])
    const byDay = new Map()
    for (const p of proposed) {
      const d = p.data
      const day = d.date
      if (!day || (p.kind !== 'event' && !d.time)) continue
      const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
      const start = p.kind === 'event' ? toMin(d.start) : toMin(d.time)
      const end = p.kind === 'event' ? toMin(d.end) : Math.min(start + (d.durationMin ?? 30), 1440)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day).push({ title: d.title, type: p.kind, start, end })
    }
    const conflicts = []
    for (const [day, list] of byDay) conflicts.push(...checkProposal(day, { events, tasks }, list).map((c) => ({ ...c, date: day })))

    res.json({
      summary: String(parsed?.summary ?? '').slice(0, 300),
      actions: proposed.map((p, i) => ({ id: `a${i}`, type: p.type, kind: p.kind, data: p.data })),
      conflicts,
      creditsUsed: reservation.cost,
      balance: reservation.balance,
    })
  }),
)

lifeRouter.post(
  '/life/companion/apply',
  rateLimit({ windowMs: 60_000, max: 20, message: 'Too many changes at once.' }),
  wrap(async (req, res) => {
    const actions = Array.isArray(req.body?.actions) ? req.body.actions.slice(0, 12) : []
    if (!actions.length) throw new ValidationError('Nothing to apply')
    const results = []
    for (const a of actions) {
      try {
        if (!ACTION_KINDS.includes(a?.kind)) throw new ValidationError('Unsupported action')
        // Re-validate from scratch: the client could have edited the payload.
        const def = KINDS[a.kind]
        const existing = await storage.listLifeItems(req.user.id, a.kind, { limit: def.max + 1 })
        if (existing.length >= def.max) throw new ValidationError('Limit reached for this item type')
        const { data, when_key } = sanitizeItem(a.kind, a.data)
        const id = `${a.kind}_${randomUUID().slice(0, 12)}`
        await storage.upsertLifeItem(req.user.id, { id, kind: a.kind, data, when_key })
        results.push({ id: a.id ?? id, ok: true, itemId: id })
      } catch (err) {
        if (notProvisioned(err)) throw err
        results.push({ id: a?.id ?? null, ok: false, error: err.message })
      }
    }
    res.json({ results, applied: results.filter((r) => r.ok).length })
  }),
)


// ------------------------------------------------------- learning & content

// Published content only. Faith content is deliberately NOT here — see
// /life/faith/daily, which refuses unless the user opted in.
lifeRouter.get(
  '/life/content',
  wrap(async (req, res) => {
    const day = String(req.query.date ?? '')
    if (!isDate(day)) throw new ValidationError('date must be YYYY-MM-DD')
    const c = await publishedContent()
    const concept = pickDaily(c.concepts, day)
    res.json({
      books: c.books,
      sessions: c.sessions,
      audio: c.audio,
      daily: concept ? { ...concept, book: c.books.find((b) => b.id === concept.bookId) ?? null } : null,
      concepts: c.concepts.map(({ id, bookId, concept: title }) => ({ id, bookId, title })),
    })
  }),
)

lifeRouter.get(
  '/life/concept/:id',
  wrap(async (req, res) => {
    const c = await publishedContent()
    const concept = c.concepts.find((x) => x.id === req.params.id)
    if (!concept) return res.status(404).json({ error: 'Not found' })
    res.json({ concept: { ...concept, book: c.books.find((b) => b.id === concept.bookId) ?? null } })
  }),
)

lifeRouter.get(
  '/life/faith/daily',
  wrap(async (req, res) => {
    const day = String(req.query.date ?? '')
    if (!isDate(day)) throw new ValidationError('date must be YYYY-MM-DD')
    const prefs = (await storage.listLifeItems(req.user.id, 'wellbeing_prefs', { limit: 1 }))[0]?.data
    if (!prefs?.faithEnabled) return res.status(403).json({ code: 'faith_not_enabled', error: 'Faith content is switched off. You can turn it on in My Wellbeing.' })
    const c = await publishedContent()
    const verse = pickDaily(c.verses.filter((v) => v.tradition === prefs.faithTradition), day)
    // Honest empty state: no licensed text for this tradition yet.
    res.json({ tradition: prefs.faithTradition, verse: verse ?? null })
  }),
)

// Deterministic study planner: places study sessions into the free time of
// the next 7 days, inside the learner's preferred window. No AI, no credits.
lifeRouter.post(
  '/life/learning/plan-sessions',
  wrap(async (req, res) => {
    const { subject, hoursPerWeek, from, windowStart, windowEnd, sessionMin = 50 } = req.body ?? {}
    const title = String(subject ?? '').trim().slice(0, 120)
    if (!title) throw new ValidationError('What are you studying?')
    if (!isDate(from)) throw new ValidationError('from must be YYYY-MM-DD')
    if (!isTime(windowStart) || !isTime(windowEnd)) throw new ValidationError('Choose a study window')
    const hours = Number(hoursPerWeek)
    if (!Number.isFinite(hours) || hours <= 0 || hours > 40) throw new ValidationError('Hours per week must be between 1 and 40')
    const len = Math.max(20, Math.min(120, Math.round(Number(sessionMin) || 50)))
    const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    const [events, tasks] = await Promise.all([
      storage.listLifeItems(req.user.id, 'event', { limit: 3000 }),
      storage.listLifeItems(req.user.id, 'task', { limit: 3000 }),
    ])
    let remaining = Math.round(hours * 60)
    const wanted = Math.ceil(remaining / len)
    const actions = []
    const day0 = new Date(`${from}T00:00:00Z`)
    // Spread sessions across the week: at most 2 per day, earliest days first,
    // alternating days when the load is light so it isn't front-loaded.
    const perDayCap = wanted > 7 ? 2 : 1
    for (let i = 0; i < 7 && remaining > 0; i++) {
      const d = new Date(day0.getTime() + i * 86_400_000).toISOString().slice(0, 10)
      const blocks = dayBlocks(d, { events, tasks: [...tasks, ...actions.map((a, n) => ({ id: `p${n}`, data: a.data }))] })
      const slots = freeSlots(blocks, { from: toMin(windowStart), to: toMin(windowEnd), minLen: 20 })
      let placed = 0
      for (const slot of slots) {
        if (remaining <= 0 || placed >= perDayCap) break
        const dur = Math.min(len, remaining, slot.end - slot.start)
        if (dur < 20) continue
        const { data } = sanitizeItem('task', { title: `Study: ${title}`, date: d, time: minToTime(slot.start), durationMin: dur, priority: 1 })
        actions.push({ id: `s${actions.length}`, type: 'task', kind: 'task', data })
        remaining -= dur
        placed++
      }
    }
    res.json({
      actions,
      plannedMinutes: Math.round(hours * 60) - Math.max(remaining, 0),
      shortfallMinutes: Math.max(remaining, 0),
      message: remaining > 0
        ? `Only ${Math.round((hours * 60 - remaining) / 6) / 10} of ${hours} hours fit in your free time this week. Widen your study window or free up time.`
        : null,
    })
  }),
)

const KIT_PROMPT = `You create study materials from the learner's own notes.
Reply with ONLY a JSON object, no prose, no code fences:
{"summary": str (<=900 chars), "keyPoints": [str x4-8], "flashcards": [{"q": str, "a": str} x6-15], "quiz": [{"q": str, "options": [str,str,str,str], "answer": 0-3, "explain": str} x4-8]}
STRICT RULES: use ONLY information contained in the notes. Do not add outside facts, examples, numbers, names or quotations. If the notes are too thin for a section, return fewer items rather than inventing any. Exactly one option per quiz question is correct and "answer" is its index.`

lifeRouter.post(
  '/life/notes/:id/study-kit',
  rateLimit({ windowMs: 60_000, max: 6, message: 'Give the assistant a moment, then try again.' }),
  wrap(async (req, res) => {
    const note = await storage.getLifeItem(req.user.id, req.params.id)
    if (!note || note.kind !== 'note') return res.status(404).json({ error: 'Note not found' })
    const body = note.data.body.trim()
    if (body.length < 200) throw new ValidationError('Add a bit more to this note first — at least a few sentences.')

    const idemKey = String(req.body?.idemKey || randomUUID()).slice(0, 80)
    const reservation = await credits.reserve(req.user.id, { feature: 'study_materials', idemKey })
    if (!reservation.ok) {
      const status = reservation.code === 'insufficient_credits' ? 402 : reservation.code === 'duplicate' ? 409 : 503
      return res.status(status).json({ code: reservation.code, error: reservation.message, balance: reservation.balance })
    }
    let raw
    try {
      raw = await complete({
        model: 'bermi-core',
        maxTokens: 2200,
        messages: [
          { role: 'system', content: KIT_PROMPT },
          { role: 'user', content: `Title: ${note.data.title}\n\nNotes:\n${body.slice(0, 12_000)}` },
        ],
      })
    } catch (err) {
      await credits.refund(req.user.id, reservation, `provider error: ${err.message}`)
      return res.status(502).json({ code: 'ai_unavailable', error: err.friendly || 'The assistant could not be reached just now. Your credits were not used.', refunded: true, retryAfter: err.retryAfter ?? null })
    }
    if (raw == null) {
      await credits.refund(req.user.id, reservation, 'no provider configured')
      return res.status(503).json({ code: 'ai_unavailable', error: 'AI is not configured on this server. Your note is safe and your credits were not used.', refunded: true })
    }
    const kit = (() => {
      const parsed = extractJson(raw)
      return parsed ? sanitizeKit({ ...parsed, generatedAt: new Date().toISOString() }) : null
    })()
    if (!kit || (!kit.flashcards.length && !kit.quiz.length && !kit.summary)) {
      await credits.refund(req.user.id, reservation, 'unusable output')
      return res.status(502).json({ code: 'ai_bad_output', error: "The assistant's answer couldn't be used this time. Your credits were not used — please try again.", refunded: true })
    }
    const { data, when_key } = sanitizeItem('note', { kit }, note.data)
    await storage.upsertLifeItem(req.user.id, { id: note.id, kind: 'note', data, when_key })
    res.json({ item: await storage.getLifeItem(req.user.id, note.id), creditsUsed: reservation.cost })
  }),
)

lifeRouter.get('/life/push/status', (_req, res) => {
  // Push needs VAPID keys + a scheduler that can run every minute. Neither is
  // provisioned, so the UI must not promise background delivery.
  res.json({ configured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), scheduler: false })
})

// ------------------------------------------------------------- summary export

export async function exportLifeData(userId) {
  const out = {}
  for (const kind of KIND_NAMES) {
    try {
      out[kind] = (await storage.listLifeItems(userId, kind, { limit: 10_000 })).map((i) => ({ id: i.id, ...i.data }))
    } catch {
      out[kind] = []
    }
  }
  return out
}
