// Server-side validation for every Life OS item kind. Nothing the browser (or
// the AI companion) sends is stored until it has passed through here — values
// are coerced, clamped and unknown fields dropped, so a malformed or hostile
// payload can never produce a record the screens cannot render.

export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}

const str = (v, max, { required = false, field = 'value' } = {}) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
  if (required && !s) throw new ValidationError(`${field} is required`)
  return s
}

export const isDate = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
const date = (v, field, { required = false } = {}) => {
  if (v == null || v === '') {
    if (required) throw new ValidationError(`${field} is required`)
    return null
  }
  if (!isDate(v)) throw new ValidationError(`${field} must be a valid YYYY-MM-DD date`)
  return v
}
export const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const time = (v, field, { required = false } = {}) => {
  if (v == null || v === '') {
    if (required) throw new ValidationError(`${field} is required`)
    return null
  }
  if (!isTime(v)) throw new ValidationError(`${field} must be HH:MM (24-hour)`)
  return v
}
const num = (v, field, { min = 0, max = 1e12, required = false, int = false } = {}) => {
  if (v == null || v === '') {
    if (required) throw new ValidationError(`${field} is required`)
    return null
  }
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(`${field} must be between ${min} and ${max}`)
  return int ? Math.round(n) : Math.round(n * 100) / 100
}
const oneOf = (v, allowed, fallback, field) => {
  if (v == null || v === '') return fallback
  if (!allowed.includes(v)) throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`)
  return v
}
const dateList = (v, max = 800) =>
  Array.isArray(v) ? [...new Set(v.filter(isDate))].sort().slice(-max) : []


/** Study kit generated from a note — validated no matter who supplies it. */
function sanitizeKit(k) {
  if (k == null) return null
  if (typeof k !== 'object') throw new ValidationError('kit must be an object')
  const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : [])
  return {
    summary: str(k.summary, 1500),
    keyPoints: list(k.keyPoints, 8).map((x) => str(x, 240)).filter(Boolean),
    flashcards: list(k.flashcards, 30)
      .map((f) => ({ q: str(f?.q, 300), a: str(f?.a, 400) }))
      .filter((f) => f.q && f.a),
    quiz: list(k.quiz, 15)
      .map((q) => ({
        q: str(q?.q, 300),
        options: list(q?.options, 4).map((o) => str(o, 200)),
        answer: Number.isInteger(q?.answer) ? q.answer : -1,
        explain: str(q?.explain, 300),
      }))
      .filter((q) => q.q && q.options.length === 4 && q.options.every(Boolean) && q.answer >= 0 && q.answer <= 3),
    generatedAt: typeof k.generatedAt === 'string' ? k.generatedAt.slice(0, 30) : new Date().toISOString(),
  }
}

const EVENT_TYPES = ['lecture', 'meeting', 'deadline', 'group', 'personal', 'study', 'errand']

export const KINDS = {
  task: {
    max: 3000,
    sanitize(d, prev) {
      const out = {
        title: str(d.title ?? prev?.title, 200, { required: true, field: 'title' }),
        notes: str(d.notes ?? prev?.notes ?? '', 2000),
        done: d.done == null ? Boolean(prev?.done) : Boolean(d.done),
        date: d.date === undefined ? (prev?.date ?? null) : date(d.date, 'date'),
        time: d.time === undefined ? (prev?.time ?? null) : time(d.time, 'time'),
        durationMin: d.durationMin === undefined ? (prev?.durationMin ?? null) : num(d.durationMin, 'durationMin', { min: 5, max: 960, int: true }),
        priority: d.priority === undefined ? (prev?.priority ?? 1) : num(d.priority, 'priority', { min: 0, max: 2, int: true }),
        recurring: oneOf(d.recurring ?? prev?.recurring, ['none', 'daily', 'weekdays', 'weekly'], 'none', 'recurring'),
        doneDates: d.doneDates === undefined ? dateList(prev?.doneDates) : dateList(d.doneDates),
        goalId: d.goalId === undefined ? (prev?.goalId ?? null) : str(d.goalId, 60) || null,
      }
      if (out.time && !out.date) throw new ValidationError('A task with a time needs a date')
      if (out.recurring !== 'none' && !out.date) throw new ValidationError('A recurring task needs a start date')
      return out
    },
    whenKey: (d) => (d.date ? `${d.date}T${d.time ?? '99:99'}` : '9999'),
  },
  event: {
    max: 3000,
    sanitize(d, prev) {
      const out = {
        title: str(d.title ?? prev?.title, 200, { required: true, field: 'title' }),
        type: oneOf(d.type ?? prev?.type, EVENT_TYPES, 'personal', 'type'),
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        start: time(d.start ?? prev?.start, 'start', { required: true }),
        end: time(d.end ?? prev?.end, 'end', { required: true }),
        place: str(d.place ?? prev?.place ?? '', 120),
        notes: str(d.notes ?? prev?.notes ?? '', 1000),
        recurring: oneOf(d.recurring ?? prev?.recurring, ['none', 'daily', 'weekdays', 'weekly'], 'none', 'recurring'),
      }
      if (out.end <= out.start) throw new ValidationError('An event must end after it starts (same-day events only)')
      return out
    },
    whenKey: (d) => `${d.date}T${d.start}`,
  },
  goal: {
    max: 200,
    sanitize(d, prev) {
      return {
        title: str(d.title ?? prev?.title, 160, { required: true, field: 'title' }),
        why: str(d.why ?? prev?.why ?? '', 500),
        progress: d.progress === undefined ? (prev?.progress ?? 0) : num(d.progress, 'progress', { min: 0, max: 100, int: true }),
        dueDate: d.dueDate === undefined ? (prev?.dueDate ?? null) : date(d.dueDate, 'dueDate'),
        status: oneOf(d.status ?? prev?.status, ['active', 'done', 'archived'], 'active', 'status'),
      }
    },
    whenKey: (d) => d.dueDate ?? '9999',
  },
  // A PLAN, never money held by Bermi: contributions are the user's own
  // manual notes of what they intend to / did set aside.
  saving: {
    max: 200,
    sanitize(d, prev) {
      const contributions = Array.isArray(d.contributions ?? prev?.contributions)
        ? (d.contributions ?? prev.contributions)
            .slice(-400)
            .map((c) => ({ date: date(c?.date, 'contribution date', { required: true }), amount: num(c?.amount, 'contribution amount', { min: 0.01, max: 1e10, required: true }) }))
        : []
      return {
        title: str(d.title ?? prev?.title, 160, { required: true, field: 'title' }),
        targetAmount: num(d.targetAmount ?? prev?.targetAmount, 'targetAmount', { min: 1, max: 1e11, required: true }),
        currency: str(d.currency ?? prev?.currency ?? 'TZS', 3).toUpperCase() || 'TZS',
        dueDate: date(d.dueDate ?? prev?.dueDate, 'dueDate', { required: true }),
        contributions,
        status: oneOf(d.status ?? prev?.status, ['active', 'done', 'cancelled'], 'active', 'status'),
      }
    },
    whenKey: (d) => d.dueDate,
  },
  expense: {
    max: 3000,
    sanitize(d, prev) {
      return {
        title: str(d.title ?? prev?.title, 160, { required: true, field: 'title' }),
        amount: num(d.amount ?? prev?.amount, 'amount', { min: 0, max: 1e11, required: true }),
        category: str(d.category ?? prev?.category ?? 'other', 40) || 'other',
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        paid: d.paid == null ? Boolean(prev?.paid) : Boolean(d.paid),
      }
    },
    whenKey: (d) => d.date,
  },
  budget: {
    max: 1,
    sanitize(d, prev) {
      const cats = Array.isArray(d.categories ?? prev?.categories) ? (d.categories ?? prev.categories).slice(0, 24) : []
      return {
        currency: str(d.currency ?? prev?.currency ?? 'TZS', 3).toUpperCase() || 'TZS',
        monthlyIncome: num(d.monthlyIncome ?? prev?.monthlyIncome ?? 0, 'monthlyIncome', { min: 0, max: 1e11 }) ?? 0,
        categories: cats.map((c, i) => ({
          id: str(c?.id, 40) || `cat${i}`,
          name: str(c?.name, 40, { required: true, field: 'category name' }),
          planned: num(c?.planned ?? 0, 'planned amount', { min: 0, max: 1e11 }) ?? 0,
        })),
      }
    },
    whenKey: () => '0',
  },
  mood: {
    max: 2000,
    sanitize(d, prev) {
      return {
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        mood: num(d.mood ?? prev?.mood, 'mood', { min: 1, max: 5, required: true, int: true }),
        note: str(d.note ?? prev?.note ?? '', 500),
      }
    },
    whenKey: (d) => d.date,
  },
  gratitude: {
    max: 2000,
    sanitize(d, prev) {
      return {
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        text: str(d.text ?? prev?.text, 1000, { required: true, field: 'text' }),
      }
    },
    whenKey: (d) => d.date,
  },
  reflection: {
    max: 2000,
    sanitize(d, prev) {
      return {
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        slot: oneOf(d.slot ?? prev?.slot, ['morning', 'evening'], 'evening', 'slot'),
        text: str(d.text ?? prev?.text, 2000, { required: true, field: 'text' }),
      }
    },
    whenKey: (d) => d.date,
  },
  habit: {
    max: 60,
    sanitize(d, prev) {
      return {
        title: str(d.title ?? prev?.title, 80, { required: true, field: 'title' }),
        category: oneOf(d.category ?? prev?.category, ['general', 'movement', 'sleep', 'mind', 'health'], 'general', 'category'),
        doneDates: d.doneDates === undefined ? dateList(prev?.doneDates) : dateList(d.doneDates),
        active: d.active == null ? (prev?.active ?? true) : Boolean(d.active),
      }
    },
    whenKey: () => '0',
  },
  focus: {
    max: 5000,
    sanitize(d, prev) {
      return {
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        minutes: num(d.minutes ?? prev?.minutes, 'minutes', { min: 1, max: 600, required: true, int: true }),
        label: str(d.label ?? prev?.label ?? '', 120),
      }
    },
    whenKey: (d) => d.date,
  },
  reading: {
    max: 100,
    sanitize(d, prev) {
      const bookmarks = Array.isArray(d.bookmarks ?? prev?.bookmarks) ? (d.bookmarks ?? prev.bookmarks).slice(0, 100) : []
      return {
        bookId: str(d.bookId ?? prev?.bookId, 60, { required: true, field: 'bookId' }),
        status: oneOf(d.status ?? prev?.status, ['want', 'reading', 'done'], 'reading', 'status'),
        progress: d.progress === undefined ? (prev?.progress ?? 0) : num(d.progress, 'progress', { min: 0, max: 100, int: true }),
        notes: str(d.notes ?? prev?.notes ?? '', 4000),
        bookmarks: bookmarks.map((b) => str(b, 200)).filter(Boolean),
        reflections: Array.isArray(d.reflections ?? prev?.reflections)
          ? (d.reflections ?? prev.reflections).slice(-60).map((r) => ({ date: date(r?.date, 'reflection date', { required: true }), text: str(r?.text, 1000, { required: true, field: 'reflection' }) }))
          : [],
      }
    },
    whenKey: () => '0',
  },
  note: {
    max: 500,
    sanitize(d, prev) {
      return {
        title: str(d.title ?? prev?.title, 160, { required: true, field: 'title' }),
        course: str(d.course ?? prev?.course ?? '', 120),
        body: str(d.body ?? prev?.body ?? '', 40000),
        date: date(d.date ?? prev?.date, 'date'),
        kit: d.kit === undefined ? (prev?.kit ?? null) : sanitizeKit(d.kit),
      }
    },
    whenKey: (d) => d.date ?? '0',
  },
  // Saved concepts (daily book idea bookmarks) and other lightweight saves.
  saved: {
    max: 500,
    sanitize(d, prev) {
      return {
        ref: str(d.ref ?? prev?.ref, 80, { required: true, field: 'ref' }),
        label: str(d.label ?? prev?.label ?? '', 200),
        type: oneOf(d.type ?? prev?.type, ['concept', 'audio', 'verse', 'session'], 'concept', 'type'),
      }
    },
    whenKey: () => '0',
  },
  // A user-chosen wellbeing/faith/privacy preference bag (consent flags).
  // Faith content is strictly opt-in and never inferred from anything else.
  wellbeing_prefs: {
    max: 1,
    sanitize(d, prev) {
      const times = (v, fallback) =>
        Array.isArray(v ?? fallback) ? (v ?? fallback).filter(isTime).slice(0, 6) : []
      return {
        faithEnabled: d.faithEnabled == null ? Boolean(prev?.faithEnabled) : Boolean(d.faithEnabled),
        faithTradition: oneOf(d.faithTradition ?? prev?.faithTradition, ['', 'christian', 'muslim', 'other'], '', 'faithTradition'),
        prayerTimes: times(d.prayerTimes, prev?.prayerTimes),
        cycleEnabled: d.cycleEnabled == null ? Boolean(prev?.cycleEnabled) : Boolean(d.cycleEnabled),
        bedtime: d.bedtime === undefined ? (prev?.bedtime ?? '22:30') : (time(d.bedtime, 'bedtime') ?? '22:30'),
        wakeTime: d.wakeTime === undefined ? (prev?.wakeTime ?? '06:30') : (time(d.wakeTime, 'wakeTime') ?? '06:30'),
      }
    },
    whenKey: () => '0',
  },
  // Guided breathing / meditation / quiet-reflection sessions completed.
  session: {
    max: 5000,
    sanitize(d, prev) {
      return {
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        type: oneOf(d.type ?? prev?.type, ['breathing', 'meditation', 'reflection', 'sleep'], 'breathing', 'type'),
        minutes: num(d.minutes ?? prev?.minutes, 'minutes', { min: 1, max: 240, required: true, int: true }),
      }
    },
    whenKey: (d) => d.date,
  },
  skill: {
    max: 100,
    sanitize(d, prev) {
      return {
        name: str(d.name ?? prev?.name, 80, { required: true, field: 'name' }),
        level: d.level === undefined ? (prev?.level ?? 1) : num(d.level, 'level', { min: 1, max: 5, int: true }),
        target: d.target === undefined ? (prev?.target ?? 3) : num(d.target, 'target', { min: 1, max: 5, int: true }),
        notes: str(d.notes ?? prev?.notes ?? '', 500),
      }
    },
    whenKey: () => '0',
  },
  // Personalisation: what the assistant may use to tailor suggestions.
  profile: {
    max: 1,
    sanitize(d, prev) {
      const list = (v, fb) => (Array.isArray(v ?? fb) ? (v ?? fb).map((x) => str(x, 60)).filter(Boolean).slice(0, 12) : [])
      return {
        goals: list(d.goals, prev?.goals),
        interests: list(d.interests, prev?.interests),
        learningStyle: oneOf(d.learningStyle ?? prev?.learningStyle, ['', 'reading', 'listening', 'practice', 'visual'], '', 'learningStyle'),
        studyHoursPerWeek: d.studyHoursPerWeek === undefined ? (prev?.studyHoursPerWeek ?? 8) : num(d.studyHoursPerWeek, 'studyHoursPerWeek', { min: 0, max: 80, int: true }),
        planningTime: d.planningTime === undefined ? (prev?.planningTime ?? '07:30') : (time(d.planningTime, 'planningTime') ?? '07:30'),
        studyWindowStart: d.studyWindowStart === undefined ? (prev?.studyWindowStart ?? '16:00') : (time(d.studyWindowStart, 'studyWindowStart') ?? '16:00'),
        studyWindowEnd: d.studyWindowEnd === undefined ? (prev?.studyWindowEnd ?? '20:00') : (time(d.studyWindowEnd, 'studyWindowEnd') ?? '20:00'),
        // Whether the assistant may use goals/schedule/budget as context.
        assistantContext: d.assistantContext == null ? (prev?.assistantContext ?? true) : Boolean(d.assistantContext),
        region: str(d.region ?? prev?.region ?? '', 40),
      }
    },
    whenKey: () => '0',
  },
  notify_prefs: {
    max: 1,
    sanitize(d, prev) {
      const flag = (k, fb) => (d[k] == null ? (prev?.[k] ?? fb) : Boolean(d[k]))
      return {
        tasks: flag('tasks', true),
        study: flag('study', true),
        dailyBook: flag('dailyBook', false),
        goals: flag('goals', true),
        wellbeing: flag('wellbeing', false),
        quietStart: d.quietStart === undefined ? (prev?.quietStart ?? '22:00') : (time(d.quietStart, 'quietStart') ?? '22:00'),
        quietEnd: d.quietEnd === undefined ? (prev?.quietEnd ?? '07:00') : (time(d.quietEnd, 'quietEnd') ?? '07:00'),
      }
    },
    whenKey: () => '0',
  },
  // Optional, private, user-consented. Dates only; estimates are never
  // presented as medical advice (see the screen's disclaimer).
  cycle: {
    max: 400,
    sanitize(d, prev) {
      return {
        date: date(d.date ?? prev?.date, 'date', { required: true }),
        kind: oneOf(d.kind ?? prev?.kind, ['period_start', 'period_end', 'symptom'], 'period_start', 'kind'),
        note: str(d.note ?? prev?.note ?? '', 300),
      }
    },
    whenKey: (d) => d.date,
  },
}

export { sanitizeKit }
export const KIND_NAMES = Object.keys(KINDS)

/** Sanitises `data` for `kind`; `prev` supplies the stored values for PATCH. */
export function sanitizeItem(kind, data, prev) {
  const def = KINDS[kind]
  if (!def) throw new ValidationError(`Unknown kind: ${kind}`)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ValidationError('data must be an object')
  const clean = def.sanitize(data, prev)
  const size = JSON.stringify(clean).length
  if (size > 60_000) throw new ValidationError('That item is too large')
  return { data: clean, when_key: def.whenKey(clean) }
}
