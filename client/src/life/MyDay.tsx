import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, ChevronLeft, ChevronRight, Circle, Clock, Pause, Play, Plus, Repeat, Sparkles, Target, Timer, Trash2 } from 'lucide-react'
import type { AuthUser } from '../lib/types'
import { addDays, lifeApi, type DayView, type EventData, type EventType, type GoalData, type Item, type Recurring, type TaskData } from './api'
import { useCompanion } from './Companion'
import { useAct, useNow, useToday } from './hooks'
import {
  btn, Chip, EmptyState, ErrorState, field, fmtDateLong, fmtDuration, fmtTime, minToTime, PageHeader, Ring, Section, Sheet, Skeleton, Spinner, toMin, useAsync, notifyLifeChanged,
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

  return (
    <div>
      <PageHeader
        title={isToday ? `${greeting(now.getHours())}${first ? `, ${first}` : ''}` : fmtDateLong(date)}
        subtitle={isToday ? fmtDateLong(date) : date < today ? 'Looking back' : 'Looking ahead'}
        actions={
          <>
            <div className="flex items-center">
              <button className={btn.icon} onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button>
              <button className={btn.icon} onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight size={18} /></button>
            </div>
            {!isToday && <button className={btn.ghost} onClick={() => setDate(today)}>Today</button>}
          </>
        }
      />

      {q.loading && !day ? (
        <div aria-busy="true" className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-52" /></div>
      ) : q.error && !day ? (
        <ErrorState error={q.error} onRetry={() => q.reload()} />
      ) : day ? (
        <>
          <Overview day={day} isToday={isToday} now={now} onAsk={() => openCompanion()} />
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
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
              <FocusTimer onLogged={() => q.reload(true)} />
              <Reflect day={day} date={date} now={now} reload={() => q.reload(true)} />
              <Goals goals={day.goals} reload={() => q.reload(true)} />
            </div>
          </div>
        </>
      ) : null}

      <ItemSheet kind={sheet} date={date} day={day} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); q.reload(true) }} />
    </div>
  )
}

// ------------------------------------------------------------- overview

function Overview({ day, isToday, now, onAsk }: { day: DayView; isToday: boolean; now: Date; onAsk: () => void }) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const timed = useMemo(() => {
    const e = day.events.map((x) => ({ title: x.data.title, start: x.data.start, end: x.data.end }))
    const t = day.tasks.filter((x) => x.data.time && !x.doneToday).map((x) => ({ title: x.data.title, start: x.data.time!, end: minToTime(Math.min(toMin(x.data.time!) + (x.data.durationMin ?? 30), 1439)) }))
    return [...e, ...t].sort((a, b) => a.start.localeCompare(b.start))
  }, [day])
  const next = isToday ? timed.find((b) => toMin(b.end) > nowMin) : timed[0]
  const doneN = day.tasks.filter((t) => t.doneToday).length
  const totalN = day.tasks.length
  const waking = 16 * 60
  const busy = Math.min(day.busyMinutes, waking)
  const focus = Math.min(day.focusMinutes, waking - busy)
  const free = Math.max(waking - busy - focus, 0)
  const biggest = [...day.freeSlots].sort((a, b) => toMin(b.end) - toMin(b.start) - (toMin(a.end) - toMin(a.start)))[0]
  const upcomingFree = isToday ? day.freeSlots.find((s) => toMin(s.end) - Math.max(toMin(s.start), nowMin) >= 45) : biggest

  // Deterministic, explainable suggestion — no AI involved.
  const suggestion = day.conflicts.length
    ? `You have ${day.conflicts.length} overlap${day.conflicts.length > 1 ? 's' : ''} today. Resolve ${day.conflicts.length > 1 ? 'them' : 'it'} first.`
    : upcomingFree
      ? `Your longest open window is ${fmtTime(upcomingFree.start)}–${fmtTime(upcomingFree.end)} (${fmtDuration(toMin(upcomingFree.end) - toMin(upcomingFree.start))}). A good place for your most important task.`
      : timed.length
        ? 'Your day is packed. Protect a short break between commitments.'
        : 'Nothing is scheduled. Add one thing that would make today a success.'

  return (
    <section aria-label="Overview" className="grid grid-cols-[minmax(0,1fr)] gap-4 border-y border-edge py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-10">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{isToday ? 'Up next' : 'First up'}</p>
        {next ? (
          <div className="mt-1.5">
            <p className="text-[20px] font-semibold leading-snug tracking-tight">{next.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-muted"><Clock size={14} /> {fmtTime(next.start)} – {fmtTime(next.end)}</p>
          </div>
        ) : (
          <p className="mt-1.5 text-[16px] text-ink-muted">{isToday ? 'Nothing else timed today.' : 'Nothing timed.'}</p>
        )}
        <p className="mt-3 flex gap-2 text-[13.5px] text-ink-muted">
          {day.conflicts.length ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /> : <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />}
          <span>{suggestion}</span>
        </p>
        <button onClick={onAsk} className={`${btn.soft} mt-3`}><Sparkles size={15} /> Plan with Bermi</button>
      </div>
      <div>
        <div className="flex items-center gap-4">
          <Ring value={totalN ? (doneN / totalN) * 100 : 0} size={64} label={`${doneN} of ${totalN} tasks done`}>{totalN ? `${doneN}/${totalN}` : '–'}</Ring>
          <div className="text-[13.5px]">
            <p className="font-semibold">{totalN ? `${doneN} of ${totalN} tasks done` : 'No tasks today'}</p>
            <p className="text-ink-muted">{fmtDuration(day.busyMinutes)} scheduled · {fmtDuration(day.focusMinutes)} focused</p>
          </div>
        </div>
        <AllocationBar busy={busy} focus={focus} free={free} />
      </div>
    </section>
  )
}

function AllocationBar({ busy, focus, free }: { busy: number; focus: number; free: number }) {
  const total = busy + focus + free || 1
  const parts = [
    { label: 'Scheduled', v: busy, c: 'var(--primary)' },
    { label: 'Focused', v: focus, c: '#16A779' },
    { label: 'Open', v: free, c: 'var(--edge-strong)' },
  ]
  return (
    <div className="mt-4">
      <div role="img" aria-label={`Waking day (6am–10pm): ${parts.map((p) => `${p.label} ${fmtDuration(p.v)}`).join(', ')}`} className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        {parts.map((p) => (p.v > 0 ? <span key={p.label} style={{ width: `${(p.v / total) * 100}%`, background: p.c }} /> : null))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.c }} />{p.label} {fmtDuration(p.v)}</li>
        ))}
      </ul>
    </div>
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
    <Section title="Focus">
      <div className="flex items-center gap-4">
        <Ring value={run ? (1 - left / total) * 100 : 0} size={84} stroke={7} label={`Focus timer ${mm} minutes ${ss} seconds remaining`}>
          <span className="text-[15px]">{mm}:{ss}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          {!run ? (
            <>
              <div role="radiogroup" aria-label="Session length" className="flex flex-wrap gap-1.5">
                {[15, 25, 45, 60].map((m) => <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
              </div>
              <div className="mt-2.5 flex gap-2">
                <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Focusing on… (optional)" aria-label="What are you focusing on" className={`${field} !py-2`} />
                <button className={btn.primary} onClick={start}><Play size={15} /> Start</button>
              </div>
            </>
          ) : (
            <>
              <p className="truncate text-[14px] font-medium">{run.label || 'Focus session'}</p>
              <div className="mt-2 flex gap-2">
                {run.paused != null ? <button className={btn.primary} onClick={resume}><Play size={15} /> Resume</button> : <button className={btn.soft} onClick={pause}><Pause size={15} /> Pause</button>}
                <button className={btn.ghost} onClick={stop}>Finish</button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-faint"><Timer size={12} /> Time is logged only when you finish or the timer ends.</p>
    </Section>
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
