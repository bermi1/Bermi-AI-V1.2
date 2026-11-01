import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, CalendarClock, Check, ChevronRight, Circle, FolderOpen, Headphones, Lightbulb, MessageSquare, Wind, Clock, Pause, Play, Plus, Repeat, Sparkles, Target, Timer, Trash2 } from 'lucide-react'
import type { AuthUser, Conversation } from '../lib/types'
import * as api from '../lib/api'
import { addDays, lifeApi, type DayView, type EventData, type EventType, type FocusData, type GoalData, type Item, type Recurring, type TaskData } from './api'
import { useCompanion } from './Companion'
import { useAct, useNow, useToday } from './hooks'
import {
  BarBlobs, btn, Chip, DayStrip, EmptyState, ErrorState, field, fmtDateLong, fmtDuration, fmtTime, Hero, minToTime, Ring, Section, Sheet, Skeleton, Spinner, toMin, useAsync, notifyLifeChanged,
} from './ui'

const greeting = (h: number) => (h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')

export function MyDay({ user, name }: { user: AuthUser; name: string }) {
  const today = useToday()
  const [date, setDate] = useState(today)
  // Follow midnight rollover only when the person was looking at "today".
  const prevToday = useRef(today)
  useEffect(() => {
    if (prevToday.current !== today) {
      setDate((d) => (d === prevToday.current ? today : d))
      prevToday.current = today
    }
  }, [today])

  const q = useAsync(() => lifeApi.day(date), [date])
  const act = useAct()
  const { open: openCompanion } = useCompanion()
  const now = useNow()
  const [sheet, setSheet] = useState<null | 'task' | 'event'>(null)
  const isToday = date === today
  const first = (name || user.name || '').split(' ')[0]

  const day = q.data

  const strip = useMemo(() => {
    const base = Array.from({ length: 14 }, (_, i) => addDays(today, i - 3))
    return base.includes(date) ? base : [date, ...base].sort()
  }, [today, date])

  return (
    <div>
      <Hero
        kicker={isToday ? fmtDateLong(date) : date < today ? 'Looking back' : 'Looking ahead'}
        title={isToday ? <>{greeting(now.getHours())}{first ? <>,<br />{first}</> : ''}</> : fmtDateLong(date)}
        actions={!isToday ? <button className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur hover:bg-white/25" onClick={() => setDate(today)}>Back to today</button> : undefined}
      >
        <DayStrip days={strip} value={date} today={today} onPick={setDate} />
        {day && <HeroTiles day={day} isToday={isToday} now={now} date={date} today={today} onAsk={() => openCompanion()} />}
      </Hero>

      <AskHome />

      {q.loading && !day ? (
        <div aria-busy="true" className="space-y-4"><Skeleton className="h-52 !rounded-[1.75rem]" /><Skeleton className="h-40 !rounded-[1.75rem]" /></div>
      ) : q.error && !day ? (
        <ErrorState error={q.error} onRetry={() => q.reload()} />
      ) : day ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div>
            <Section
              title="Schedule"
              action={
                <div className="flex gap-2">
                  <button className={btn.soft} onClick={() => setSheet('event')}><CalendarClock size={15} /> Event</button>
                  <button className={btn.primary} onClick={() => setSheet('task')}><Plus size={15} /> Task</button>
                </div>
              }
            >
              <Timeline day={day} act={act} reload={() => q.reload(true)} />
            </Section>
            <Inbox day={day} act={act} reload={() => q.reload(true)} />
          </div>
          <div>
            <FocusTimer onLogged={() => { q.reload(true); notifyLifeChanged() }} />
            <Reflect day={day} date={date} now={now} reload={() => q.reload(true)} />
            <Goals goals={day.goals} reload={() => q.reload(true)} />
          </div>
        </div>
      ) : null}

      <ItemSheet kind={sheet} date={date} day={day} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); q.reload(true) }} />
    </div>
  )
}

// ------------------------------------------------------------- ask + quick start

/** The front door of the workspace: ask anything, jump to a tool, resume something. */
function AskHome() {
  const { open, navigate } = useCompanion()
  const [text, setText] = useState('')
  const convs = useAsync(() => api.listConversations().then((l) => l.slice(0, 3)).catch(() => [] as Conversation[]), [])
  const learn = useAsync(() => api.learnMyEnrollments().then((l) => l.filter((e) => e.course && e.status !== 'completed').slice(0, 2)).catch(() => []), [])
  const ask = (t = text) => { const q = t.trim(); if (q) { open(q, true); setText('') } }
  const to = (path: string, store?: [string, string]) => () => {
    if (store) try { sessionStorage.setItem(store[0], store[1]) } catch { /* ignore */ }
    navigate(path)
  }
  const tools = [
    { icon: Headphones, label: 'Beats', run: to('/my/learning', ['bermi-learn-tab', 'listen']) },
    { icon: BookOpen, label: 'Audiobooks', run: to('/my/learning', ['bermi-learn-tab', 'audiobooks']) },
    { icon: Wind, label: 'Breathe', run: to('/my/wellbeing') },
    { icon: Lightbulb, label: 'Idea lab', run: to('/my/money', ['bermi-money-view', 'ideas']) },
    { icon: MessageSquare, label: 'Chat', run: () => navigate('/chat') },
    { icon: FolderOpen, label: 'My space', run: () => { try { localStorage.setItem('bermi-open-view', 'dashboard') } catch { /* ignore */ } navigate('/chat') } },
  ]
  return (
    <section aria-label="Ask Bermi" className="tile mb-3 p-4 sm:mb-4 sm:p-5">
      <h2 className="text-[18px] font-semibold tracking-tight sm:text-[20px]">Make today count</h2>
      <p className="text-[13.5px] text-ink-muted">Ask anything, or tell Bermi what to plan.</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask() }}>
        <label htmlFor="ask-home" className="sr-only">Ask Bermi</label>
        <input id="ask-home" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="Ask Bermi or plan something…" className={`${field} !rounded-full !py-3`} />
        <button className={`${btn.primary} !rounded-full !px-5`} disabled={!text.trim()}><Sparkles size={15} /> Ask</button>
      </form>
      <div className="scroll-x -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {['What’s on today?', 'Plan my study week', 'Play me a focus beat'].map((p) => (
          <button key={p} type="button" onClick={() => ask(p)} className="min-h-[34px] shrink-0 whitespace-nowrap rounded-full bg-surface-sunken px-3.5 text-[12.5px] text-ink-muted hover:text-ink">{p}</button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Quick tools">
        {tools.map(({ icon: Icon, label, run }) => (
          <li key={label}>
            <button onClick={run} className="flex min-h-[64px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-sunken text-[12px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Icon size={19} className="text-primary" aria-hidden />{label}</button>
          </li>
        ))}
      </ul>
      {((convs.data?.length ?? 0) > 0 || (learn.data?.length ?? 0) > 0) && (
        <div className="mt-4 grid gap-4 border-t border-edge pt-4 sm:grid-cols-2">
          {(convs.data?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Recent conversations</p>
              <ul>{convs.data!.map((c) => (
                <li key={c.id}><button onClick={() => { try { localStorage.setItem('bermi-open-conversation', c.id) } catch { /* ignore */ } navigate('/chat') }} className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left text-[13.5px] hover:text-primary"><span className="truncate">{c.title || 'Untitled'}</span><ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden /></button></li>
              ))}</ul>
            </div>
          )}
          {(learn.data?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Keep learning</p>
              <ul>{learn.data!.map((e) => {
                const done = Object.values(e.progress ?? {}).filter((p) => p.done).length
                return <li key={e.id}><button onClick={() => navigate(`/portal/c/${e.course_id}`)} className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left text-[13.5px] hover:text-primary"><span className="truncate">{e.course!.title}</span><span className="shrink-0 text-[12px] text-ink-muted">{done} done</span></button></li>
              })}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------- hero tiles

function HeroTiles({ day, isToday, now, date, today, onAsk }: { day: DayView; isToday: boolean; now: Date; date: string; today: string; onAsk: () => void }) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const timed = useMemo(() => {
    const e = day.events.map((x) => ({ title: x.data.title, start: x.data.start, end: x.data.end }))
    const t = day.tasks.filter((x) => x.data.time && !x.doneToday).map((x) => ({ title: x.data.title, start: x.data.time!, end: minToTime(Math.min(toMin(x.data.time!) + (x.data.durationMin ?? 30), 1439)) }))
    return [...e, ...t].sort((a, b) => a.start.localeCompare(b.start))
  }, [day])
  const next = isToday ? timed.find((b) => toMin(b.end) > nowMin) : timed[0]
  const doneN = day.tasks.filter((t) => t.doneToday).length
  const totalN = day.tasks.length
  const biggest = [...day.freeSlots].sort((a, b) => toMin(b.end) - toMin(b.start) - (toMin(a.end) - toMin(a.start)))[0]
  const upcomingFree = isToday ? day.freeSlots.find((s) => toMin(s.end) - Math.max(toMin(s.start), nowMin) >= 45) : biggest

  // Deterministic, explainable suggestion — no AI involved.
  const suggestion = day.conflicts.length
    ? `${day.conflicts.length} overlap${day.conflicts.length > 1 ? 's' : ''} to sort out.`
    : upcomingFree
      ? `Best open window: ${fmtTime(upcomingFree.start)}–${fmtTime(upcomingFree.end)} (${fmtDuration(toMin(upcomingFree.end) - toMin(upcomingFree.start))}).`
      : timed.length
        ? 'Packed day — protect a short break.'
        : 'Nothing scheduled yet.'

  // Real focus minutes for the 7 days ending on the viewed date.
  const from = addDays(date, -6)
  const focus = useAsync(() => lifeApi.items<FocusData>('focus', { from, to: date }), [from, date])
  const week = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const mins = week.map((d) => (focus.data ?? []).filter((f) => f.data.date === d).reduce((n, f) => n + f.data.minutes, 0))
  const total = mins.reduce((a, b) => a + b, 0)
  const labels = week.map((d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'narrow' }) })
  void today

  return (
    <div className="mt-4 grid grid-cols-2 items-stretch gap-2.5 md:mt-5 md:grid-cols-[1.4fr_1fr_1fr] md:gap-3">
      <div className="tile-glass col-span-2 p-3.5 md:col-span-1 md:p-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/60">{isToday ? 'Up next' : 'First up'}</p>
        {next ? (
          <>
            <p className="mt-1 text-[17px] font-semibold leading-snug md:text-[19px]">{next.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-white/75"><Clock size={13} aria-hidden /> {fmtTime(next.start)} – {fmtTime(next.end)}</p>
          </>
        ) : (
          <p className="mt-1.5 text-[15px] text-white/75">{isToday ? 'Nothing else timed today.' : 'Nothing timed.'}</p>
        )}
        <p className="mt-3 flex gap-1.5 text-[12.5px] text-white/70">{day.conflicts.length ? <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> : <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden />}<span>{suggestion}</span></p>
        <button onClick={onAsk} className="mt-3 hidden min-h-[38px] items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#0B1020] hover:bg-white/90 md:inline-flex"><Sparkles size={14} /> Plan with Bermi</button>
      </div>
      <div className="tile-glass p-3.5 md:p-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/60">Tasks</p>
        <div className="mt-3 flex items-center gap-3">
          <HeroRing value={totalN ? (doneN / totalN) * 100 : 0} label={`${doneN} of ${totalN} tasks done`} />
          <div><p className="text-[22px] font-semibold tabular-nums leading-none">{doneN}<span className="text-[15px] font-medium text-white/60">/{totalN}</span></p><p className="mt-1 text-[12.5px] text-white/70">done today</p></div>
        </div>
        <p className="mt-3 text-[12.5px] text-white/70">{fmtDuration(day.busyMinutes)} scheduled</p>
      </div>
      <div className="tile-glass p-3.5 md:p-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/60">Focus · 7 days</p>
        <p className="mt-1 text-[22px] font-semibold tabular-nums leading-none">{fmtDuration(total) || '0m'}</p>
        <div className="mt-3"><BarBlobs onDark values={mins} labels={labels} highlight={6} label={`Focus minutes per day over the last week: ${mins.join(', ')}`} /></div>
      </div>
    </div>
  )
}

function HeroRing({ value, label }: { value: number; label: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 60 60" width="56" height="56" role="img" aria-label={label} className="-rotate-90 shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke="rgb(255 255 255 / .18)" strokeWidth="7" />
      <circle cx="30" cy="30" r={r} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
    </svg>
  )
}

// ------------------------------------------------------------- timeline

type Act = ReturnType<typeof useAct>

function Timeline({ day, act, reload }: { day: DayView; act: Act; reload: () => void }) {
  const conflictTitles = useMemo(() => new Set(day.conflicts.flatMap((c) => [c.aTitle, c.bTitle])), [day.conflicts])
  type Row = { key: string; sort: string; kind: 'event' | 'task'; ev?: Item<EventData>; t?: DayView['tasks'][number] }
  const rows: Row[] = [
    ...day.events.map((e): Row => ({ key: e.id, sort: e.data.start, kind: 'event', ev: e })),
    ...day.tasks.filter((t) => t.data.time).map((t): Row => ({ key: t.id, sort: t.data.time!, kind: 'task', t })),
  ].sort((a, b) => a.sort.localeCompare(b.sort))
  const anytime = day.tasks.filter((t) => !t.data.time)

  const toggle = (t: DayView['tasks'][number]) =>
    act(async () => {
      if (t.data.recurring !== 'none') {
        const set = new Set(t.data.doneDates)
        if (t.doneToday) set.delete(day.date)
        else set.add(day.date)
        await lifeApi.update<TaskData>(t.id, { doneDates: [...set].sort().slice(-400) })
      } else await lifeApi.update<TaskData>(t.id, { done: !t.doneToday })
      reload()
    })
  const del = (id: string, label: string) => {
    if (!window.confirm(`Delete “${label}”? Repeating items disappear from every day.`)) return
    act(async () => { await lifeApi.remove(id); reload() }, 'Deleted')
  }

  if (!rows.length && !anytime.length)
    return <EmptyState icon={<CalendarClock size={26} />} title="A clear day" body="Add a task or event, or tell Bermi what you need to get done and it will draft a plan for you to confirm." />

  return (
    <div>
      {day.conflicts.length > 0 && (
        <div role="alert" className="mb-3 flex gap-2.5 rounded-2xl bg-primary-soft p-3.5 text-[13px]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-semibold text-primary">{day.conflicts.length} overlap{day.conflicts.length > 1 ? 's' : ''} today</p>
            <ul className="mt-0.5 text-ink-muted">{day.conflicts.slice(0, 4).map((c, i) => <li key={i}>“{c.aTitle}” and “{c.bTitle}” clash for {c.overlap}</li>)}</ul>
          </div>
        </div>
      )}
      <ul className="divide-y divide-edge">
        {rows.map((r) => {
          const title = r.ev ? r.ev.data.title : r.t!.data.title
          const clash = conflictTitles.has(title)
          return (
            <li key={r.key} className="group flex items-start gap-3 py-3">
              <div className="w-[70px] shrink-0 whitespace-nowrap pt-0.5 text-right text-[12.5px] tabular-nums text-ink-muted">
                <p className="font-semibold text-ink">{fmtTime(r.sort)}</p>
                {r.ev && <p>{fmtTime(r.ev.data.end)}</p>}
                {r.t?.data.durationMin && <p>{fmtDuration(r.t.data.durationMin)}</p>}
              </div>
              {r.t ? (
                <button onClick={() => toggle(r.t!)} aria-pressed={r.t.doneToday} aria-label={`${r.t.doneToday ? 'Mark not done' : 'Mark done'}: ${title}`} className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-primary">
                  {r.t.doneToday ? <Check size={20} className="rounded-full bg-primary p-0.5 text-on-primary" /> : <Circle size={20} />}
                </button>
              ) : (
                <span aria-hidden className="mt-1 h-6 w-1 shrink-0 rounded-full bg-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[14.5px] font-medium ${r.t?.doneToday ? 'text-ink-faint line-through' : ''}`}>{title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-muted">
                  {r.ev && <span className="capitalize">{r.ev.data.type}</span>}
                  {r.ev?.data.place && <span>· {r.ev.data.place}</span>}
                  {(r.ev?.data.recurring ?? r.t?.data.recurring) !== 'none' && <span className="inline-flex items-center gap-1"><Repeat size={11} /> {r.ev?.data.recurring ?? r.t?.data.recurring}</span>}
                  {clash && <span className="inline-flex items-center gap-1 font-medium text-primary"><AlertTriangle size={11} /> overlaps</span>}
                </p>
              </div>
              <button onClick={() => del((r.ev ?? r.t)!.id, title)} className={`${btn.icon} !h-9 !w-9 opacity-60 hover:opacity-100`} aria-label={`Delete ${title}`}><Trash2 size={15} /></button>
            </li>
          )
        })}
      </ul>
      {anytime.length > 0 && (
        <>
          <p className="mb-1 mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Anytime today</p>
          <ul className="divide-y divide-edge">
            {anytime.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <button onClick={() => toggle(t)} aria-pressed={t.doneToday} aria-label={`${t.doneToday ? 'Mark not done' : 'Mark done'}: ${t.data.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-primary">
                  {t.doneToday ? <Check size={20} className="rounded-full bg-primary p-0.5 text-on-primary" /> : <Circle size={20} />}
                </button>
                <p className={`min-w-0 flex-1 truncate text-[14.5px] ${t.doneToday ? 'text-ink-faint line-through' : 'font-medium'}`}>
                  {t.data.priority === 2 && <span className="mr-1.5 text-primary" aria-label="High priority">●</span>}
                  {t.data.title}
                </p>
                {t.data.recurring !== 'none' && <Repeat size={13} className="text-ink-faint" aria-label={`Repeats ${t.data.recurring}`} />}
                <button onClick={() => del(t.id, t.data.title)} className={`${btn.icon} !h-9 !w-9 opacity-60 hover:opacity-100`} aria-label={`Delete ${t.data.title}`}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Inbox({ day, act, reload }: { day: DayView; act: Act; reload: () => void }) {
  if (!day.inbox.length) return null
  return (
    <Section title={`Inbox · ${day.inbox.length}`}>
      <p className="mb-2 text-[12.5px] text-ink-muted">Tasks with no date, or overdue. Nothing is lost — pull them into this day when you’re ready.</p>
      <ul className="divide-y divide-edge">
        {day.inbox.slice(0, 20).map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <p className="min-w-0 flex-1 truncate text-[14px]">{t.data.title}{t.data.date && <span className="ml-2 text-[12px] text-ink-muted">was {t.data.date}</span>}</p>
            <button className={btn.ghost} onClick={() => act(async () => { await lifeApi.update<TaskData>(t.id, { date: day.date, time: null }); reload() }, 'Moved to this day')}>Do this day</button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ------------------------------------------------------------- add sheet

const EVENT_TYPES: EventType[] = ['lecture', 'meeting', 'deadline', 'group', 'personal', 'study', 'errand']
const RECUR: { id: Recurring; label: string }[] = [
  { id: 'none', label: 'Once' }, { id: 'daily', label: 'Daily' }, { id: 'weekdays', label: 'Weekdays' }, { id: 'weekly', label: 'Weekly' },
]

function ItemSheet({ kind, date, day, onClose, onSaved }: { kind: null | 'task' | 'event'; date: string; day: DayView | null; onClose: () => void; onSaved: () => void }) {
  const act = useAct()
  const [title, setTitle] = useState('')
  const [d, setD] = useState(date)
  const [time, setTime] = useState('')
  const [dur, setDur] = useState('')
  const [end, setEnd] = useState('')
  const [type, setType] = useState<EventType>('personal')
  const [place, setPlace] = useState('')
  const [prio, setPrio] = useState(1)
  const [rec, setRec] = useState<Recurring>('none')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (kind) { setTitle(''); setD(date); setTime(''); setDur(''); setEnd(''); setType('personal'); setPlace(''); setPrio(1); setRec('none') }
  }, [kind, date])

  const isEvent = kind === 'event'
  const startT = time || (isEvent ? '09:00' : '')
  const endT = end || (isEvent && startT ? minToTime(Math.min(toMin(startT) + 60, 1439)) : '')
  // Pre-flight overlap warning against what's already on the viewed day.
  const clash = useMemo(() => {
    if (!day || d !== day.date || !startT) return null
    const a = toMin(startT)
    const b = isEvent ? toMin(endT) : a + (Number(dur) || 30)
    const others = [
      ...day.events.map((e) => ({ title: e.data.title, s: toMin(e.data.start), e: toMin(e.data.end) })),
      ...day.tasks.filter((t) => t.data.time && !t.doneToday).map((t) => ({ title: t.data.title, s: toMin(t.data.time!), e: toMin(t.data.time!) + (t.data.durationMin ?? 30) })),
    ]
    return others.find((o) => a < o.e && o.s < b) ?? null
  }, [day, d, startT, endT, dur, isEvent])

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    const r = await act(async () => {
      if (isEvent) await lifeApi.create<EventData>('event', { title: title.trim(), type, date: d, start: startT, end: endT, place, recurring: rec })
      else await lifeApi.create<TaskData>('task', { title: title.trim(), date: d || null, time: time || null, durationMin: dur ? Number(dur) : null, priority: prio, recurring: rec })
      return true
    }, isEvent ? 'Event added' : 'Task added')
    setSaving(false)
    if (r) { notifyLifeChanged(); onSaved() }
  }

  return (
    <Sheet open={!!kind} onClose={onClose} title={isEvent ? 'New event' : 'New task'}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium" htmlFor="it-title">{isEvent ? 'What is it?' : 'What needs doing?'}</label>
          <input id="it-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={field} placeholder={isEvent ? 'Statistics lecture' : 'Finish chapter 3 notes'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" htmlFor="it-date">Date</label>
            <input id="it-date" type="date" value={d} onChange={(e) => setD(e.target.value)} className={field} required={isEvent} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" htmlFor="it-time">{isEvent ? 'Starts' : 'Time (optional)'}</label>
            <input id="it-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} required={isEvent} />
          </div>
          {isEvent ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium" htmlFor="it-end">Ends</label>
              <input id="it-end" type="time" value={end || endT} onChange={(e) => setEnd(e.target.value)} className={field} required />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium" htmlFor="it-dur">Minutes (optional)</label>
              <input id="it-dur" type="number" min={5} max={960} step={5} value={dur} onChange={(e) => setDur(e.target.value)} className={field} />
            </div>
          )}
          {isEvent && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium" htmlFor="it-place">Place (optional)</label>
              <input id="it-place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} className={field} />
            </div>
          )}
        </div>
        {isEvent ? (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Type</legend>
            <div role="radiogroup" className="flex flex-wrap gap-2">{EVENT_TYPES.map((t) => <Chip key={t} active={type === t} onClick={() => setType(t)}><span className="capitalize">{t}</span></Chip>)}</div>
          </fieldset>
        ) : (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Priority</legend>
            <div role="radiogroup" className="flex gap-2">{[['Low', 0], ['Normal', 1], ['High', 2]].map(([l, v]) => <Chip key={l} active={prio === v} onClick={() => setPrio(v as number)}>{l}</Chip>)}</div>
          </fieldset>
        )}
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Repeats</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">{RECUR.map((r) => <Chip key={r.id} active={rec === r.id} onClick={() => setRec(r.id)}>{r.label}</Chip>)}</div>
        </fieldset>
        {clash && (
          <p role="alert" className="flex gap-2 rounded-xl bg-primary-soft p-3 text-[13px] text-ink-muted"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /> This overlaps “{clash.title}”. You can still save it.</p>
        )}
        <button type="submit" disabled={!title.trim() || saving} className={`${btn.primary} w-full`}>{saving ? <Spinner /> : <Check size={16} />} Save</button>
      </form>
    </Sheet>
  )
}

// ------------------------------------------------------------- focus timer

interface Running { endAt: number; minutes: number; label: string; startedAt: number; paused?: number }
const KEY = 'bermi-focus-run'

function FocusTimer({ onLogged }: { onLogged: () => void }) {
  const act = useAct()
  const [run, setRun] = useState<Running | null>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
  })
  const [minutes, setMinutes] = useState(25)
  const [label, setLabel] = useState('')
  const now = useNow(1000)
  const left = run ? (run.paused ?? Math.max(0, run.endAt - now.getTime())) : minutes * 60_000
  const loggedRef = useRef(false)

  const persist = (r: Running | null) => {
    setRun(r)
    try { r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY) } catch { /* ignore */ }
  }
  const log = async (mins: number, lbl: string) => {
    if (mins < 1) return
    await act(async () => {
      await lifeApi.create('focus', { date: ymd(), minutes: Math.min(Math.round(mins), 600), label: lbl })
      onLogged()
    }, `Logged ${Math.round(mins)} min of focus`)
  }
  const start = () => { loggedRef.current = false; persist({ endAt: Date.now() + minutes * 60_000, minutes, label: label.trim(), startedAt: Date.now() }) }
  const pause = () => run && !run.paused && persist({ ...run, paused: Math.max(0, run.endAt - Date.now()) })
  const resume = () => run?.paused != null && persist({ ...run, endAt: Date.now() + run.paused, paused: undefined })
  const stop = () => {
    if (!run) return
    const spent = (run.minutes * 60_000 - left) / 60_000
    persist(null)
    log(spent, run.label)
  }
  useEffect(() => {
    if (run && !run.paused && left <= 0 && !loggedRef.current) {
      loggedRef.current = true
      persist(null)
      log(run.minutes, run.label)
      try { navigator.vibrate?.(200) } catch { /* not supported */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, run])

  const mm = String(Math.floor(left / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')
  const total = (run ? run.minutes : minutes) * 60_000
  return (
    <section className="tile-accent mb-3 p-4 sm:mb-4 sm:p-5" aria-label="Focus">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold tracking-tight">Focus</h2>
        <Timer size={16} className="text-white/70" aria-hidden />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative shrink-0" role="img" aria-label={`Focus timer ${mm} minutes ${ss} seconds remaining`}>
          <svg viewBox="0 0 96 96" width="96" height="96" className="-rotate-90">
            <circle cx="48" cy="48" r="41" fill="none" stroke="rgb(255 255 255 / .2)" strokeWidth="8" />
            <circle cx="48" cy="48" r="41" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 41} strokeDashoffset={2 * Math.PI * 41 * (1 - (run ? 1 - left / total : 0))} style={{ transition: 'stroke-dashoffset .9s linear' }} />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[19px] font-semibold tabular-nums">{mm}:{ss}</span>
        </div>
        <div className="min-w-0 flex-1">
          {!run ? (
            <>
              <div role="radiogroup" aria-label="Session length" className="flex flex-wrap gap-1.5">
                {[15, 25, 45, 60].map((m) => (
                  <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={`min-h-[34px] rounded-full px-3 text-[13px] font-medium ${minutes === m ? 'bg-white text-[#0B1020]' : 'bg-white/15 text-white hover:bg-white/25'}`}>{m}m</button>
                ))}
              </div>
              <div className="mt-2.5 flex gap-2">
                <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Focusing on…" aria-label="What are you focusing on" className="min-w-0 flex-1 rounded-full bg-white/15 px-3.5 py-2 text-[14px] text-white outline-none placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-white" />
                <button className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-semibold text-[#0B1020]" onClick={start}><Play size={15} /> Start</button>
              </div>
            </>
          ) : (
            <>
              <p className="truncate text-[15px] font-medium">{run.label || 'Focus session'}</p>
              <div className="mt-2.5 flex gap-2">
                {run.paused != null ? <button className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-semibold text-[#0B1020]" onClick={resume}><Play size={15} /> Resume</button> : <button className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/20 px-4 text-[13.5px] font-semibold text-white" onClick={pause}><Pause size={15} /> Pause</button>}
                <button className="min-h-[40px] rounded-full bg-white/15 px-4 text-[13.5px] font-medium text-white" onClick={stop}>Finish</button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-white/65">Time is logged only when you finish or the timer ends.</p>
    </section>
  )
}
const ymd = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` }

// ------------------------------------------------------------- reflection

function Reflect({ day, date, now, reload }: { day: DayView; date: string; now: Date; reload: () => void }) {
  const act = useAct()
  const morning = now.getHours() < 15
  const [slot, setSlot] = useState<'morning' | 'evening'>(morning ? 'morning' : 'evening')
  const existing = day.reflections.find((r) => r.data.slot === slot)
  const [text, setText] = useState(existing?.data.text ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => setText(existing?.data.text ?? ''), [existing?.id, existing?.data.text, slot])
  const prompt = slot === 'morning' ? 'What is the one thing that would make today a good day?' : 'What went well today, and what will you carry into tomorrow?'
  const save = async () => {
    if (!text.trim()) return
    setSaving(true)
    await act(async () => {
      if (existing) await lifeApi.update(existing.id, { text: text.trim() })
      else await lifeApi.create('reflection', { date, slot, text: text.trim() })
      reload()
    }, 'Saved')
    setSaving(false)
  }
  return (
    <Section title={slot === 'morning' ? 'Morning plan' : 'Evening reflection'} action={
      <div role="radiogroup" aria-label="Part of day" className="flex gap-1.5"><Chip active={slot === 'morning'} onClick={() => setSlot('morning')}>Morning</Chip><Chip active={slot === 'evening'} onClick={() => setSlot('evening')}>Evening</Chip></div>
    }>
      <label htmlFor="reflect" className="mb-1.5 block text-[13.5px] text-ink-muted">{prompt}</label>
      <textarea id="reflect" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} className={`${field} resize-none`} />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-ink-faint">Private to you.</span>
        <button className={btn.soft} onClick={save} disabled={!text.trim() || saving || text.trim() === existing?.data.text}>{saving ? <Spinner /> : null} Save</button>
      </div>
    </Section>
  )
}

// ------------------------------------------------------------- goals

function Goals({ goals, reload }: { goals: Item<GoalData>[]; reload: () => void }) {
  const act = useAct()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const add = async () => {
    if (!title.trim()) return
    const ok = await act(async () => { await lifeApi.create<GoalData>('goal', { title: title.trim() }); return true }, 'Goal added')
    if (ok) { setTitle(''); setAdding(false); reload() }
  }
  const step = (g: Item<GoalData>, delta: number) =>
    act(async () => {
      const progress = Math.max(0, Math.min(100, g.data.progress + delta))
      await lifeApi.update<GoalData>(g.id, { progress, status: progress >= 100 ? 'done' : 'active' })
      reload()
    }, undefined)
  return (
    <Section title="Goals" action={<button className={btn.soft} onClick={() => setAdding((v) => !v)}><Target size={15} /> Add</button>}>
      {adding && (
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} aria-label="Goal" placeholder="e.g. Finish my diploma project" className={field} />
          <button className={btn.primary} disabled={!title.trim()}>Add</button>
        </form>
      )}
      {goals.length === 0 && !adding ? (
        <p className="text-[13.5px] text-ink-muted">Goals you set show up here with your progress. Start with one that matters this month.</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-3">
              <Ring value={g.data.progress} size={44} stroke={5} label={`${g.data.title}: ${g.data.progress}% complete`}>{g.data.progress}</Ring>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{g.data.title}</p>
                {g.data.dueDate && <p className="text-[12px] text-ink-muted">Due {g.data.dueDate}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button className={`${btn.icon} !h-9 !w-9`} onClick={() => step(g, -10)} disabled={g.data.progress <= 0} aria-label={`Decrease progress on ${g.data.title}`}>−</button>
                <button className={`${btn.icon} !h-9 !w-9`} onClick={() => step(g, 10)} aria-label={`Increase progress on ${g.data.title}`}>+</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
