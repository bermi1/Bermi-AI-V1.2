import { useEffect, useState } from 'react'
import { BellOff, Check } from 'lucide-react'
import { lifeApi, type ProfileData } from './api'
import { useSingleton } from './hooks'
import { btn, Chip, ErrorState, field, Skeleton, Spinner, ToastProvider, useAsync, useToast } from './ui'

const Head = ({ title, sub }: { title: string; sub?: string }) => (
  <header className="mb-5">
    <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
    {sub && <p className="mt-1 text-[13.5px] text-ink-muted">{sub}</p>}
  </header>
)

// ------------------------------------------------------------ personalisation

const STYLES: { id: ProfileData['learningStyle']; label: string }[] = [
  { id: '', label: 'No preference' }, { id: 'reading', label: 'Reading' }, { id: 'listening', label: 'Listening' }, { id: 'practice', label: 'Practice' }, { id: 'visual', label: 'Visual' },
]
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12)

export function PersonalTab() {
  return <ToastProvider><Personal /></ToastProvider>
}

function Personal() {
  const p = useSingleton<ProfileData>('profile')
  const toast = useToast()
  const [goals, setGoals] = useState('')
  const [interests, setInterests] = useState('')
  const [style, setStyle] = useState<ProfileData['learningStyle']>('')
  const [hours, setHours] = useState('8')
  const [plan, setPlan] = useState('07:30')
  const [ws, setWs] = useState('16:00')
  const [we, setWe] = useState('20:00')
  const [ctx, setCtx] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const d = p.data
    if (!d) return
    setGoals(d.goals.join(', ')); setInterests(d.interests.join(', ')); setStyle(d.learningStyle); setHours(String(d.studyHoursPerWeek))
    setPlan(d.planningTime); setWs(d.studyWindowStart); setWe(d.studyWindowEnd); setCtx(d.assistantContext)
  }, [p.data])
  if (p.loading && !p.item) return <Skeleton className="h-48" />
  if (p.error && !p.item && !p.data) return <ErrorState error={p.error} onRetry={() => p.reload()} compact />
  const save = async () => {
    setBusy(true)
    try {
      await p.save({ goals: list(goals), interests: list(interests), learningStyle: style, studyHoursPerWeek: Number(hours) || 0, planningTime: plan, studyWindowStart: ws, studyWindowEnd: we, assistantContext: ctx })
      toast('Saved')
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <div className="max-w-xl space-y-5">
      <Head title="Personalisation" sub="Used to shape study plans and suggestions. All optional, all yours to change." />
      <div><label htmlFor="pg" className="mb-1.5 block text-[13px] font-medium">What are you working towards? (separate with commas)</label><input id="pg" value={goals} onChange={(e) => setGoals(e.target.value)} className={field} placeholder="Pass my exams, learn to code" /></div>
      <div><label htmlFor="pi" className="mb-1.5 block text-[13px] font-medium">Interests</label><input id="pi" value={interests} onChange={(e) => setInterests(e.target.value)} className={field} placeholder="Entrepreneurship, football, design" /></div>
      <fieldset><legend className="mb-1.5 text-[13px] font-medium">How do you like to learn?</legend><div role="radiogroup" className="flex flex-wrap gap-2">{STYLES.map((s) => <Chip key={s.id || 'none'} active={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</Chip>)}</div></fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="ph" className="mb-1.5 block text-[13px] font-medium">Study hours per week</label><input id="ph" type="number" min={0} max={80} value={hours} onChange={(e) => setHours(e.target.value)} className={field} /></div>
        <div><label htmlFor="pp" className="mb-1.5 block text-[13px] font-medium">Planning time</label><input id="pp" type="time" value={plan} onChange={(e) => setPlan(e.target.value)} className={field} /></div>
        <div><label htmlFor="ws" className="mb-1.5 block text-[13px] font-medium">Study window starts</label><input id="ws" type="time" value={ws} onChange={(e) => setWs(e.target.value)} className={field} /></div>
        <div><label htmlFor="we" className="mb-1.5 block text-[13px] font-medium">Study window ends</label><input id="we" type="time" value={we} onChange={(e) => setWe(e.target.value)} className={field} /></div>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-edge p-3.5 text-[13.5px]">
        <input type="checkbox" checked={ctx} onChange={(e) => setCtx(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
        <span><span className="block font-medium">Let Bermi use my goals and schedule as context</span><span className="text-ink-muted">When on, the companion can take your calendar into account when planning. Money, health, faith and journal entries are never sent to the AI unless you paste them yourself.</span></span>
      </label>
      <button className={btn.primary} onClick={save} disabled={busy}>{busy ? <Spinner /> : <Check size={16} />} Save</button>
    </div>
  )
}

// ------------------------------------------------------------ notifications

export function NotificationsTab() {
  const q = useAsync(() => lifeApi.pushStatus(), [])
  return (
    <div className="max-w-xl">
      <Head title="Notifications" />
      <div className="flex gap-3 rounded-2xl bg-surface-sunken p-4 text-[13.5px]">
        <BellOff size={18} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
        <div>
          <p className="font-medium">{q.loading ? 'Checking…' : q.data?.configured ? 'Push is set up, but reminders aren’t scheduled yet' : 'Reminders aren’t switched on yet'}</p>
          <p className="mt-1 text-ink-muted">
            Bermi doesn’t send push notifications or background reminders today. Anything with a time — tasks, study blocks, prayer or bedtime times you set — shows up inside the app when you open it. We’ve left out notification switches rather than show controls that don’t do anything.
          </p>
          <p className="mt-2 text-ink-muted">When delivery is available, you’ll choose what to hear about and set quiet hours here.</p>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ AI & credits

export function CreditsTab() {
  const q = useAsync(() => lifeApi.credits(), [])
  const c = q.data
  return (
    <div className="max-w-xl">
      <Head title="AI & credits" sub="Credits are a usage allowance for AI features. They are not money and can’t be bought, sent or withdrawn." />
      {q.loading && !c ? <Skeleton className="h-40" /> : q.error && !c ? <ErrorState error={q.error} onRetry={() => q.reload()} compact /> : c && (
        <>
          <div className="flex items-end justify-between border-b border-edge pb-4">
            <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Balance</p><p className="text-[32px] font-semibold tabular-nums leading-none">{c.balance}</p></div>
            <p className="text-right text-[13px] text-ink-muted">{c.plan.label} plan<br />{c.monthlyAllowance} credits topped up each month</p>
          </div>
          <div className="py-4">
            <p className="mb-2 text-[13px] font-medium">What things cost</p>
            <ul className="space-y-1 text-[13.5px]">{Object.entries(c.costs).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k.replace(/_/g, ' ')}</span><span className="tabular-nums text-ink-muted">{v} credit{v === 1 ? '' : 's'}</span></li>)}</ul>
            <p className="mt-2 text-[12px] text-ink-faint">Planning, calendars, budgets, flashcard review and habit tracking never use credits. If an AI request fails, you’re not charged.</p>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">Recent activity</p>
            {c.ledger.length === 0 ? <p className="text-[13px] text-ink-muted">Nothing yet.</p> : (
              <ul className="divide-y divide-edge text-[13px]">{c.ledger.slice(0, 15).map((l) => <li key={l.id} className="flex justify-between gap-3 py-1.5"><span className="capitalize">{l.kind}{l.feature ? ` · ${l.feature.replace(/_/g, ' ')}` : ''}</span><span className="tabular-nums text-ink-muted">{l.amount > 0 ? '+' : ''}{l.amount} · {new Date(l.created_at.replace(' ', 'T') + (l.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></li>)}</ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
