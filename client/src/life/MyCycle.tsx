import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Droplet, Lock, Trash2 } from 'lucide-react'
import { addDays, lifeApi, todayYmd, type CycleData, type Item, type WellbeingPrefs } from './api'
import { analyse, daysBetween, phaseOf, PHASES, type CycleInfo } from './cycleMath'
import { useAct, useItems, useSingleton, useToday } from './hooks'
import { BarBlobs, btn, Chip, DayStrip, ErrorState, field, fmtDateShort, Hero, Section, Sheet, Skeleton } from './ui'

// A private period tracker. It carries its own warm palette (data-accent="rose"
// is applied by the shell for this screen only). Every prediction is a plain
// average of what the person logged — an estimate, never medical advice.

const FLOWS: { id: CycleData['flow']; label: string }[] = [
  { id: 'spotting', label: 'Spotting' }, { id: 'light', label: 'Light' }, { id: 'medium', label: 'Medium' }, { id: 'heavy', label: 'Heavy' },
]
const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Mood swings', 'Acne', 'Back pain', 'Nausea', 'Tender breasts', 'Cravings', 'Poor sleep', 'Low mood']
const DEFAULTS: WellbeingPrefs = { faithEnabled: false, faithTradition: '', prayerTimes: [], cycleEnabled: false, bedtime: '22:30', wakeTime: '06:30', cycleLength: 28, periodLength: 5 }

export function MyCycle({ go }: { go: (to: string) => void }) {
  const today = useToday()
  const prefs = useSingleton<WellbeingPrefs>('wellbeing_prefs')
  const log = useItems<CycleData>('cycle')
  const act = useAct()
  const p = prefs.data ?? DEFAULTS
  const [logDate, setLogDate] = useState<string | null>(null)
  const [month, setMonth] = useState(() => today.slice(0, 7))

  const info = useMemo(() => analyse(log.items, { cycle: p.cycleLength, period: p.periodLength }), [log.items, p.cycleLength, p.periodLength])
  const week = Array.from({ length: 14 }, (_, i) => addDays(today, i - 10))

  if (prefs.error && !prefs.data) return <div><Hero title="Period tracker" /><ErrorState error={prefs.error} onRetry={() => prefs.reload()} /></div>

  const back = (
    <button onClick={() => go('/my/wellbeing')} className="mb-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/12 px-3.5 text-[13px] font-medium text-white hover:bg-white/20"><ArrowLeft size={15} /> Wellbeing</button>
  )

  if (!prefs.loading && !p.cycleEnabled)
    return (
      <div>
        <Hero kicker="Private · opt-in" title="Period tracker">
          {back}
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/80">Log periods and how you feel, see where you are in your cycle and get an estimate of what’s next. It’s for people who have periods, off by default, and stored only against your account — never shown elsewhere and never readable by Bermi’s administrators.</p>
          <button className="mt-4 min-h-[46px] rounded-full bg-white px-6 text-[14.5px] font-semibold text-[#2A0F1B]" onClick={() => act(() => prefs.save({ cycleEnabled: true }))}>Turn on the period tracker</button>
        </Hero>
      </div>
    )

  const lastStart = info.lastStart
  const dayN = lastStart ? daysBetween(lastStart, today) + 1 : null
  const phase = dayN ? phaseOf(((dayN - 1) % Math.max(info.avgCycle, 21)) + 1, info) : null
  const phaseLabel = phase ? PHASES.find((x) => x.id === phase)!.label : null
  const untilNext = info.nextStart ? daysBetween(today, info.nextStart) : null

  const startToday = (d: string) => act(async () => {
    if (!log.items.some((i) => i.data.kind === 'period_start' && i.data.date === d)) await lifeApi.create<CycleData>('cycle', { date: d, kind: 'period_start' })
    log.reload(true)
  }, 'Period start logged')
  const endToday = (d: string) => act(async () => {
    await lifeApi.create<CycleData>('cycle', { date: d, kind: 'period_end' })
    log.reload(true)
  }, 'Period end logged')

  return (
    <div>
      <Hero kicker="Private to you" title="Period tracker">
        {back}
        <div className="mt-2 flex flex-col items-center md:flex-row md:items-center md:gap-10">
          <Dial info={info} dayN={dayN} label={phaseLabel} />
          <div className="mt-4 w-full max-w-sm md:mt-0">
            {untilNext != null ? (
              <p className="text-[18px] font-semibold leading-snug">{untilNext > 0 ? `Next period in about ${untilNext} day${untilNext === 1 ? '' : 's'}` : untilNext === 0 ? 'Your period is expected today' : `${-untilNext} day${untilNext === -1 ? '' : 's'} past the estimate`}</p>
            ) : (
              <p className="text-[16px] font-medium">Log the first day of your last period to start.</p>
            )}
            <p className="mt-1 text-[12.5px] text-white/70">{info.fromHistory ? `Estimate from your last ${info.cycleLengths.slice(-6).length} cycle${info.cycleLengths.slice(-6).length === 1 ? '' : 's'}` : `Using a typical ${info.avgCycle}-day cycle until you’ve logged more`}{info.range ? ` · yours range ${info.range[0]}–${info.range[1]} days` : ''}. An estimate only.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="min-h-[44px] rounded-full bg-white px-5 text-[14px] font-semibold text-[#2A0F1B]" onClick={() => startToday(today)}>Period started today</button>
              <button className="min-h-[44px] rounded-full bg-white/15 px-5 text-[14px] font-medium text-white hover:bg-white/25" onClick={() => endToday(today)}>Period ended</button>
            </div>
          </div>
        </div>
        <DayStrip days={week} value={logDate ?? today} today={today} onPick={(d) => setLogDate(d)} />
        <p className="mt-1 text-[12px] text-white/60">Tap a day to log how you feel.</p>
      </Hero>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 lg:grid-cols-2">
        <div>
          <Section title="Calendar" action={<MonthNav month={month} setMonth={setMonth} />}>
            {log.loading && !log.items.length ? <Skeleton className="h-56" /> : <Month month={month} today={today} info={info} onPick={setLogDate} />}
            <Legend />
          </Section>
          <Section title="Phases">
            <ul className="space-y-2.5">
              {PHASES.map((ph) => (
                <li key={ph.id} className={`rounded-2xl p-3.5 ${ph.id === phase ? 'bg-primary-soft ring-1 ring-primary/40' : 'bg-surface-sunken'}`}>
                  <p className="text-[14px] font-semibold">{ph.label}{ph.id === phase && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-on-primary">now</span>}</p>
                  <p className="mt-0.5 text-[13px] text-ink-muted">{ph.blurb}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">General information, not medical advice. Ovulation timing here is an average-based guess — it is not a fertility test and must not be used to avoid or plan pregnancy.</p>
          </Section>
        </div>
        <div>
          <Insights info={info} />
          <History info={info} />
          <Settings p={p} onSave={(patch) => act(() => prefs.save(patch), 'Saved')} onTurnOff={() => window.confirm('Turn off the period tracker? Your entries stay saved until you delete them.') && act(async () => { await prefs.save({ cycleEnabled: false }); go('/my/wellbeing') })} onDelete={() => window.confirm('Permanently delete every period-tracker entry? This can’t be undone.') && act(async () => { await lifeApi.removeKind('cycle'); log.reload(true) }, 'All period-tracker data deleted')} />
        </div>
      </div>

      <LogSheet date={logDate} items={log.items} info={info} onClose={() => setLogDate(null)} onChanged={() => log.reload(true)} onStart={startToday} onEnd={endToday} />
    </div>
  )
}

// ------------------------------------------------------------ dial

function Dial({ info, dayN, label }: { info: CycleInfo; dayN: number | null; label: string | null }) {
  const size = 232
  const r = 96
  const c = size / 2
  const len = Math.max(info.avgCycle, dayN && dayN > info.avgCycle ? dayN : info.avgCycle)
  const ang = (d: number) => ((d - 1) / len) * 2 * Math.PI - Math.PI / 2
  const pt = (d: number, rr = r) => [c + rr * Math.cos(ang(d)), c + rr * Math.sin(ang(d))] as const
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a)
    const [x2, y2] = pt(b + 1)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${b - a + 1 > len / 2 ? 1 : 0} 1 ${x2} ${y2}`
  }
  const ov = Math.max(info.avgCycle - 14, info.avgPeriod + 3)
  const cur = dayN ? Math.min(dayN, len) : null
  return (
    <div className="relative h-[188px] w-[188px] shrink-0 md:h-[232px] md:w-[232px]" role="img" aria-label={dayN ? `Day ${dayN} of about ${info.avgCycle}${label ? `, ${label} phase` : ''}` : 'Cycle dial — no period logged yet'}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgb(255 255 255 / .16)" strokeWidth="18" />
        <path d={arc(1, info.avgPeriod)} fill="none" stroke="#FF8FB1" strokeWidth="18" strokeLinecap="round" />
        {(() => { const [x, y] = pt(ov); return <circle cx={x} cy={y} r="8" fill="#FFC857" stroke="rgb(0 0 0 / .25)" strokeWidth="2" /> })()}
        {cur && (() => { const [x, y] = pt(cur); return <circle cx={x} cy={y} r="11" fill="#fff" stroke="#FF8FB1" strokeWidth="5" style={{ filter: 'drop-shadow(0 0 10px rgb(255 255 255 / .6))' }} /> })()}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <Droplet size={18} className="mx-auto text-[#FF8FB1]" aria-hidden />
          <p className="mt-1 text-[12.5px] text-white/70">{label ?? 'Cycle'}</p>
          <p className="text-[38px] font-semibold leading-none tabular-nums md:text-[46px]">{dayN ?? '–'}</p>
          <p className="mt-1 text-[12px] text-white/65">{dayN ? `of about ${info.avgCycle} days` : 'log a period'}</p>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ calendar

function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const shift = (n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const [y, m] = month.split('-').map(Number)
  return (
    <div className="flex items-center gap-1">
      <button className={`${btn.icon} !h-9 !w-9`} onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={17} /></button>
      <span className="min-w-[110px] text-center text-[13.5px] font-medium">{new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
      <button className={`${btn.icon} !h-9 !w-9`} onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={17} /></button>
    </div>
  )
}

function Month({ month, today, info, onPick }: { month: string; today: string; info: CycleInfo; onPick: (d: string) => void }) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7 // Monday-first
  const count = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-ink-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const period = info.periodDays.has(d)
          const pred = !period && info.predictedDays.has(d)
          const ovu = info.ovulation === d
          const flow = info.flow.get(d)
          return (
            <button key={d} onClick={() => onPick(d)} aria-label={`${fmtDateShort(d)}${period ? ', period' : ''}${pred ? ', period expected (estimate)' : ''}${ovu ? ', estimated ovulation' : ''}${flow ? `, ${flow} flow` : ''}${d === today ? ', today' : ''}`} className="grid h-11 place-items-center focus-visible:outline-none">
              <span className={`relative grid h-9 w-9 place-items-center rounded-full text-[13.5px] tabular-nums transition-colors ${period ? 'bg-primary font-semibold text-on-primary' : pred ? 'border-2 border-dashed border-primary text-primary' : 'text-ink hover:bg-surface-sunken'} ${d === today ? 'ring-2 ring-offset-2 ring-ink/70 ring-offset-[var(--surface-raised)]' : ''}`}>
                {Number(d.slice(8))}
                {ovu && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#F4B63F] ring-2 ring-[var(--surface-raised)]" />}
                {flow && <span aria-hidden className="absolute -bottom-0.5 h-1 w-3 rounded-full bg-white/80" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-muted">
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-primary" /> Period</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full border-2 border-dashed border-primary" /> Expected (estimate)</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-[#F4B63F]" /> Ovulation (rough estimate)</li>
    </ul>
  )
}

// ------------------------------------------------------------ insights / history / settings

function Insights({ info }: { info: CycleInfo }) {
  const last = info.cycleLengths.slice(-6)
  return (
    <Section title="Your patterns">
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[['Cycle', `${info.avgCycle}d`, info.fromHistory ? 'average' : 'typical'], ['Period', `${info.avgPeriod}d`, info.periodLengths.length ? 'average' : 'typical'], ['Logged', String(info.starts.length), info.starts.length === 1 ? 'period' : 'periods']].map(([l, v, h]) => (
          <div key={l} className="rounded-2xl bg-surface-sunken p-3"><dt className="text-[11.5px] text-ink-muted">{l}</dt><dd className="mt-0.5 text-[22px] font-semibold tabular-nums">{v}</dd><dd className="text-[11.5px] text-ink-muted">{h}</dd></div>
        ))}
      </dl>
      {last.length >= 2 ? (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] font-medium text-ink-muted">Length of your last {last.length} cycles (days)</p>
          <BarBlobs values={last} labels={last.map(String)} highlight={last.length - 1} label={`Cycle lengths in days: ${last.join(', ')}`} />
          {info.range && <p className="mt-2 text-[12.5px] text-ink-muted">Ranging {info.range[0]}–{info.range[1]} days{info.range[1] - info.range[0] > 7 ? ' — fairly variable, so predictions are rougher' : ''}.</p>}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-ink-muted">Patterns appear after you’ve logged the start of two or more periods.</p>
      )}
    </Section>
  )
}

function History({ info }: { info: CycleInfo }) {
  const rows = [...info.starts].reverse().slice(0, 10)
  return (
    <Section title="History">
      {rows.length === 0 ? <p className="text-[13.5px] text-ink-muted">Your logged periods will be listed here.</p> : (
        <ul className="divide-y divide-edge">
          {rows.map((s, i) => {
            const next = i === 0 ? null : [...info.starts].reverse()[i - 1]
            const len = next ? daysBetween(s, next) : null
            return (
              <li key={s} className="flex items-center gap-3 py-2.5 text-[14px]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary"><Droplet size={16} aria-hidden /></span>
                <span className="flex-1">{fmtDateShort(s)}</span>
                <span className="text-[12.5px] text-ink-muted">{len ? `${len}-day cycle` : 'current'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function Settings({ p, onSave, onTurnOff, onDelete }: { p: WellbeingPrefs; onSave: (patch: Partial<WellbeingPrefs>) => void; onTurnOff: () => void; onDelete: () => void }) {
  const [cl, setCl] = useState(String(p.cycleLength))
  const [pl, setPl] = useState(String(p.periodLength))
  useEffect(() => { setCl(String(p.cycleLength)); setPl(String(p.periodLength)) }, [p.cycleLength, p.periodLength])
  const ok = Number(cl) >= 21 && Number(cl) <= 45 && Number(pl) >= 2 && Number(pl) <= 10
  return (
    <Section title="Settings & privacy">
      <p className="mb-3 text-[13px] text-ink-muted">Used for estimates until you’ve logged enough of your own cycles.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="cl" className="mb-1.5 block text-[13px] font-medium">Typical cycle (days)</label><input id="cl" type="number" min={21} max={45} value={cl} onChange={(e) => setCl(e.target.value)} className={field} /></div>
        <div><label htmlFor="pl" className="mb-1.5 block text-[13px] font-medium">Typical period (days)</label><input id="pl" type="number" min={2} max={10} value={pl} onChange={(e) => setPl(e.target.value)} className={field} /></div>
      </div>
      <button className={`${btn.soft} mt-3`} disabled={!ok || (Number(cl) === p.cycleLength && Number(pl) === p.periodLength)} onClick={() => onSave({ cycleLength: Number(cl), periodLength: Number(pl) })}>Save</button>
      <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted"><Lock size={14} className="mt-0.5 shrink-0" aria-hidden /> Stored only against your account. Bermi’s administrators can’t read it, it isn’t used for ads, and it’s never sent to the AI. This is a tracking aid — not medical advice, not a diagnosis and not contraception. Please see a health professional about anything that worries you (very heavy, painful or irregular periods, or a missed period).</p>
      <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
        <button className="text-ink-muted underline underline-offset-2" onClick={onTurnOff}>Turn off</button>
        <button className="inline-flex items-center gap-1 text-ink-muted underline underline-offset-2" onClick={onDelete}><Trash2 size={13} /> Delete all period-tracker data</button>
      </div>
    </Section>
  )
}

// ------------------------------------------------------------ day log

function LogSheet({ date, items, info, onClose, onChanged, onStart, onEnd }: { date: string | null; items: Item<CycleData>[]; info: CycleInfo; onClose: () => void; onChanged: () => void; onStart: (d: string) => void; onEnd: (d: string) => void }) {
  const act = useAct()
  const existing = date ? items.find((i) => i.data.kind === 'log' && i.data.date === date) : undefined
  const [flow, setFlow] = useState<CycleData['flow']>('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [mood, setMood] = useState<number | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => { setFlow(existing?.data.flow ?? ''); setSymptoms(existing?.data.symptoms ?? []); setMood(existing?.data.mood ?? null); setNote(existing?.data.note ?? '') }, [date, existing?.id])
  if (!date) return <Sheet open={false} onClose={onClose} title="" children={null} />
  const isStart = items.some((i) => i.data.kind === 'period_start' && i.data.date === date)
  const save = () => act(async () => {
    const body = { date, kind: 'log' as const, flow, symptoms, mood, note }
    if (existing) await lifeApi.update<CycleData>(existing.id, body)
    else await lifeApi.create<CycleData>('cycle', body)
    onChanged(); onClose()
  }, 'Saved')
  const clear = () => act(async () => { for (const i of items.filter((x) => x.data.date === date)) await lifeApi.remove(i.id); onChanged(); onClose() }, 'Cleared')
  return (
    <Sheet open onClose={onClose} title={new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button className={btn.soft} disabled={isStart} onClick={() => { onStart(date); onClose() }}>{isStart ? 'Period started this day' : 'Period started this day'}</button>
          <button className={btn.ghost} onClick={() => { onEnd(date); onClose() }}>Period ended this day</button>
        </div>
        <fieldset><legend className="mb-1.5 text-[13px] font-medium">Flow</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">{FLOWS.map((f) => <Chip key={f.id} active={flow === f.id} onClick={() => setFlow(flow === f.id ? '' : f.id)}>{f.label}</Chip>)}</div></fieldset>
        <fieldset><legend className="mb-1.5 text-[13px] font-medium">Symptoms</legend>
          <div className="flex flex-wrap gap-2">{SYMPTOMS.map((s) => { const on = symptoms.includes(s); return <button key={s} type="button" aria-pressed={on} onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s].slice(0, 12))} className={`min-h-[34px] rounded-full px-3.5 text-[13px] font-medium ${on ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'bg-surface-sunken text-ink-muted hover:text-ink'}`}>{s}</button> })}</div></fieldset>
        <fieldset><legend className="mb-1.5 text-[13px] font-medium">Mood</legend>
          <div role="radiogroup" className="flex gap-2">{[['Rough', 1], ['Low', 2], ['Okay', 3], ['Good', 4], ['Great', 5]].map(([l, v]) => <Chip key={v} active={mood === v} onClick={() => setMood(mood === v ? null : (v as number))}>{l}</Chip>)}</div></fieldset>
        <div><label htmlFor="cn" className="mb-1.5 block text-[13px] font-medium">Note</label><textarea id="cn" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} className={`${field} resize-none`} /></div>
        <div className="flex gap-2"><button className={`${btn.primary} flex-1`} onClick={save}>Save</button>{(existing || isStart) && <button className={btn.ghost} onClick={clear}>Clear day</button>}</div>
        {info.starts.length === 0 && <p className="text-[12px] text-ink-faint">Tip: mark the first day of your last period so Bermi can show where you are in your cycle.</p>}
        {date > todayYmd() && <p className="text-[12px] text-ink-faint">This day is in the future.</p>}
      </div>
    </Sheet>
  )
}
