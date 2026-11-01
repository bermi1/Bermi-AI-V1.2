import { apiFetch, json } from '../lib/api'

// ---------------------------------------------------------------- types

export interface Item<T> {
  id: string
  kind: string
  data: T
  when_key: string | null
  created_at: string
  updated_at: string
}

export type Recurring = 'none' | 'daily' | 'weekdays' | 'weekly'
export interface TaskData {
  title: string
  notes: string
  done: boolean
  date: string | null
  time: string | null
  durationMin: number | null
  priority: number
  recurring: Recurring
  doneDates: string[]
  goalId: string | null
}
export type EventType = 'lecture' | 'meeting' | 'deadline' | 'group' | 'personal' | 'study' | 'errand'
export interface EventData {
  title: string
  type: EventType
  date: string
  start: string
  end: string
  place: string
  notes: string
  recurring: Recurring
}
export interface GoalData {
  title: string
  why: string
  progress: number
  dueDate: string | null
  status: 'active' | 'done' | 'archived'
}
export interface SavingData {
  title: string
  targetAmount: number
  currency: string
  dueDate: string
  contributions: { date: string; amount: number }[]
  status: 'active' | 'done' | 'cancelled'
}
export interface ExpenseData {
  title: string
  amount: number
  category: string
  date: string
  paid: boolean
}
export interface BudgetData {
  currency: string
  monthlyIncome: number
  categories: { id: string; name: string; planned: number }[]
}
export interface MoodData { date: string; mood: number; note: string }
export interface GratitudeData { date: string; text: string }
export interface ReflectionData { date: string; slot: 'morning' | 'evening'; text: string }
export interface HabitData {
  title: string
  category: 'general' | 'movement' | 'sleep' | 'mind' | 'health'
  doneDates: string[]
  active: boolean
}
export interface FocusData { date: string; minutes: number; label: string }
export interface SessionData { date: string; type: 'breathing' | 'meditation' | 'reflection' | 'sleep'; minutes: number }
export interface ReadingData {
  bookId: string
  status: 'want' | 'reading' | 'done'
  progress: number
  notes: string
  bookmarks: string[]
  reflections: { date: string; text: string }[]
}
export interface Kit {
  summary: string
  keyPoints: string[]
  flashcards: { q: string; a: string }[]
  quiz: { q: string; options: string[]; answer: number; explain: string }[]
  generatedAt: string
}
export interface Shaped {
  summary: string
  valueProposition: string
  assumptions: string[]
  experiments: string[]
  risks: string[]
  firstSteps: string[]
  questions: string[]
  generatedAt: string
}
export type IdeaCategory = 'business' | 'invest' | 'stock' | 'savings' | 'other'
export interface IdeaData {
  title: string
  raw: string
  category: IdeaCategory
  status: 'seed' | 'testing' | 'validated' | 'parked'
  value: string
  shaped: Shaped | null
  experiments: { text: string; done: boolean; result: string }[]
  date: string | null
}
export interface NoteData { title: string; course: string; body: string; date: string | null; kit: Kit | null }
export interface SavedData { ref: string; label: string; type: 'concept' | 'audio' | 'verse' | 'session' }
export interface SkillData { name: string; level: number; target: number; notes: string }
export interface WellbeingPrefs {
  faithEnabled: boolean
  faithTradition: '' | 'christian' | 'muslim' | 'other'
  prayerTimes: string[]
  cycleEnabled: boolean
  bedtime: string
  wakeTime: string
  cycleLength: number
  periodLength: number
}
export interface ProfileData {
  goals: string[]
  interests: string[]
  learningStyle: '' | 'reading' | 'listening' | 'practice' | 'visual'
  studyHoursPerWeek: number
  planningTime: string
  studyWindowStart: string
  studyWindowEnd: string
  assistantContext: boolean
  region: string
}
export interface NotifyPrefs {
  tasks: boolean
  study: boolean
  dailyBook: boolean
  goals: boolean
  wellbeing: boolean
  quietStart: string
  quietEnd: string
}
export interface CycleData {
  date: string
  kind: 'period_start' | 'period_end' | 'symptom' | 'log'
  note: string
  flow: '' | 'spotting' | 'light' | 'medium' | 'heavy'
  symptoms: string[]
  mood: number | null
}

export interface Block {
  a: string
  b: string
  aTitle: string
  bTitle: string
  overlap: string
}
export interface DayView {
  date: string
  tasks: (Item<TaskData> & { doneToday: boolean })[]
  events: Item<EventData>[]
  inbox: Item<TaskData>[]
  conflicts: Block[]
  freeSlots: { start: string; end: string }[]
  busyMinutes: number
  focusMinutes: number
  goals: Item<GoalData>[]
  reflections: Item<ReflectionData>[]
}

export interface SavingPlan {
  remaining: number
  days: number
  state: 'active' | 'reached' | 'overdue'
  perWeek: number | null
  perDay: number | null
  realistic: boolean | null
  note: string
}
export interface MoneyView {
  budget: BudgetData | null
  summary: {
    month: string
    currency: string
    income: number
    budgetedTotal: number
    upcomingTotal: number
    availableAfterPlan: number | null
    suggestedSavingsPerMonth: number
    categories: { id: string; name: string; planned: number; upcoming: number }[]
  }
  expenses: Item<ExpenseData>[]
  savings: (Item<SavingData> & { saved: number; plan: SavingPlan })[]
}

export interface Book {
  id: string; title: string; author: string; year: number; publisher: string
  blurb: string; license: string; sourceUrl: string
}
export interface Concept {
  id: string; bookId: string; concept: string; explanation: string; example: string
  takeaways: string[]; action: string; reflection: string; source: string
  book: Book | null
}
export interface GuidedSession { id: string; type: string; title: string; minutes: number; blurb: string; steps: string[] }
export interface AudioAsset { id: string; title: string; author?: string; url: string; license: string; attribution?: string; category?: string; minutes?: number }
export interface Audiobook {
  id: string
  archiveId: string
  category: 'wealth' | 'motivation' | 'emotion' | 'laziness' | string
  title: string
  author: string
  year?: number
  minutes?: number
  narrator?: string
  blurb?: string
  sourceUrl?: string
  license: string
}
export interface AudioPick { source: 'rules' | 'ai' | 'default'; mood: string; title: string; trackIds: string[]; scene: 'brown' | 'rain' | 'air' | null; ambient: number; beatVolume: number; reason: string }
export interface AudioTrack { name: string; title: string; seconds: number; url: string }
export interface ContentView {
  audiobooks: Audiobook[]
  books: Book[]
  sessions: GuidedSession[]
  audio: AudioAsset[]
  daily: Concept | null
  concepts: { id: string; bookId: string; title: string }[]
}
export interface Verse { id: string; reference: string; text: string; translation: string; license: string; prompt?: string; tradition: string }

export interface ProposedAction {
  id: string
  type: 'event' | 'task' | 'saving' | 'goal'
  kind: 'event' | 'task' | 'saving' | 'goal'
  data: Record<string, unknown>
}
export interface Proposal {
  summary: string
  answered?: boolean
  steps?: { tool: string; args: Record<string, unknown> }[]
  actions: ProposedAction[]
  conflicts: (Block & { date: string })[]
  creditsUsed?: number
  balance?: number
  refunded?: boolean
  message?: string
}
export interface CreditsView {
  plan: { id: string; label: string }
  monthlyAllowance: number
  balance: number
  costs: Record<string, number>
  ledger: { id: number; kind: string; amount: number; feature: string | null; ref: string | null; created_at: string; meta: Record<string, unknown> | null }[]
}

// ---------------------------------------------------------------- errors

export class LifeError extends Error {
  code?: string
  status: number
  refunded?: boolean
  retryAfter?: number | null
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function req<T>(path: string, init?: RequestInit, timeout = 15_000): Promise<T> {
  const res = await apiFetch(`/api/life${path}`, init, timeout)
  if (!res.ok) {
    let body: { error?: string; code?: string; refunded?: boolean; retryAfter?: number } = {}
    try {
      body = await res.json()
    } catch {
      /* not json */
    }
    const err = new LifeError(body.error || res.statusText || 'Something went wrong', res.status, body.code)
    err.refunded = body.refunded
    err.retryAfter = body.retryAfter
    throw err
  }
  return json<T>(res)
}
const post = <T>(path: string, body: unknown, timeout?: number) =>
  req<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, timeout)

export const todayYmd = (d = new Date()) => {
  // Local calendar date — the server treats dates as opaque strings, so the
  // user's own day (not UTC) decides what "today" means.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return todayYmd(new Date(y, m - 1, d + n))
}

// ---------------------------------------------------------------- calls

export const lifeApi = {
  day: (date: string) => req<DayView>(`/day?date=${date}`),
  items: <T>(kind: string, range?: { from?: string; to?: string }) => {
    const q = new URLSearchParams({ kind, ...(range?.from ? { from: range.from } : {}), ...(range?.to ? { to: range.to } : {}) })
    return req<{ items: Item<T>[] }>(`/items?${q}`).then((r) => r.items)
  },
  create: <T>(kind: string, data: Partial<T>) =>
    post<{ item: Item<T> }>('/items', { kind, data }).then((r) => r.item),
  update: <T>(id: string, data: Partial<T>) =>
    req<{ item: Item<T> }>(`/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) }).then((r) => r.item),
  remove: (id: string) => req<{ ok: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  removeKind: (kind: string) => req<{ ok: boolean; removed: number }>(`/kind/${kind}`, { method: 'DELETE' }),
  money: (date: string) => req<MoneyView>(`/money?date=${date}`),
  checkSaving: (body: { target: number; due: string; today: string; saved?: number }) =>
    post<{ plan: SavingPlan }>('/money/check', body).then((r) => r.plan),
  content: (date: string) => req<ContentView>(`/content?date=${date}`),
  concept: (id: string) => req<{ concept: Concept }>(`/concept/${id}`).then((r) => r.concept),
  faithDaily: (date: string) => req<{ tradition: string; verse: Verse | null }>(`/faith/daily?date=${date}`),
  planSessions: (body: object) =>
    post<{ actions: ProposedAction[]; plannedMinutes: number; shortfallMinutes: number; message: string | null }>('/learning/plan-sessions', body),
  studyKit: (noteId: string, idemKey: string) =>
    post<{ item: Item<NoteData>; creditsUsed: number }>(`/notes/${noteId}/study-kit`, { idemKey }, 90_000),
  shapeIdea: (id: string, idemKey: string) =>
    post<{ item: Item<IdeaData>; creditsUsed: number }>(`/ideas/${id}/shape`, { idemKey }, 90_000),
  audiobookTracks: (id: string) => req<{ tracks: AudioTrack[] }>(`/audiobooks/${encodeURIComponent(id)}/tracks`).then((r) => r.tracks),
  pickAudio: (text: string, idemKey: string) => post<AudioPick>('/audio/pick', { text, idemKey }),
  credits: () => req<CreditsView>('/credits'),
  pushStatus: () => req<{ configured: boolean; scheduler: boolean }>('/push/status'),
  plan: (body: { text: string; date: string; time: string; idemKey: string }) =>
    post<Proposal>('/companion/plan', body, 60_000),
  apply: (actions: ProposedAction[]) =>
    post<{ results: { id: string | null; ok: boolean; error?: string }[]; applied: number }>('/companion/apply', { actions }),
}
