process.env.ADMIN_EMAILS = 'boss@example.com'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sanitizeItem, ValidationError } from '../src/life/kinds.js'
import { occursOn, dayBlocks, findConflicts, freeSlots, busyMinutes, checkProposal } from '../src/life/schedule.js'
import { planSaving, monthSummary } from '../src/life/money.js'

// ---------------------------------------------------------------- validation

test('task validation clamps, rejects bad dates and requires a title', () => {
  const ok = sanitizeItem('task', { title: '  Finish assignment  ', date: '2026-11-02', time: '09:30', durationMin: 90 })
  assert.equal(ok.data.title, 'Finish assignment')
  assert.equal(ok.when_key, '2026-11-02T09:30')
  assert.throws(() => sanitizeItem('task', { title: '' }), ValidationError)
  assert.throws(() => sanitizeItem('task', { title: 'x', date: '2026-02-31' }), /valid YYYY-MM-DD/)
  assert.throws(() => sanitizeItem('task', { title: 'x', time: '25:00', date: '2026-11-02' }), /HH:MM/)
  assert.throws(() => sanitizeItem('task', { title: 'x', time: '09:00' }), /needs a date/)
})

test('event must end after it starts; unknown kinds are rejected', () => {
  assert.throws(() => sanitizeItem('event', { title: 'Lecture', date: '2026-11-02', start: '10:00', end: '09:00' }), /end after/)
  assert.throws(() => sanitizeItem('nonsense', {}), /Unknown kind/)
})

test('unknown fields are dropped and enums are enforced', () => {
  const r = sanitizeItem('mood', { date: '2026-11-02', mood: 4, evil: '<script>' })
  assert.equal('evil' in r.data, false)
  assert.throws(() => sanitizeItem('mood', { date: '2026-11-02', mood: 9 }), /between 1 and 5/)
  assert.throws(() => sanitizeItem('task', { title: 'x', recurring: 'hourly', date: '2026-11-02' }), /one of/)
})

test('savings are plans: amounts must be positive and contributions are validated', () => {
  assert.throws(() => sanitizeItem('saving', { title: 'Trip', targetAmount: -5, dueDate: '2026-12-01' }), /between/)
  const ok = sanitizeItem('saving', { title: 'Trip', targetAmount: 40000, dueDate: '2026-12-01', contributions: [{ date: '2026-11-01', amount: 5000 }] })
  assert.equal(ok.data.currency, 'TZS')
  assert.equal(ok.data.contributions.length, 1)
})

// ------------------------------------------------------------------ schedule

test('recurrence: weekdays skip weekends, weekly repeats on the same weekday', () => {
  const t = { date: '2026-11-02', recurring: 'weekdays' } // Monday
  assert.equal(occursOn(t, '2026-11-06'), true) // Fri
  assert.equal(occursOn(t, '2026-11-07'), false) // Sat
  assert.equal(occursOn(t, '2026-11-01'), false) // before start
  const w = { date: '2026-11-02', recurring: 'weekly' }
  assert.equal(occursOn(w, '2026-11-09'), true)
  assert.equal(occursOn(w, '2026-11-10'), false)
})

test('conflicts are computed deterministically, touching blocks do not conflict', () => {
  const ev = (id, start, end) => ({ id, data: { date: '2026-11-02', start, end, title: id, type: 'meeting', recurring: 'none' } })
  const blocks = dayBlocks('2026-11-02', { events: [ev('a', '08:00', '09:00'), ev('b', '09:00', '10:00'), ev('c', '09:30', '10:30')], tasks: [] })
  const c = findConflicts(blocks)
  assert.deepEqual(c.map((x) => [x.a, x.b]).sort(), [['b', 'c']])
  assert.equal(busyMinutes(blocks), 150) // 08:00–10:30, overlap not double counted
  assert.deepEqual(freeSlots(blocks, { from: 7 * 60, to: 12 * 60 }).map((s) => [s.start, s.end]), [[420, 480], [630, 720]])
})

test('proposals are checked against existing items and each other', () => {
  const existing = { events: [{ id: 'e', data: { date: '2026-11-02', start: '08:00', end: '10:00', title: 'Lecture', type: 'lecture', recurring: 'none' } }], tasks: [] }
  const hits = checkProposal('2026-11-02', existing, [{ title: 'Study', start: 9 * 60, end: 10 * 60 }, { title: 'Call', start: 9 * 60 + 30, end: 10 * 60 + 30 }])
  assert.ok(hits.length >= 2)
})

// --------------------------------------------------------------------- money

test('saving plan: realistic check uses what is left after planned spending', () => {
  const p = planSaving({ target: 40000, today: '2026-11-01', due: '2026-11-15', available: 100000 })
  assert.equal(p.days, 14)
  assert.equal(p.perWeek, 20000)
  assert.equal(p.realistic, true)
  const tight = planSaving({ target: 400000, today: '2026-11-01', due: '2026-11-15', available: 20000 })
  assert.equal(tight.realistic, false)
  assert.equal(planSaving({ target: 100, saved: 100, today: '2026-11-01', due: '2026-11-15' }).state, 'reached')
  assert.equal(planSaving({ target: 100, today: '2026-11-20', due: '2026-11-15' }).state, 'overdue')
  assert.equal(planSaving({ target: 100, today: '2026-11-01', due: '2026-11-15' }).realistic, null) // unknown income → no guess
})

test('month summary never invents numbers without an income', () => {
  const s = monthSummary({ budget: null, expenses: [], savings: [], today: '2026-11-10' })
  assert.equal(s.availableAfterPlan, null)
  assert.equal(s.income, 0)
})

// ----------------------------------------------- integration (real app, real DB)

async function boot(emailOverride) {
  const { default: app } = await import('../src/app.js')
  const server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const email = emailOverride ?? `life-${randomUUID().slice(0, 8)}@example.com`
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Life Tester', email, password: 'correct-horse-battery' }),
  })
  const body = await res.json()
  const token = body.token
  assert.ok(token, `signup should return a session token (got ${JSON.stringify(body)})`)
  const api = (path, init = {}) =>
    fetch(`${base}/api${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  return { server, api, user: body.user }
}

test('life API: auth required, prefs round trip, item CRUD, day view with conflicts', async (t) => {
  const { server, api, user } = await boot()
  t.after(() => server.close())

  const anon = await fetch(`${server.address() ? `http://127.0.0.1:${server.address().port}` : ''}/api/life/prefs`)
  assert.equal(anon.status, 401)

  assert.equal((await (await api('/life/prefs')).json()).prefs, null)
  const bad = await api('/life/prefs', { method: 'PUT', body: JSON.stringify({ prefs: { mode: 'neon' } }) })
  assert.equal(bad.status, 400)
  const prefs = { mode: 'dark', accent: 'violet', icon: 'rose', density: 'compact', motion: 'reduce', textSize: 'large', assistant: 'wave', updatedAt: 123 }
  assert.equal((await api('/life/prefs', { method: 'PUT', body: JSON.stringify({ prefs }) })).status, 200)
  assert.deepEqual((await (await api('/life/prefs')).json()).prefs, prefs)

  const mk = async (kind, data) => (await (await api('/life/items', { method: 'POST', body: JSON.stringify({ kind, data }) })).json()).item
  const lecture = await mk('event', { title: 'Lecture', type: 'lecture', date: '2026-11-02', start: '08:00', end: '10:00' })
  await mk('event', { title: 'Group call', type: 'group', date: '2026-11-02', start: '09:00', end: '09:30' })
  const task = await mk('task', { title: 'Assignment', date: '2026-11-02', priority: 2 })
  const day = await (await api('/life/day?date=2026-11-02')).json()
  assert.equal(day.events.length, 2)
  assert.equal(day.conflicts.length, 1, 'overlapping events must be flagged by the server')
  assert.equal(day.tasks.length, 1)

  // PATCH merges and re-validates; completion persists.
  const patched = await (await api(`/life/items/${task.id}`, { method: 'PATCH', body: JSON.stringify({ data: { done: true } }) })).json()
  assert.equal(patched.item.data.done, true)
  assert.equal(patched.item.data.title, 'Assignment')
  const invalid = await api(`/life/items/${task.id}`, { method: 'PATCH', body: JSON.stringify({ data: { date: 'not-a-date' } }) })
  assert.equal(invalid.status, 400)

  // Users cannot read or touch each other's items.
  const other = await boot()
  const stolen = await other.api(`/life/items/${lecture.id}`, { method: 'PATCH', body: JSON.stringify({ data: { title: 'hacked' } }) })
  assert.equal(stolen.status, 404)
  other.server.close()

  assert.equal((await (await api(`/life/items/${lecture.id}`, { method: 'DELETE' })).json()).ok, true)
  assert.ok(user.id)
})

test('credits: monthly grant, atomic reservation under concurrency, idempotency, refunds', async (t) => {
  const { server, api } = await boot()
  t.after(() => server.close())

  const c0 = await (await api('/life/credits')).json()
  assert.equal(c0.balance, c0.monthlyAllowance, 'new users get the plan allowance')
  const again = await (await api('/life/credits')).json()
  assert.equal(again.balance, c0.balance, 'the monthly grant is idempotent')

  // No AI provider in the test environment: the companion must fail safe and
  // refund, never keeping the credits.
  const plan = await api('/life/companion/plan', { method: 'POST', body: JSON.stringify({ text: 'lecture at 8 and study for an hour', date: '2026-11-02', idemKey: 'k1' }) })
  assert.ok([502, 503].includes(plan.status), `expected a graceful AI failure, got ${plan.status}`)
  assert.equal((await plan.json()).refunded, true)
  assert.equal((await (await api('/life/credits')).json()).balance, c0.balance, 'failed AI request is refunded')

  // Concurrency: balance 60, cost 2 → 40 parallel requests must never overspend,
  // and the ledger can never go negative.
  const { reserve } = await import('../src/credits.js')
  const { storage } = await import('../src/storage/index.js')
  const me = await (await api('/auth/me')).json()
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => reserve(me.user.id, { feature: 'companion_plan', idemKey: `race-${i}` })))
  const won = results.filter((r) => r.ok).length
  assert.equal(won, 30, 'exactly balance/cost reservations succeed')
  assert.equal(await storage.creditBalance(me.user.id), 0)
  assert.ok(results.filter((r) => !r.ok).every((r) => r.code === 'insufficient_credits'))

  // Duplicate idempotency key is not charged twice.
  await storage.creditApply({ userId: me.user.id, idemKey: 'adj-1', kind: 'adjust', amount: 10, feature: 'admin_adjustment' })
  const dup = await storage.creditApply({ userId: me.user.id, idemKey: 'adj-1', kind: 'adjust', amount: 10, feature: 'admin_adjustment' })
  assert.equal(dup.duplicate, true)
  assert.equal(await storage.creditBalance(me.user.id), 10)
})


test('content is published-only; faith content is strictly opt-in and honest when unlicensed', async (t) => {
  const { server, api } = await boot()
  t.after(() => server.close())
  const content = await (await api('/life/content?date=2026-11-02')).json()
  assert.ok(content.books.length >= 5)
  assert.ok(content.daily?.concept && content.daily.book, 'a daily concept with book attribution')
  assert.ok(content.daily.takeaways.length >= 3)
  // Same concept for every user on the same day.
  const again = await (await api('/life/content?date=2026-11-02')).json()
  assert.equal(again.daily.id, content.daily.id)

  const off = await api('/life/faith/daily?date=2026-11-02')
  assert.equal(off.status, 403, 'faith content must not be served until the user opts in')

  const mk = (data) => api('/life/items', { method: 'POST', body: JSON.stringify({ kind: 'wellbeing_prefs', data }) })
  assert.equal((await mk({ faithEnabled: true, faithTradition: 'christian' })).status, 201)
  const christian = await (await api('/life/faith/daily?date=2026-11-02')).json()
  assert.ok(christian.verse?.reference && christian.verse.translation && christian.verse.license, 'verse carries attribution')

  // No Qur'an text is shipped: the user sees an honest empty state, not a guess.
  const items = await (await api('/life/items?kind=wellbeing_prefs')).json()
  await api(`/life/items/${items.items[0].id}`, { method: 'PATCH', body: JSON.stringify({ data: { faithTradition: 'muslim' } }) })
  assert.equal((await (await api('/life/faith/daily?date=2026-11-02')).json()).verse, null)
})

test('admin control: server-enforced roles, audited credit adjustments, content approval workflow', async (t) => {
  const boss = await boot('boss@example.com')
  const staff = await boot('staff@example.com')
  const member = await boot()
  t.after(() => { boss.server.close(); staff.server.close(); member.server.close() })

  // Ordinary users and role-less staff get nothing — enforced server-side.
  assert.equal((await member.api('/admin/ctl/metrics')).status, 403)
  assert.equal((await staff.api('/admin/ctl/content')).status, 403)

  // Super admin assigns roles.
  const put = await boss.api('/admin/ctl/roles', { method: 'PUT', body: JSON.stringify({ roles: { 'staff@example.com': 'support' } }) })
  assert.equal(put.status, 200)
  assert.equal((await staff.api('/admin/ctl/roles')).status, 403, 'support cannot read or change roles')
  assert.equal((await staff.api('/admin/ctl/metrics')).status, 200)

  // Support: small corrections only, reason required, everything audited.
  const target = member.user.id
  assert.equal((await staff.api('/admin/ctl/credits/adjust', { method: 'POST', body: JSON.stringify({ userId: target, amount: 500, reason: 'goodwill' }) })).status, 403)
  assert.equal((await staff.api('/admin/ctl/credits/adjust', { method: 'POST', body: JSON.stringify({ userId: target, amount: 10 }) })).status, 400)
  const ok = await staff.api('/admin/ctl/credits/adjust', { method: 'POST', body: JSON.stringify({ userId: target, amount: 10, reason: 'Duplicate charge correction' }) })
  assert.equal(ok.status, 200)
  assert.equal((await staff.api('/admin/ctl/credits/adjust', { method: 'POST', body: JSON.stringify({ userId: target, amount: -9_999, reason: 'x' }) })).status, 403)
  const audit = await (await boss.api('/admin/ctl/audit')).json()
  assert.ok(audit.entries.some((e) => e.action === 'credits.adjust' && e.actor === 'staff@example.com' && e.target === target))

  // Content: an editor can draft and submit for review but never publish.
  await boss.api('/admin/ctl/roles', { method: 'PUT', body: JSON.stringify({ roles: { 'staff@example.com': 'content' } }) })
  const item = { title: 'Test Book', author: 'A. Author', license: 'Permission on file', status: 'draft' }
  assert.equal((await staff.api('/admin/ctl/content/books/test-book', { method: 'PUT', body: JSON.stringify(item) })).status, 200)
  assert.equal((await staff.api('/admin/ctl/content/books/test-book', { method: 'PUT', body: JSON.stringify({ ...item, status: 'review' }) })).status, 200)
  assert.equal((await staff.api('/admin/ctl/content/books/test-book', { method: 'PUT', body: JSON.stringify({ ...item, status: 'published' }) })).status, 403)
  // Unpublished content never reaches users.
  let books = (await (await member.api('/life/content?date=2026-11-02')).json()).books
  assert.equal(books.some((b) => b.id === 'test-book'), false)
  assert.equal((await boss.api('/admin/ctl/content/books/test-book', { method: 'PUT', body: JSON.stringify({ ...item, status: 'published' }) })).status, 200)
  books = (await (await member.api('/life/content?date=2026-11-02')).json()).books
  assert.equal(books.some((b) => b.id === 'test-book'), true)
  await boss.api('/admin/ctl/content/books/test-book', { method: 'DELETE' })

  // Emergency AI switch: blocks AI work before any credit is touched.
  const before = await (await member.api('/life/credits')).json()
  await boss.api('/admin/ctl/ai/kill', { method: 'POST', body: JSON.stringify({ disabled: true }) })
  const blocked = await member.api('/life/companion/plan', { method: 'POST', body: JSON.stringify({ text: 'study at 5pm', date: '2026-11-02' }) })
  assert.equal(blocked.status, 503)
  assert.equal((await blocked.json()).code, 'ai_disabled')
  assert.equal((await (await member.api('/life/credits')).json()).balance, before.balance)
  await boss.api('/admin/ctl/ai/kill', { method: 'POST', body: JSON.stringify({ disabled: false }) })
})

test('study planner places sessions only in free time inside the chosen window', async (t) => {
  const { server, api } = await boot()
  t.after(() => server.close())
  // Busy 16:00–19:00 on Monday, so a 16:00–20:00 window leaves only 19:00–20:00.
  await api('/life/items', { method: 'POST', body: JSON.stringify({ kind: 'event', data: { title: 'Lab', type: 'lecture', date: '2026-11-02', start: '16:00', end: '19:00' } }) })
  const r = await (await api('/life/learning/plan-sessions', { method: 'POST', body: JSON.stringify({ subject: 'Chemistry', hoursPerWeek: 3, from: '2026-11-02', windowStart: '16:00', windowEnd: '20:00', sessionMin: 50 }) })).json()
  assert.ok(r.actions.length >= 3)
  const mon = r.actions.filter((a) => a.data.date === '2026-11-02')
  for (const a of mon) assert.ok(a.data.time >= '19:00', 'never schedules over the lab')
  assert.equal(r.shortfallMinutes, 0)
})
