import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronRight, Dumbbell, Flame, Frown, HeartHandshake, Lock, Meh, Moon, Plus, Smile, SmilePlus, Trash2, Wind, Angry } from 'lucide-react'
import { addDays, lifeApi, todayYmd, type CycleData, type GratitudeData, type GuidedSession, type HabitData, type Item, type MoodData, type SessionData, type Verse, type WellbeingPrefs } from './api'
import { useAct, useItems, useNow, useSingleton, useToday } from './hooks'
import { useOptionalTheme } from '../lib/theme'
import {
  btn, Chip, EmptyState, ErrorState, field, fmtDateShort, PageHeader, Section, Sheet, Skeleton, Sparkline, useAsync, notifyLifeChanged,
} from './ui'

const MOODS = [
  { v: 1, label: 'Rough', Icon: Angry },
  { v: 2, label: 'Low', Icon: Frown },
  { v: 3, label: 'Okay', Icon: Meh },
  { v: 4, label: 'Good', Icon: Smile },
  { v: 5, label: 'Great', Icon: SmilePlus },
]
const DEFAULT_PREFS: WellbeingPrefs = { faithEnabled: false, faithTradition: '', prayerTimes: [], cycleEnabled: false, bedtime: '22:30', wakeTime: '06:30' }

export function MyWellbeing() {
  const today = useToday()
  const prefs = useSingleton<WellbeingPrefs>('wellbeing_prefs')
  const p = prefs.data ?? DEFAULT_PREFS

  if (prefs.error && !prefs.data) return (<div><PageHeader title="My Wellbeing" /><ErrorState error={prefs.error} onRetry={() => prefs.reload()} /></div>)

  return (
    <div>
      <PageHeader title="My Wellbeing" subtitle="Small, steady habits for a calmer day." />
      <div className="flex items-start gap-2.5 text-[13px] text-ink-muted">
        <Lock size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <p>Everything here is private to you. Bermi’s administrators can’t read your check-ins, journal, habits, faith or health entries. This is for reflection and routine — not medical advice.</p>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-2">
        <div>
          <Mood today={today} />
          <Breathing today={today} />
          <Guided today={today} />
        </div>
        <div>
          <Habits today={today} />
          <Gratitude today={today} />
          <Sleep prefs={p} onSave={(patch) => prefs.save(patch)} />
        </div>
      </div>

      <Faith prefs={p} today={today} onSave={(patch) => prefs.save(patch)} loading={prefs.loading} />
      <Cycle prefs={p} onSave={(patch) => prefs.save(patch)} />
    </div>
  )
}

// ------------------------------------------------------------- mood

function Mood({ today }: { today: string }) {
  const from = addDays(today, -13)
  const { items, loading, error, reload } = useItems<MoodData>('mood', { from, to: today })
  const act = useAct()
  const mine = items.find((i) => i.data.date === today)
  const [note, setNote] = useState('')
  useEffect(() => setNote(mine?.data.note ?? ''), [mine?.id, mine?.data.note])
  const set = (v: number) =>
    act(async () => {
      if (mine) await lifeApi.update<MoodData>(mine.id, { mood: v, note })
      else await lifeApi.create<MoodData>('mood', { date: today, mood: v, note })
      reload(true)
    }, 'Check-in saved')
  const series = Array.from({ length: 14 }, (_, i) => items.find((m) => m.data.date === addDays(from, i))?.data.mood ?? null)
  const logged = series.filter((x) => x != null) as number[]
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : null
  return (
    <Section title="How are you feeling?">
      {error && !items.length ? <ErrorState error={error} onRetry={() => reload()} compact /> : (
        <>
          <div role="radiogroup" aria-label="Mood today" className="grid grid-cols-5 gap-2">
            {MOODS.map(({ v, label, Icon }) => (
              <button key={v} role="radio" aria-checked={mine?.data.mood === v} disabled={loading} onClick={() => set(v)} className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${mine?.data.mood === v ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'bg-surface-sunken text-ink-muted hover:text-ink'}`}>
                <Icon size={24} aria-hidden /> {label}
              </button>
            ))}
          </div>
          {mine && (
            <div className="mt-3 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything behind that? (optional)" aria-label="Mood note" className={field} />
              <button className={btn.soft} disabled={note === mine.data.note} onClick={() => act(async () => { await lifeApi.update<MoodData>(mine.id, { note }); reload(true) }, 'Saved')}>Save</button>
            </div>
          )}
          {logged.length >= 2 ? (
            <div className="mt-4">
              <Sparkline points={series} label={`Mood over the last 14 days, ${logged.length} check-ins, average ${avg!.toFixed(1)} out of 5`} />
              <p className="mt-1 text-[12.5px] text-ink-muted">{logged.length} check-ins in 14 days · average {avg!.toFixed(1)} / 5</p>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-ink-faint">A trend appears after two or more check-ins.</p>
          )}
        </>
      )}
    </Section>
  )
}

// ------------------------------------------------------------- breathing

const PATTERNS = [
  { id: 'calm', name: 'Calm', hint: 'In 4 · out 6', phases: [['Breathe in', 4], ['Breathe out', 6]] as [string, number][] },
  { id: 'box', name: 'Box', hint: '4 · 4 · 4 · 4', phases: [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]] as [string, number][] },
  { id: '478', name: '4-7-8', hint: 'In 4 · hold 7 · out 8', phases: [['Breathe in', 4], ['Hold', 7], ['Breathe out', 8]] as [string, number][] },
]

function Breathing({ today }: { today: string }) {
  const act = useAct()
  const theme = useOptionalTheme()
  const [pid, setPid] = useState('calm')
  const [cycles, setCycles] = useState(6)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [left, setLeft] = useState(0)
  const pattern = PATTERNS.find((p) => p.id === pid)!
  const startRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const [, dur] = pattern.phases[phase]
    startRef.current = Date.now()
    setLeft(dur)
    const tick = setInterval(() => {
      const remaining = dur - (Date.now() - startRef.current) / 1000
      setLeft(Math.max(0, Math.ceil(remaining)))
      if (remaining <= 0) {
        clearInterval(tick)
        const nextPhase = (phase + 1) % pattern.phases.length
        if (nextPhase === 0) {
          if (cycle + 1 >= cycles) { finish(); return }
          setCycle((c) => c + 1)
        }
        setPhase(nextPhase)
      }
    }, 200)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, cycle])

  const finish = () => {
    setRunning(false)
    const secs = cycles * pattern.phases.reduce((n, [, d]) => n + d, 0)
    act(async () => { await lifeApi.create<SessionData>('session', { date: today, type: 'breathing', minutes: Math.max(1, Math.round(secs / 60)) }); notifyLifeChanged() }, 'Session logged')
  }
  const begin = () => { setCycle(0); setPhase(0); setRunning(true) }
  const label = pattern.phases[phase][0]
  // Circle grows on the way in, shrinks on the way out, holds otherwise.
  const prevIn = pattern.phases.slice(0, phase + 1).reverse().find(([l]) => l !== 'Hold')?.[0] ?? 'Breathe out'
  const big = running && (label === 'Breathe in' || (label === 'Hold' && prevIn === 'Breathe in'))
  const calm = theme?.reducedMotion

  return (
    <Section title="Breathe">
      <div className="flex flex-col items-center">
        <div className="relative grid h-44 w-44 place-items-center" role="img" aria-label={running ? `${label}, ${left} seconds` : 'Breathing guide'}>
          <div className="absolute inset-0 rounded-full border border-edge" aria-hidden />
          <div
            aria-hidden
            className="absolute inset-3 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--primary) 30%, var(--surface-raised)), var(--primary-soft))',
              transform: `scale(${big ? 1 : 0.6})`,
              transition: running && !calm ? `transform ${pattern.phases[phase][1]}s ease-in-out` : 'none',
            }}
          />
          <div className="relative text-center">
            <p className="text-[15px] font-semibold">{running ? label : 'Ready'}</p>
            {running && <p className="text-[24px] font-semibold tabular-nums">{left}</p>}
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-muted" aria-live="polite">{running ? `Round ${cycle + 1} of ${cycles}` : `${pattern.hint} · ${cycles} rounds`}</p>
        {!running ? (
          <>
            <div role="radiogroup" aria-label="Breathing pattern" className="mt-3 flex gap-2">{PATTERNS.map((p) => <Chip key={p.id} active={pid === p.id} onClick={() => setPid(p.id)}>{p.name}</Chip>)}</div>
            <div role="radiogroup" aria-label="Rounds" className="mt-2 flex gap-2">{[4, 6, 10].map((n) => <Chip key={n} active={cycles === n} onClick={() => setCycles(n)}>{n} rounds</Chip>)}</div>
            <button className={`${btn.primary} mt-4`} onClick={begin}><Wind size={16} /> Begin</button>
          </>
        ) : (
          <button className={`${btn.ghost} mt-4`} onClick={() => setRunning(false)}>Stop</button>
        )}
        <p className="mt-3 text-center text-[11.5px] text-ink-faint">Breathe gently and never to the point of discomfort. If you feel dizzy, stop and breathe normally.</p>
      </div>
    </Section>
  )
}

// ------------------------------------------------------------- guided

function Guided({ today }: { today: string }) {
  const content = useAsync(() => lifeApi.content(today), [today])
  const act = useAct()
  const [open, setOpen] = useState<GuidedSession | null>(null)
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [open])
  const sessions = content.data?.sessions ?? []
  return (
    <Section title="Guided sessions">
      {content.loading && !content.data ? <Skeleton className="h-20" /> : content.error && !content.data ? <ErrorState error={content.error} onRetry={() => content.reload()} compact /> : sessions.length === 0 ? (
        <p className="text-[13.5px] text-ink-muted">No guided sessions are published yet.</p>
      ) : (
        <ul className="divide-y divide-edge">
          {sessions.map((s) => (
            <li key={s.id}>
              <button onClick={() => setOpen(s)} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{s.type === 'sleep' ? <Moon size={18} /> : <HeartHandshake size={18} />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{s.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{s.minutes} min · {s.blurb}</span></span>
                <ChevronRight size={16} className="text-ink-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <div>
            <p className="text-[12.5px] text-ink-muted">Step {step + 1} of {open.steps.length} · about {open.minutes} min. Go at your own pace.</p>
            <p className="my-8 text-center text-[19px] leading-relaxed" aria-live="polite">{open.steps[step]}</p>
            <div className="flex gap-2">
              {step > 0 && <button className={btn.ghost} onClick={() => setStep(step - 1)}>Back</button>}
              {step < open.steps.length - 1 ? (
                <button className={`${btn.primary} flex-1`} onClick={() => setStep(step + 1)}>Next</button>
              ) : (
                <button className={`${btn.primary} flex-1`} onClick={() => act(async () => { await lifeApi.create<SessionData>('session', { date: today, type: (open.type as SessionData['type']) ?? 'meditation', minutes: open.minutes }); notifyLifeChanged(); setOpen(null) }, 'Session logged')}><Check size={16} /> Finish</button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </Section>
  )
}

// ------------------------------------------------------------- habits

const streak = (dates: string[], today: string) => {
  const set = new Set(dates)
  let d = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(d)) { n++; d = addDays(d, -1) }
  return n
}

function Habits({ today }: { today: string }) {
  const { items, loading, error, reload } = useItems<HabitData>('habit')
  const act = useAct()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<HabitData['category']>('general')
  const [adding, setAdding] = useState(false)
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const toggle = (h: Item<HabitData>, day: string) =>
    act(async () => {
      const set = new Set(h.data.doneDates)
      set.has(day) ? set.delete(day) : set.add(day)
      await lifeApi.update<HabitData>(h.id, { doneDates: [...set].sort().slice(-400) })
      reload(true)
    })
  const active = items.filter((h) => h.data.active)
  return (
    <Section title="Habits & movement" action={<button className={btn.soft} onClick={() => setAdding((v) => !v)}><Plus size={15} /> Add</button>}>
      {adding && (
        <form className="mb-4 space-y-2" onSubmit={(e) => { e.preventDefault(); act(async () => { await lifeApi.create<HabitData>('habit', { title: title.trim(), category, doneDates: [], active: true }); setTitle(''); setAdding(false); reload(true) }, 'Habit added') }}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Habit" placeholder="e.g. 10-minute walk" className={field} />
          <div role="radiogroup" aria-label="Kind of habit" className="flex flex-wrap gap-2">{(['general', 'movement', 'sleep', 'mind', 'health'] as const).map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}><span className="capitalize">{c}</span></Chip>)}</div>
          <button className={btn.primary} disabled={!title.trim()}>Add habit</button>
        </form>
      )}
      {error && !items.length ? <ErrorState error={error} onRetry={() => reload()} compact /> : loading && !items.length ? <Skeleton className="h-24" /> : active.length === 0 ? (
        <EmptyState icon={<Dumbbell size={24} />} title="No habits yet" body="Pick one small thing you’d like to do most days — a short walk, stretching, a glass of water. Streaks forgive a missed day." />
      ) : (
        <ul className="divide-y divide-edge">
          {active.map((h) => {
            const s = streak(h.data.doneDates, today)
            return (
              <li key={h.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[14.5px] font-medium">{h.data.title}</p>
                  <div className="flex items-center gap-2">
                    {s > 0 && <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"><Flame size={14} aria-hidden /> {s} day{s > 1 ? 's' : ''}</span>}
                    <button className={`${btn.icon} !h-8 !w-8 opacity-60 hover:opacity-100`} aria-label={`Remove ${h.data.title}`} onClick={() => window.confirm(`Remove “${h.data.title}”?`) && act(async () => { await lifeApi.remove(h.id); reload(true) })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div role="group" aria-label={`${h.data.title}, last 7 days`} className="mt-2 flex gap-1.5">
                  {days.map((d) => {
                    const done = h.data.doneDates.includes(d)
                    const wd = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
                    return (
                      <button key={d} onClick={() => toggle(h, d)} aria-pressed={done} aria-label={`${h.data.title} on ${wd} ${fmtDateShort(d)}: ${done ? 'done' : 'not done'}`} className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl text-[11px] ${done ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-muted'} ${d === today ? 'ring-1 ring-primary/50' : ''}`}>
                        <span>{wd.slice(0, 2)}</span>{done ? <Check size={14} aria-hidden /> : <span aria-hidden>·</span>}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <details className="mt-3 text-[13px] text-ink-muted">
        <summary className="min-h-[36px] cursor-pointer font-medium text-ink">Two-minute reset between study blocks</summary>
        <ul className="ml-4 mt-1.5 list-disc space-y-1">
          <li>Stand up and roll your shoulders slowly.</li><li>Look at something far away for 20 seconds.</li><li>Drink some water, then take three slow breaths.</li>
        </ul>
      </details>
    </Section>
  )
}

// ------------------------------------------------------------- gratitude

function Gratitude({ today }: { today: string }) {
  const { items, error, reload } = useItems<GratitudeData>('gratitude', { from: addDays(today, -30), to: today })
  const act = useAct()
  const [text, setText] = useState('')
  const recent = [...items].sort((a, b) => b.data.date.localeCompare(a.data.date)).slice(0, 5)
  return (
    <Section title="Gratitude">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; act(async () => { await lifeApi.create<GratitudeData>('gratitude', { date: today, text: text.trim() }); setText(''); reload(true) }, 'Saved') }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-label="One thing you’re grateful for" placeholder="One thing you’re grateful for today" className={field} />
        <button className={btn.primary} disabled={!text.trim()}>Add</button>
      </form>
      {error && !items.length && <ErrorState error={error} onRetry={() => reload()} compact />}
      {recent.length > 0 && (
        <ul className="mt-3 space-y-2">
          {recent.map((g) => (
            <li key={g.id} className="flex items-start gap-3 text-[14px]">
              <span className="w-12 shrink-0 pt-0.5 text-[12px] text-ink-muted">{g.data.date === today ? 'Today' : fmtDateShort(g.data.date)}</span>
              <span className="min-w-0 flex-1">{g.data.text}</span>
              <button className="text-[12px] text-ink-faint hover:text-ink" aria-label={`Delete: ${g.data.text.slice(0, 30)}`} onClick={() => act(async () => { await lifeApi.remove(g.id); reload(true) })}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// ------------------------------------------------------------- sleep

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fmt = (m: number) => { const x = ((m % 1440) + 1440) % 1440; return new Date(2000, 0, 1, Math.floor(x / 60), x % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }

function Sleep({ prefs, onSave }: { prefs: WellbeingPrefs; onSave: (p: Partial<WellbeingPrefs>) => Promise<unknown> }) {
  const act = useAct()
  const now = useNow(60_000)
  const bed = toMin(prefs.bedtime)
  const wake = toMin(prefs.wakeTime)
  const hours = ((wake - bed + 1440) % 1440) / 60
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const windDown = bed - 45
  const inWindDown = ((nowMin - windDown + 1440) % 1440) < 45
  return (
    <Section title="Sleep & wind-down">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="bed">Bedtime</label><input id="bed" type="time" value={prefs.bedtime} onChange={(e) => e.target.value && act(() => onSave({ bedtime: e.target.value }))} className={field} /></div>
        <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="wake">Wake-up</label><input id="wake" type="time" value={prefs.wakeTime} onChange={(e) => e.target.value && act(() => onSave({ wakeTime: e.target.value }))} className={field} /></div>
      </div>
      <p className="mt-3 text-[13.5px] text-ink-muted">That’s about {hours.toFixed(1)} hours in bed. Wind-down starts around <strong className="text-ink">{fmt(windDown)}</strong>.</p>
      {inWindDown && <p role="status" className="mt-2 rounded-xl bg-primary-soft p-3 text-[13.5px]">It’s wind-down time. Dim your screen, put tomorrow’s to-dos aside, and try a calm breathing round.</p>}
      <ul className="ml-4 mt-2 list-disc space-y-1 text-[13px] text-ink-muted">
        <li>Write down anything unfinished so your mind can let it go.</li><li>Keep your phone out of reach if you can.</li><li>Choose a guided “Sleep” session above if you like.</li>
      </ul>
      <p className="mt-2 text-[11.5px] text-ink-faint">Bermi doesn’t send bedtime reminders unless push notifications are set up for you in Settings.</p>
    </Section>
  )
}

// ------------------------------------------------------------- faith (opt-in)

function Faith({ prefs, today, onSave, loading }: { prefs: WellbeingPrefs; today: string; onSave: (p: Partial<WellbeingPrefs>) => Promise<unknown>; loading: boolean }) {
  const act = useAct()
  const [time, setTime] = useState('')
  const daily = useAsync<{ tradition: string; verse: Verse | null } | null>(() => (prefs.faithEnabled && prefs.faithTradition ? lifeApi.faithDaily(today) : Promise.resolve(null)), [prefs.faithEnabled, prefs.faithTradition, today])
  return (
    <Section title="Faith & reflection (optional)">
      {!prefs.faithEnabled ? (
        <div className="max-w-xl">
          <p className="text-[13.5px] text-ink-muted">This space is <strong className="text-ink">off by default</strong>. If you’d like a daily verse and your own prayer-time notes, you can turn it on. Bermi never guesses your beliefs, never mixes this into other screens, and you can switch it off any time.</p>
          <button className={`${btn.soft} mt-3`} disabled={loading} onClick={() => act(() => onSave({ faithEnabled: true }))}>Turn on</button>
        </div>
      ) : (
        <div className="max-w-xl">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Your tradition</legend>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {([['christian', 'Christian'], ['muslim', 'Muslim'], ['other', 'Other / prefer not to say']] as const).map(([v, l]) => (
                <Chip key={v} active={prefs.faithTradition === v} onClick={() => act(() => onSave({ faithTradition: v }))}>{l}</Chip>
              ))}
            </div>
          </fieldset>
          {prefs.faithTradition && (
            <div className="mt-4" aria-live="polite">
              {daily.loading && !daily.data ? <Skeleton className="h-20" /> : daily.data?.verse ? (
                <figure className="border-l-2 border-primary pl-4">
                  <blockquote className="text-[16px] leading-relaxed">“{daily.data.verse.text}”</blockquote>
                  <figcaption className="mt-1.5 text-[12.5px] text-ink-muted">{daily.data.verse.reference} · {daily.data.verse.translation}</figcaption>
                  {daily.data.verse.prompt && <p className="mt-2 text-[13.5px] text-ink-muted">Reflect: {daily.data.verse.prompt}</p>}
                  <p className="mt-1 text-[11px] text-ink-faint">{daily.data.verse.license}</p>
                </figure>
              ) : (
                <p className="text-[13.5px] text-ink-muted">
                  {prefs.faithTradition === 'muslim' ? 'Bermi doesn’t ship Qur’an text yet — it would need a properly licensed, verified source, and we won’t guess at it. ' : prefs.faithTradition === 'other' ? 'There’s no daily text for this choice. ' : 'No verse is available today. '}
                  Your prayer-time notes below still work.
                </p>
              )}
            </div>
          )}
          <div className="mt-5">
            <p className="mb-1.5 text-[13px] font-medium">Your prayer or quiet times</p>
            <p className="mb-2 text-[12.5px] text-ink-muted">Times you choose yourself. Bermi shows them here but doesn’t send alerts unless push is set up.</p>
            <div className="flex flex-wrap gap-2">
              {prefs.prayerTimes.map((t) => (
                <span key={t} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-surface-sunken pl-3.5 pr-1 text-[13px] tabular-nums">{fmt(toMin(t))}<button className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:text-ink" aria-label={`Remove ${fmt(toMin(t))}`} onClick={() => act(() => onSave({ prayerTimes: prefs.prayerTimes.filter((x) => x !== t) }))}>×</button></span>
              ))}
              {prefs.prayerTimes.length < 6 && (
                <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (time && !prefs.prayerTimes.includes(time)) act(async () => { await onSave({ prayerTimes: [...prefs.prayerTimes, time].sort() }); setTime('') }) }}>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Add a time" className={`${field} !w-auto !py-1.5`} />
                  <button className={btn.ghost} disabled={!time}>Add</button>
                </form>
              )}
            </div>
          </div>
          <button className="mt-5 text-[13px] text-ink-muted underline underline-offset-2" onClick={() => window.confirm('Turn off the faith space? Your choices stay saved but nothing is shown.') && act(() => onSave({ faithEnabled: false }))}>Turn this space off</button>
        </div>
      )}
    </Section>
  )
}

// ------------------------------------------------------------- cycle (opt-in, private)

function Cycle({ prefs, onSave }: { prefs: WellbeingPrefs; onSave: (p: Partial<WellbeingPrefs>) => Promise<unknown> }) {
  const act = useAct()
  const { items, reload, loading } = useItems<CycleData>('cycle')
  const [note, setNote] = useState('')
  const today = todayYmd()
  const stats = useMemo(() => {
    const starts = items.filter((i) => i.data.kind === 'period_start').map((i) => i.data.date).sort()
    const gaps = starts.slice(1).map((d, i) => Math.round((new Date(d).getTime() - new Date(starts[i]).getTime()) / 86_400_000)).filter((g) => g >= 15 && g <= 60)
    const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null
    const last = starts[starts.length - 1] ?? null
    return { last, avg, next: last && avg ? addDays(last, avg) : null, n: gaps.length }
  }, [items])
  const log = (kind: CycleData['kind']) => act(async () => { await lifeApi.create<CycleData>('cycle', { date: today, kind, note: kind === 'symptom' ? note : '' }); setNote(''); reload(true) }, 'Logged')

  if (!prefs.cycleEnabled)
    return (
      <Section title="Cycle tracking (optional)">
        <p className="max-w-xl text-[13.5px] text-ink-muted">A private log of period dates and notes, if you want one. <strong className="text-ink">Off by default.</strong> It’s stored only against your account, is never shown on other screens or used for ads, and you can delete it all at any time.</p>
        <button className={`${btn.soft} mt-3`} onClick={() => act(() => onSave({ cycleEnabled: true }))}>Turn on</button>
      </Section>
    )
  return (
    <Section title="Cycle tracking">
      <div className="max-w-xl">
        <div className="flex flex-wrap gap-2">
          <button className={btn.primary} disabled={loading} onClick={() => log('period_start')}>Period started today</button>
          <button className={btn.ghost} disabled={loading} onClick={() => log('period_end')}>Period ended today</button>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Symptom or note" placeholder="Note how you feel (optional)" className={field} />
          <button className={btn.ghost} disabled={!note.trim()} onClick={() => log('symptom')}>Log note</button>
        </div>
        <div className="mt-4 text-[13.5px]">
          {stats.last ? (
            <p>Last period started <strong>{fmtDateShort(stats.last)}</strong>.{stats.avg ? <> Your logs suggest a cycle of about <strong>{stats.avg} days</strong>, so the next might start around <strong>{fmtDateShort(stats.next!)}</strong>.</> : ' Log a couple more cycles to see an estimate.'}</p>
          ) : (
            <p className="text-ink-muted">Nothing logged yet.</p>
          )}
        </div>
        <p className="mt-2 rounded-xl bg-surface-sunken p-3 text-[12px] text-ink-muted">This is a simple average of what you’ve logged. It is an estimate only — not medical advice, not a fertility or contraception tool, and not a diagnosis. See a health professional about anything that worries you.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
          <button className="text-ink-muted underline underline-offset-2" onClick={() => window.confirm('Turn off cycle tracking? Your entries stay saved until you delete them.') && act(() => onSave({ cycleEnabled: false }))}>Turn off</button>
          <button className="text-ink-muted underline underline-offset-2" onClick={() => window.confirm('Permanently delete every cycle entry? This can’t be undone.') && act(async () => { await Promise.all(items.map((i) => lifeApi.remove(i.id))); reload(true) }, 'Cycle data deleted')}>Delete all cycle data</button>
        </div>
      </div>
    </Section>
  )
}
