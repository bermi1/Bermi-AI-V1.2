import { Router } from 'express'
import { storage } from '../storage/index.js'
import { isAdmin } from './admin.js'
import { providerHealth, testProviders } from '../openrouter.js'
import * as credits from '../credits.js'
import { allContent, saveOverride } from '../life/content.js'
import { sourceHealth, refreshRegistry, setSourceDisabled } from '../briefing/index.js'

// "Bermi Control": the operational admin layer. Authorisation is enforced HERE,
// on the server, per endpoint — hiding a button in the UI is never the control.
//
// Privacy by construction: nothing in this file reads life_items content
// (journals, mood, money plans, faith or cycle data, notes). Admins get
// aggregates and account/credit data only.

export const admin2Router = Router()

const ROLE_PERMS = {
  super: ['*'],
  operations: ['metrics.read', 'ai.read', 'ai.write', 'users.read', 'content.read', 'content.write', 'content.publish', 'audit.read'],
  support: ['metrics.read', 'users.read', 'credits.read', 'credits.adjust_small'],
  content: ['content.read', 'content.write'], // can draft and submit for review, not publish
  finance: ['metrics.read', 'users.read', 'credits.read', 'credits.adjust', 'plans.write', 'entitlements.write', 'audit.read'],
  analytics: ['metrics.read'],
}
const SMALL_ADJUST_LIMIT = 50
const PRIVATE_KINDS = new Set(['cycle', 'wellbeing_prefs', 'mood', 'gratitude', 'reflection', 'session', 'note', 'profile', 'notify_prefs', 'budget', 'expense', 'saving', 'idea', 'cycle', 'briefing_prefs', 'feed_saved'])

async function roleOf(user) {
  if (isAdmin(user)) return 'super' // the owner allowlist always keeps full access
  try {
    const raw = await storage.getSetting('admin_roles')
    const map = raw ? JSON.parse(raw) : {}
    const role = map[String(user?.email ?? '').toLowerCase()]
    return ROLE_PERMS[role] ? role : null
  } catch {
    return null
  }
}
const can = (role, perm) => Boolean(role) && (ROLE_PERMS[role].includes('*') || ROLE_PERMS[role].includes(perm))

const guard = (perm, fn) => async (req, res, next) => {
  try {
    const role = await roleOf(req.user)
    if (!can(role, perm)) return res.status(403).json({ error: 'You do not have permission to do that.' })
    await fn(req, res, role)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}
const bad = (msg) => Object.assign(new Error(msg), { status: 400 })
const audit = (req, action, target, meta) => storage.auditLog({ actor: req.user.email, action, target, meta })

admin2Router.get('/admin/ctl/me', async (req, res, next) => {
  try {
    const role = await roleOf(req.user)
    res.json({ role, perms: role ? ROLE_PERMS[role] : [] })
  } catch (err) {
    next(err)
  }
})

// -------------------------------------------------------------------- metrics

admin2Router.get('/admin/ctl/metrics', guard('metrics.read', async (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 7))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const [stats, activity, adoption, usage, outcomes] = await Promise.all([
    storage.adminStats(),
    storage.adminActivity().catch(() => null),
    // Distinct-user counts per feature. Kinds that describe health, faith or
    // private reflection are left out entirely, even as aggregates.
    storage.lifeAdoption().then((rows) => rows.filter((r) => !PRIVATE_KINDS.has(r.kind))).catch(() => null), // null → life tables not provisioned yet
    storage.creditUsageByFeature(since).catch(() => null),
    storage.creditOutcomes(since).catch(() => null),
  ])
  const unavailable = (reason) => ({ available: false, reason })
  res.json({
    days,
    platform: stats,
    activity,
    adoption: adoption ?? unavailable('Life OS tables are not provisioned on this server yet.'),
    ai: usage
      ? {
          available: true,
          byFeature: usage,
          creditsSpent: usage.reduce((n, u) => n + u.spent, 0),
          outcomes, // requests vs provider-failure refunds, per feature
        }
      : unavailable('Credit ledger is not provisioned yet.'),
    // These need a payment provider / subscription system, which is not
    // connected — shown as unavailable rather than invented.
    revenue: unavailable('No payment provider is connected.'),
    conversion: unavailable('No payment provider is connected.'),
    churn: unavailable('No payment provider is connected.'),
    support: unavailable('No support inbox is connected.'),
  })
}))

// ---------------------------------------------------------------- AI controls

admin2Router.get('/admin/ctl/ai', guard('ai.read', async (_req, res) => {
  const [disabled, cap, health, ent] = await Promise.all([
    storage.getSetting('ai_emergency_disabled'),
    storage.getSetting('ai_daily_credit_cap'),
    providerHealth().catch(() => null),
    credits.getEntitlements(),
  ])
  res.json({ disabled: disabled === '1', dailyCap: Number(cap) > 0 ? Number(cap) : null, providers: health, entitlements: ent })
}))

// One tiny live request per key per provider, so "AI is down" becomes a diagnosis.
admin2Router.post('/admin/ctl/ai/test', guard('ai.write', async (req, res) => {
  const results = await testProviders()
  await audit(req, 'ai.test', null, { working: results.map((r) => `${r.provider}:${r.workingKeys}/${r.keys.length}`) })
  res.json({ results, anyWorking: results.some((r) => r.workingKeys > 0) })
}))

// Briefing source registry: which of the 100+ feeds are actually answering.
admin2Router.get('/admin/ctl/briefing/sources', guard('ai.read', async (_req, res) => {
  const sources = await sourceHealth()
  const count = (s) => sources.filter((x) => x.status === s).length
  res.json({ sources, summary: { total: sources.length, ok: count('ok'), degraded: count('degraded'), failing: count('failing'), untested: count('untested'), linkOnly: count('link-only') } })
}))

admin2Router.post('/admin/ctl/briefing/refresh', guard('ai.write', async (req, res) => {
  const results = await refreshRegistry({ budgetMs: 40_000 })
  await audit(req, 'briefing.refresh', null, results)
  res.json({ results })
}))

admin2Router.post('/admin/ctl/briefing/source', guard('ai.write', async (req, res) => {
  const { id, disabled } = req.body ?? {}
  if (typeof id !== 'string') throw bad('Pick a source.')
  let list
  try {
    list = await setSourceDisabled(id, Boolean(disabled))
  } catch (e) {
    throw bad(e.message)
  }
  await audit(req, disabled ? 'briefing.source.disable' : 'briefing.source.enable', id, null)
  res.json({ ok: true, disabled: list })
}))

admin2Router.post('/admin/ctl/ai/kill', guard('ai.write', async (req, res) => {
  const disabled = Boolean(req.body?.disabled)
  await storage.setSetting('ai_emergency_disabled', disabled ? '1' : '0')
  await audit(req, disabled ? 'ai.disable' : 'ai.enable', null, null)
  res.json({ ok: true, disabled })
}))

admin2Router.post('/admin/ctl/ai/cap', guard('ai.write', async (req, res) => {
  const v = req.body?.dailyCap
  if (v === null || v === '' || Number(v) === 0) {
    await storage.setSetting('ai_daily_credit_cap', '0')
    await audit(req, 'ai.cap', null, { dailyCap: null })
    return res.json({ ok: true, dailyCap: null })
  }
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 10_000_000) throw bad('Cap must be a whole number of credits per day.')
  await storage.setSetting('ai_daily_credit_cap', String(n))
  await audit(req, 'ai.cap', null, { dailyCap: n })
  res.json({ ok: true, dailyCap: n })
}))

// ---------------------------------------------------- entitlements & credits

admin2Router.put('/admin/ctl/entitlements', guard('entitlements.write', async (req, res) => {
  const { plans, costs } = req.body ?? {}
  const out = { plans: {}, costs: {} }
  for (const [id, p] of Object.entries(plans ?? {})) {
    if (!/^[a-z][a-z0-9_]{1,20}$/.test(id)) throw bad(`Invalid plan id: ${id}`)
    const m = Number(p?.monthlyCredits)
    if (!Number.isInteger(m) || m < 0 || m > 1_000_000) throw bad(`Monthly credits for ${id} must be a whole number`)
    out.plans[id] = { label: String(p?.label ?? id).slice(0, 40), monthlyCredits: m }
  }
  for (const [f, c] of Object.entries(costs ?? {})) {
    const n = Number(c)
    if (!credits.DEFAULT_ENTITLEMENTS.costs[f]) throw bad(`Unknown feature: ${f}`)
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw bad(`Cost for ${f} must be a whole number between 1 and 1000`)
    out.costs[f] = n
  }
  await storage.setSetting('entitlements', JSON.stringify(out))
  await audit(req, 'entitlements.update', null, out)
  res.json({ ok: true, entitlements: await credits.getEntitlements() })
}))

admin2Router.get('/admin/ctl/users', guard('users.read', async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase().slice(0, 80)
  const users = await storage.listUsers()
  const matches = users
    .filter((u) => !q || u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
    .slice(0, 25)
  const ent = await credits.getEntitlements()
  const rows = await Promise.all(
    matches.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      created_at: u.created_at,
      plan: await credits.getPlanId(u.id),
      balance: await storage.creditBalance(u.id).catch(() => null),
    })),
  )
  res.json({ users: rows, plans: Object.entries(ent.plans).map(([id, p]) => ({ id, label: p.label })) })
}))

admin2Router.get('/admin/ctl/users/:id/credits', guard('credits.read', async (req, res) => {
  res.json({ balance: await storage.creditBalance(req.params.id), ledger: await storage.creditLedger(req.params.id, 50) })
}))

admin2Router.post('/admin/ctl/credits/adjust', guard('credits.adjust_small', async (req, res, role) => {
  const { userId, amount, reason } = req.body ?? {}
  const n = Number(amount)
  if (!userId || !Number.isInteger(n) || n === 0 || Math.abs(n) > 1_000_000) throw bad('Enter a whole, non-zero number of credits.')
  if (!String(reason ?? '').trim()) throw bad('A reason is required — it goes in the audit log.')
  // Support staff may only make small corrections; larger changes need finance.
  if (role === 'support' && Math.abs(n) > SMALL_ADJUST_LIMIT) {
    return res.status(403).json({ error: `Support can adjust up to ${SMALL_ADJUST_LIMIT} credits. Ask a finance manager for larger changes.` })
  }
  const r = await credits.adjust(req.user.email, userId, n, reason)
  if (!r.ok) throw bad('That would take the balance below zero.')
  res.json({ ok: true, balance: r.balance })
}))

admin2Router.post('/admin/ctl/plan', guard('plans.write', async (req, res) => {
  const { userId, plan } = req.body ?? {}
  const ent = await credits.getEntitlements()
  if (!userId || !ent.plans[plan]) throw bad('Unknown user or plan.')
  await storage.setSetting(`u:${userId}:plan`, plan)
  await audit(req, 'plan.set', userId, { plan })
  res.json({ ok: true })
}))

admin2Router.get('/admin/ctl/audit', guard('audit.read', async (_req, res) => {
  res.json({ entries: await storage.listAudit(150) })
}))

// ------------------------------------------------------------------- content

const COLLECTIONS = {
  books: { required: ['title', 'author'], strings: { title: 160, author: 120, publisher: 160, blurb: 600, license: 300, sourceUrl: 400 }, numbers: ['year'] },
  concepts: { required: ['bookId', 'concept', 'explanation'], strings: { bookId: 60, concept: 160, explanation: 1500, example: 800, action: 400, reflection: 300, source: 200, scheduledFor: 10 }, arrays: ['takeaways'] },
  verses: { required: ['tradition', 'reference', 'text', 'translation', 'license'], strings: { tradition: 20, reference: 80, text: 1500, translation: 80, license: 400, prompt: 300 } },
  sessions: { required: ['title', 'type', 'minutes'], strings: { title: 120, type: 20, blurb: 300, source: 200 }, numbers: ['minutes'], arrays: ['steps'] },
  audiobooks: { required: ['title', 'author', 'archiveId', 'category', 'license'], strings: { title: 160, author: 120, archiveId: 100, category: 20, narrator: 120, blurb: 500, license: 300, sourceUrl: 400 }, numbers: ['year', 'minutes'] },
  audio: { required: ['title', 'url', 'license'], strings: { title: 160, author: 120, url: 500, license: 400, attribution: 300, category: 40 }, numbers: ['minutes'] },
}
const STATUSES = ['draft', 'review', 'published']

function cleanContent(collection, input) {
  const spec = COLLECTIONS[collection]
  if (!spec) throw bad('Unknown collection')
  const out = {}
  for (const [k, max] of Object.entries(spec.strings)) {
    if (input[k] != null) out[k] = String(input[k]).trim().slice(0, max)
  }
  for (const k of spec.numbers ?? []) if (input[k] != null && input[k] !== '') out[k] = Number(input[k])
  for (const k of spec.arrays ?? []) if (input[k] != null) out[k] = (Array.isArray(input[k]) ? input[k] : []).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 20)
  for (const k of spec.required) if (out[k] == null || out[k] === '' || (typeof out[k] === 'number' && !Number.isFinite(out[k]))) throw bad(`${k} is required`)
  if (collection === 'verses' && !['christian', 'muslim', 'other'].includes(out.tradition)) throw bad('Unknown tradition')
  if (collection === 'audio' && !/^https:\/\//.test(out.url)) throw bad('Audio URL must be https')
  if (collection === 'audiobooks' && !/^[A-Za-z0-9._-]{3,100}$/.test(out.archiveId)) throw bad('archiveId must be an Internet Archive identifier')
  if (out.scheduledFor && !/^\d{4}-\d{2}-\d{2}$/.test(out.scheduledFor)) throw bad('scheduledFor must be YYYY-MM-DD')
  return out
}

admin2Router.get('/admin/ctl/content', guard('content.read', async (_req, res) => {
  res.json(await allContent())
}))

admin2Router.put('/admin/ctl/content/:collection/:id', guard('content.write', async (req, res, role) => {
  const { collection, id } = req.params
  if (!/^[a-z0-9][a-z0-9-_]{1,60}$/.test(id)) throw bad('Invalid id')
  const existing = (await allContent())[collection]?.find((x) => x.id === id)
  const merged = { ...(existing ?? {}), ...(req.body ?? {}) }
  const item = cleanContent(collection, merged)
  const status = STATUSES.includes(req.body?.status) ? req.body.status : (existing?.status ?? 'draft')
  // Approval workflow: anyone with write access can draft or request review;
  // only roles with publish permission can make something live (or edit what
  // is already live without pulling it back to review).
  if ((status === 'published' || existing?.status === 'published') && !can(role, 'content.publish')) {
    if (status === 'published') throw Object.assign(new Error('Only a reviewer can publish. Submit it for review instead.'), { status: 403 })
    return res.status(403).json({ error: 'This item is live. Ask a reviewer to change it.' })
  }
  // `deleted: false` so re-creating an id that was deleted earlier brings it back.
  const saved = { ...item, id, status, deleted: false, updatedBy: req.user.email, updatedAt: new Date().toISOString() }
  await saveOverride(collection, saved)
  await audit(req, 'content.save', `${collection}/${id}`, { status })
  res.json({ ok: true, item: saved })
}))

admin2Router.delete('/admin/ctl/content/:collection/:id', guard('content.publish', async (req, res) => {
  const { collection, id } = req.params
  await saveOverride(collection, { id, deleted: true })
  await audit(req, 'content.delete', `${collection}/${id}`, null)
  res.json({ ok: true })
}))

// --------------------------------------------------------------------- roles

admin2Router.get('/admin/ctl/roles', guard('*', async (_req, res) => {
  const raw = await storage.getSetting('admin_roles')
  res.json({ roles: raw ? JSON.parse(raw) : {}, available: Object.keys(ROLE_PERMS).filter((r) => r !== 'super') })
}))

admin2Router.put('/admin/ctl/roles', guard('*', async (req, res) => {
  const input = req.body?.roles ?? {}
  const out = {}
  for (const [email, role] of Object.entries(input)) {
    const e = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad(`Invalid email: ${email}`)
    if (!ROLE_PERMS[role] || role === 'super') throw bad(`Invalid role for ${e}`)
    out[e] = role
  }
  await storage.setSetting('admin_roles', JSON.stringify(out))
  await audit(req, 'roles.update', null, out)
  res.json({ ok: true, roles: out })
}))
