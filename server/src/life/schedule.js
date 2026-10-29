// Deterministic scheduling. Everything that decides whether a plan is possible
// lives here — the AI companion may *propose* items, but overlap and
// feasibility are always computed by this code, never by a language model.

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const weekday = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay() // 0=Sun

/** Does a (possibly recurring) item starting on `start` occur on `day`? */
export function occursOn(item, day) {
  const start = item.date
  if (!start) return false
  const rec = item.recurring ?? 'none'
  if (rec === 'none') return start === day
  if (day < start) return false
  if (rec === 'daily') return true
  if (rec === 'weekdays') return weekday(day) >= 1 && weekday(day) <= 5
  if (rec === 'weekly') return weekday(day) === weekday(start)
  return false
}

/** Timed blocks for one day, from events and from timed tasks. */
export function dayBlocks(day, { events = [], tasks = [] }) {
  const blocks = []
  for (const e of events) {
    if (occursOn(e.data, day)) {
      blocks.push({ id: e.id, source: 'event', title: e.data.title, type: e.data.type, start: toMin(e.data.start), end: toMin(e.data.end) })
    }
  }
  for (const t of tasks) {
    if (t.data.time && occursOn(t.data, day)) {
      const s = toMin(t.data.time)
      const dur = t.data.durationMin ?? 30
      blocks.push({ id: t.id, source: 'task', title: t.data.title, type: 'task', start: s, end: Math.min(s + dur, 24 * 60) })
    }
  }
  return blocks.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** Every pair of blocks whose time ranges overlap. */
export function findConflicts(blocks) {
  const out = []
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]
      const b = blocks[j]
      if (b.start >= a.end) break // sorted by start: nothing later can overlap `a`
      if (a.start < b.end && b.start < a.end) {
        out.push({ a: a.id, b: b.id, aTitle: a.title, bTitle: b.title, overlap: `${minToTime(Math.max(a.start, b.start))}–${minToTime(Math.min(a.end, b.end))}` })
      }
    }
  }
  return out
}

/** Free gaps (>= minLen minutes) inside the waking window. */
export function freeSlots(blocks, { from = 6 * 60, to = 22 * 60, minLen = 30 } = {}) {
  const slots = []
  let cursor = from
  for (const b of blocks) {
    if (b.start - cursor >= minLen) slots.push({ start: cursor, end: b.start })
    cursor = Math.max(cursor, b.end)
  }
  if (to - cursor >= minLen) slots.push({ start: cursor, end: to })
  return slots
}

/** Total scheduled minutes (union of blocks — overlaps are not double counted). */
export function busyMinutes(blocks) {
  let total = 0
  let cursor = -1
  for (const b of blocks) {
    const s = Math.max(b.start, cursor)
    if (b.end > s) total += b.end - s
    cursor = Math.max(cursor, b.end)
  }
  return total
}

/**
 * Checks proposed new timed items against the day's existing blocks AND each
 * other, so a plan the assistant drafted can be shown with its conflicts
 * before anything is saved.
 */
export function checkProposal(day, existing, proposed) {
  const existingBlocks = dayBlocks(day, existing)
  const newBlocks = proposed
    .filter((p) => p.start != null && p.end != null)
    .map((p, i) => ({ id: `new${i}`, source: 'proposal', title: p.title, type: p.type ?? 'task', start: p.start, end: p.end }))
  const all = [...existingBlocks, ...newBlocks].sort((a, b) => a.start - b.start || a.end - b.end)
  return findConflicts(all).filter((c) => c.a.startsWith('new') || c.b.startsWith('new'))
}
