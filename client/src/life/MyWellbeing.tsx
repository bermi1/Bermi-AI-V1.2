import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Droplet, Dumbbell, Flame, Frown, HeartHandshake, Lock, Meh, Moon, Plus, Smile, SmilePlus, Trash2, Wind, Angry } from 'lucide-react'
import { addDays, lifeApi, type GratitudeData, type GuidedSession, type HabitData, type Item, type MoodData, type SessionData, type Verse, type WellbeingPrefs } from './api'
import { useAct, useItems, useNow, useSingleton, useToday } from './hooks'
import { useOptionalTheme } from '../lib/theme'
import {
  btn, Chip, EmptyState, ErrorState, field, fmtDateShort, Hero, Section, Sheet, Skeleton, Sparkline, useAsync, notifyLifeChanged,
} from './ui'

const MOODS = [
  { v: 1, label: 'Rough', Icon: Angry },
  { v: 2, label: 'Low', Icon: Frown },
  { v: 3, label: 'Okay', Icon: Meh },
  { v: 4, label: 'Good', Icon: Smile },
  { v: 5, label: 'Great', Icon: SmilePlus },
]
const DEFAULT_PREFS: WellbeingPrefs = { faithEnabled: false, faithTradition: '', prayerTimes: [], cycleEnabled: false, bedtime: '22:30', wakeTime: '06:30', cycleLength: 28, periodLength: 5 }

export function MyWellbeing({ go }: { go: (to: string) => void }) {
  const today = useToday()
  const prefs = useSingleton<WellbeingPrefs>('wellbeing_prefs')
  const p = prefs.data ?? DEFAULT_PREFS

  if (prefs.error && !prefs.data) return (<div><Hero title="My Wellbeing" /><ErrorState error={prefs.error} onRetry={() => prefs.reload()} /></div>)

  return (
    <div>
      <Hero kicker="Small, steady habits for a calmer day" title="How are you feeling today?">
        <Mood today={today} />
        <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-white/65">
          <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>Private to you — Bermi’s administrators can’t read your check-ins, journal, habits, faith or health entries. For reflection and routine, not medical advice.</span>
        </p>
      </Hero>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 lg:grid-cols-2">
        <div>
          <Breathing today={today} />
          <Guided today={today} />
        </div>
        <div>
          <Habits today={today} />
          <Gratitude today={today} />
          <Sleep prefs={p} onSave={(patch) => prefs.save(patch)} />
        </div>
      </div>

      <CycleCard prefs={p} go={go} />
      <Faith prefs={p} today={today} onSave={(patch) => prefs.save(patch)} loading={prefs.loading} />
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
    <div className="mt-5">
      {error && !items.length ? <ErrorState error={error} onRetry={() => reload()} compact /> : (
        <>
          <div role="radiogroup" aria-label="Mood today" className="scroll-x -mx-1 flex justify-between gap-2 overflow-x-auto px-1">
            {MOODS.map(({ v, label, Icon }) => {
              const on = mine?.data.mood === v
              return (
                <button key={v} role="radio" aria-checked={on} disabled={loading} onClick={() => set(v)} className="flex min-w-[56px] flex-1 flex-col items-center gap-1.5 focus-visible:outline-none">
                  <span className={`grid h-[54px] w-[54px] place-items-center rounded-full transition-colors ${on ? 'bg-white text-[#0B1020]' : 'bg-white/10 text-white hover:bg-white/20'}`}><Icon size={25} aria-hidden /></span>
                  <span className={`text-[12px] ${on ? 'font-semibold text-white' : 'text-white/65'}`}>{label}</span>
                </button>
              )
            })}
          </div>
          {mine && (
            <div className="mt-4 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything behind that? (optional)" aria-label="Mood note" className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/55 focus-visible:ring-2 focus-visible:ring-white" />
              <button className="min-h-[44px] rounded-2xl bg-white px-4 text-[13.5px] font-semibold text-[#0B1020] disabled:opacity-40" disabled={note === mine.data.note} onClick={() => act(async () => { await lifeApi.update<MoodData>(mine.id, { note }); reload(true) }, 'Saved')}>Save</button>
            </div>
          )}
          <div className="tile-glass mt-4 p-4">
            {logged.length >= 2 ? (
              <>
                <Sparkline onDark height={44} points={series} label={`Mood over the last 14 days, ${logged.length} check-ins, average ${avg!.toFixed(1)} out of 5`} />
                <p className="mt-1.5 text-[12.5px] text-white/70">{logged.length} check-ins in 14 days · average {avg!.toFixed(1)} / 5</p>
              </>
            ) : (
              <p className="text-[12.5px] text-white/70">Your 14-day trend appears after two check-ins.</p>
            )}
          </div>
        </>
      )}
    </div>
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
    <section className="tile-accent mb-3 p-4 sm:mb-4 sm:p-5" aria-label="Breathe">
      <h2 className="text-[16px] font-semibold tracking-tight">Breathe</h2>
      <div className="mt-3 flex flex-col items-center">
        <div className="relative grid h-48 w-48 place-items-center" role="img" aria-label={running ? `${label}, ${left} seconds` : 'Breathing guide'}>
          <div className="absolute inset-0 rounded-full border border-white/25" aria-hidden />
          <div
            aria-hidden
            className="absolute inset-3 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 30%, rgb(255 255 255 / .55), rgb(255 255 255 / .12))',
              boxShadow: '0 0 50px rgb(255 255 255 / .25)',
              transform: `scale(${big ? 1 : 0.6})`,
              transition: running && !calm ? `transform ${pattern.phases[phase][1]}s ease-in-out` : 'none',
            }}
          />
          <div className="relative text-center">
            <p className="text-[15px] font-semibold">{running ? label : 'Ready'}</p>
            {running && <p className="text-[28px] font-semibold tabular-nums leading-tight">{left}</p>}
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-white/75" aria-live="polite">{running ? `Round ${cycle + 1} of ${cycles}` : `${pattern.hint} · ${cycles} rounds`}</p>
        {!running ? (
          <>
            <div role="radiogroup" aria-label="Breathing pattern" className="mt-3 flex gap-2">{PATTERNS.map((p) => <button key={p.id} role="radio" aria-checked={pid === p.id} onClick={() => setPid(p.id)} className={`min-h-[36px] rounded-full px-4 text-[13px] font-medium ${pid === p.id ? 'bg-white text-[#0B1020]' : 'bg-white/15 text-white hover:bg-white/25'}`}>{p.name}</button>)}</div>
            <div role="radiogroup" aria-label="Rounds" className="mt-2 flex gap-2">{[4, 6, 10].map((n) => <button key={n} role="radio" aria-checked={cycles === n} onClick={() => setCycles(n)} className={`min-h-[34px] rounded-full px-3.5 text-[12.5px] font-medium ${cycles === n ? 'bg-white/90 text-[#0B1020]' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}>{n} rounds</button>)}</div>
            <button className="mt-4 inline-flex min-h-[46px] items-center gap-2 rounded-full bg-white px-6 text-[14.5px] font-semibold text-[#0B1020]" onClick={begin}><Wind size={17} /> Begin</button>
          </>
        ) : (
          <button className="mt-4 min-h-[44px] rounded-full bg-white/15 px-6 text-[14px] font-medium text-white" onClick={() => setRunning(false)}>Stop</button>
        )}
        <p className="mt-3 text-center text-[11.5px] text-white/60">Breathe gently and never to the point of discomfort. If you feel dizzy, stop and breathe normally.</p>
      </div>
    </section>
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

// ------------------------------------------------------------- period tracker entry point

function CycleCard({ prefs, go }: { prefs: WellbeingPrefs; go: (to: string) => void }) {
  return (
    <section className="tile mb-3 flex items-center gap-4 p-4 sm:mb-4 sm:p-5" aria-label="Period tracker">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(145deg,#FF8FB1,#C2255C)' }}><Droplet size={22} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Period tracker</h2>
        <p className="text-[13px] text-ink-muted">{prefs.cycleEnabled ? 'Your private cycle calendar, predictions and symptom log.' : 'Optional and private — for people who have periods. Off by default.'}</p>
      </div>
      <button className={btn.soft} onClick={() => go('/my/cycle')}>{prefs.cycleEnabled ? 'Open' : 'Set up'}</button>
    </section>
  )
}
