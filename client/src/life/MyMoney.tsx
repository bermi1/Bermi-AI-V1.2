import { useEffect, useState } from 'react'
import { Check, Info, PiggyBank, Plus, Receipt, Scale, Trash2, Wallet, X } from 'lucide-react'
import { lifeApi, todayYmd, type BudgetData, type ExpenseData, type MoneyView, type SavingData, type SavingPlan } from './api'
import { useAct, useDebounced, useToday } from './hooks'
import {
  btn, Donut, EmptyState, ErrorState, field, fmtDateShort, fmtMoney, PageHeader, Ring, Section, Sheet, Skeleton, Spinner, seriesColor, useAsync, Chip,
} from './ui'

const DEFAULT_CATS = ['Food', 'Transport', 'Rent & bills', 'Study', 'Airtime & data', 'Savings', 'Other']

export function MyMoney() {
  const today = useToday()
  const q = useAsync(() => lifeApi.money(today), [today])
  const act = useAct()
  const [setup, setSetup] = useState(false)
  const [expense, setExpense] = useState(false)
  const [saving, setSaving] = useState(false)
  const m = q.data
  const cur = m?.summary.currency ?? 'TZS'
  const fmt = (n: number) => fmtMoney(n, cur)
  const reload = () => q.reload(true)

  return (
    <div>
      <PageHeader title="My Money" subtitle="Plan your month and your savings goals." actions={m?.budget ? <button className={btn.ghost} onClick={() => setSetup(true)}>Edit budget</button> : null} />

      <div className="flex gap-2.5 rounded-2xl bg-surface-sunken p-3.5 text-[13px] text-ink-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <p>
          This is a <strong className="font-semibold text-ink">planning tool</strong>. Bermi doesn’t hold, send or receive money and can’t see your bank or mobile-money balance. Amounts here are what <em>you</em> enter. AI credits are a separate usage allowance — not money.
        </p>
      </div>

      {q.loading && !m ? (
        <div aria-busy="true" className="mt-6 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-48" /></div>
      ) : q.error && !m ? (
        <ErrorState error={q.error} onRetry={() => q.reload()} />
      ) : m && !m.budget ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title="Start with your monthly picture"
          body="Tell Bermi roughly what comes in each month and how you’d like to split it. You can change this any time — it’s only a plan."
          action={<button className={btn.primary} onClick={() => setSetup(true)}>Set up my budget</button>}
        />
      ) : m ? (
        <>
          <Summary m={m} fmt={fmt} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-2">
            <div>
              <Section title="Where it’s planned to go"><Allocation m={m} fmt={fmt} /></Section>
              <Section title="Can I afford it?"><Afford m={m} fmt={fmt} /></Section>
            </div>
            <div>
              <Section title="Upcoming expenses" action={<button className={btn.soft} onClick={() => setExpense(true)}><Plus size={15} /> Add</button>}>
                <Expenses m={m} fmt={fmt} act={act} reload={reload} />
              </Section>
            </div>
          </div>
          <Section title="Savings goals" action={<button className={btn.primary} onClick={() => setSaving(true)}><PiggyBank size={15} /> New goal</button>}>
            <Savings m={m} fmt={fmt} act={act} reload={reload} />
          </Section>
        </>
      ) : null}

      <BudgetSheet open={setup} budget={m?.budget ?? null} onClose={() => setSetup(false)} onSaved={() => { setSetup(false); reload() }} />
      <ExpenseSheet open={expense} cats={m?.summary.categories.map((c) => c.name) ?? []} onClose={() => setExpense(false)} onSaved={() => { setExpense(false); reload() }} />
      <SavingSheet open={saving} currency={cur} onClose={() => setSaving(false)} onSaved={() => { setSaving(false); reload() }} />
    </div>
  )
}

function Summary({ m, fmt }: { m: MoneyView; fmt: (n: number) => string }) {
  const s = m.summary
  const stat = (label: string, value: string, hint?: string) => (
    <div className="py-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[12px] text-ink-muted">{hint}</p>}
    </div>
  )
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-6 border-b border-edge sm:grid-cols-4">
      {stat('Monthly income', fmt(s.income), 'as you entered it')}
      {stat('Planned', fmt(s.budgetedTotal), s.income ? `${Math.round((s.budgetedTotal / s.income) * 100)}% of income` : undefined)}
      {stat('Upcoming this month', fmt(s.upcomingTotal), 'unpaid expenses')}
      {stat('Left to plan', s.availableAfterPlan == null ? '—' : fmt(s.availableAfterPlan), s.availableAfterPlan == null ? 'add your income' : s.availableAfterPlan < 0 ? 'over plan' : 'after upcoming expenses')}
    </div>
  )
}

function Allocation({ m, fmt }: { m: MoneyView; fmt: (n: number) => string }) {
  const cats = m.summary.categories.filter((c) => c.planned > 0)
  if (!cats.length) return <p className="text-[13.5px] text-ink-muted">Add planned amounts to your categories to see how your month splits.</p>
  const max = Math.max(...cats.map((c) => Math.max(c.planned, c.upcoming)), 1)
  return (
    <div className="space-y-5">
      <Donut parts={cats.map((c) => ({ label: c.name, value: c.planned }))} format={fmt} centre={<div><p className="text-[11px] text-ink-muted">Planned</p><p className="text-[14px] font-semibold tabular-nums">{fmt(m.summary.budgetedTotal)}</p></div>} />
      <div>
        <p className="mb-2 text-[12.5px] font-medium text-ink-muted">Upcoming expenses vs plan</p>
        <ul className="space-y-2.5">
          {cats.map((c, i) => (
            <li key={c.id}>
              <div className="flex justify-between text-[12.5px]"><span>{c.name}</span><span className={`tabular-nums ${c.upcoming > c.planned ? 'font-semibold text-primary' : 'text-ink-muted'}`}>{fmt(c.upcoming)} / {fmt(c.planned)}{c.upcoming > c.planned ? ' · over' : ''}</span></div>
              <div role="img" aria-label={`${c.name}: ${fmt(c.upcoming)} upcoming of ${fmt(c.planned)} planned`} className="relative mt-1 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <span className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${(c.planned / max) * 100}%`, background: seriesColor(i) }} />
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.upcoming / max) * 100}%`, background: seriesColor(i) }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Afford({ m, fmt }: { m: MoneyView; fmt: (n: number) => string }) {
  const [what, setWhat] = useState('')
  const [amt, setAmt] = useState('')
  const n = Number(amt)
  const avail = m.summary.availableAfterPlan
  const result = n > 0 && avail != null ? avail - n : null
  return (
    <div>
      <p className="mb-3 text-[13.5px] text-ink-muted">Checks a purchase against what you’ve left to plan this month. Simple arithmetic on your own numbers — not advice.</p>
      <div className="flex gap-2">
        <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What for? (optional)" aria-label="What you want to buy" className={field} maxLength={60} />
        <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" type="number" min={0} placeholder="Amount" aria-label="Amount" className={`${field} max-w-[130px]`} />
      </div>
      {n > 0 && (
        <p role="status" className="mt-3 flex gap-2 text-[14px]">
          <Scale size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          {avail == null ? (
            <span>Add your monthly income first so there’s something to compare against.</span>
          ) : result! >= 0 ? (
            <span>{what ? `“${what}” at ` : ''}<strong>{fmt(n)}</strong> fits in your plan. You’d still have <strong>{fmt(result!)}</strong> left to plan this month.</span>
          ) : (
            <span>{what ? `“${what}” at ` : ''}<strong>{fmt(n)}</strong> is <strong>{fmt(-result!)}</strong> more than you have left to plan this month. Consider waiting, or trimming a category.</span>
          )}
        </p>
      )}
    </div>
  )
}

function Expenses({ m, fmt, act, reload }: { m: MoneyView; fmt: (n: number) => string; act: ReturnType<typeof useAct>; reload: () => void }) {
  if (!m.expenses.length) return <EmptyState icon={<Receipt size={24} />} title="Nothing upcoming" body="Add bills or planned purchases so your plan accounts for them." />
  return (
    <ul className="divide-y divide-edge">
      {m.expenses.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5">
          <button onClick={() => act(async () => { await lifeApi.update<ExpenseData>(e.id, { paid: !e.data.paid }); reload() })} aria-pressed={e.data.paid} aria-label={`${e.data.paid ? 'Mark unpaid' : 'Mark paid'}: ${e.data.title}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${e.data.paid ? 'border-primary bg-primary text-on-primary' : 'border-edge-strong'}`}>
            {e.data.paid && <Check size={15} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[14px] font-medium ${e.data.paid ? 'text-ink-faint line-through' : ''}`}>{e.data.title}</p>
            <p className="text-[12px] text-ink-muted">{fmtDateShort(e.data.date)} · {e.data.category}</p>
          </div>
          <p className="text-[14px] font-semibold tabular-nums">{fmt(e.data.amount)}</p>
          <button className={`${btn.icon} !h-9 !w-9 opacity-60 hover:opacity-100`} aria-label={`Delete ${e.data.title}`} onClick={() => act(async () => { await lifeApi.remove(e.id); reload() }, 'Deleted')}><Trash2 size={15} /></button>
        </li>
      ))}
    </ul>
  )
}

function Savings({ m, fmt, act, reload }: { m: MoneyView; fmt: (n: number) => string; act: ReturnType<typeof useAct>; reload: () => void }) {
  const [contrib, setContrib] = useState<string | null>(null)
  const [amt, setAmt] = useState('')
  const active = m.savings.filter((s) => s.data.status === 'active')
  if (!active.length) return <EmptyState icon={<PiggyBank size={26} />} title="No savings goals yet" body="Try “TZS 40,000 in two weeks”. Bermi works out what that means per week and whether it fits your plan." />
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-10 divide-y divide-edge md:grid-cols-2 md:divide-y-0">
      {active.map((s) => {
        const pct = s.data.targetAmount ? (s.saved / s.data.targetAmount) * 100 : 0
        return (
          <li key={s.id} className="border-b border-edge py-4 md:border-b md:last:border-b-0">
            <div className="flex items-center gap-4">
              <Ring value={pct} size={60} label={`${s.data.title}: ${Math.round(pct)}% of plan set aside`}>{Math.round(pct)}%</Ring>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{s.data.title}</p>
                <p className="text-[13px] tabular-nums text-ink-muted">{fmt(s.saved)} of {fmt(s.data.targetAmount)} planned · by {fmtDateShort(s.data.dueDate)}</p>
              </div>
            </div>
            <p className="mt-2 text-[13px] text-ink-muted">{s.plan.note}</p>
            {s.plan.perWeek != null && s.plan.state === 'active' && <p className="mt-1 text-[13px]">About <strong>{fmt(Math.ceil(s.plan.perWeek))}</strong> a week · <strong>{fmt(Math.ceil(s.plan.perDay ?? 0))}</strong> a day</p>}
            {contrib === s.id ? (
              <form className="mt-3 flex gap-2" onSubmit={(e) => {
                e.preventDefault()
                const n = Number(amt)
                if (!(n > 0)) return
                act(async () => {
                  await lifeApi.update<SavingData>(s.id, { contributions: [...s.data.contributions, { date: todayYmd(), amount: n }].slice(-400), status: s.saved + n >= s.data.targetAmount ? 'done' : 'active' })
                  setContrib(null); setAmt(''); reload()
                }, 'Noted in your plan')
              }}>
                <input autoFocus type="number" min={1} value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Amount set aside" placeholder="Amount you set aside" className={field} />
                <button className={btn.primary} disabled={!(Number(amt) > 0)}>Add</button>
                <button type="button" className={btn.ghost} onClick={() => setContrib(null)} aria-label="Cancel"><X size={16} /></button>
              </form>
            ) : (
              <div className="mt-3 flex gap-2">
                <button className={btn.soft} onClick={() => setContrib(s.id)}>I set some aside</button>
                <button className={btn.ghost} onClick={() => window.confirm(`Stop planning “${s.data.title}”?`) && act(async () => { await lifeApi.update<SavingData>(s.id, { status: 'cancelled' }); reload() })}>Stop</button>
              </div>
            )}
            <p className="mt-2 text-[11.5px] text-ink-faint">“Set aside” is your own note — Bermi doesn’t move money.</p>
          </li>
        )
      })}
    </ul>
  )
}

// ------------------------------------------------------------- sheets

function BudgetSheet({ open, budget, onClose, onSaved }: { open: boolean; budget: BudgetData | null; onClose: () => void; onSaved: () => void }) {
  const act = useAct()
  const [currency, setCurrency] = useState('TZS')
  const [income, setIncome] = useState('')
  const [cats, setCats] = useState<{ id: string; name: string; planned: string }[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setCurrency(budget?.currency ?? 'TZS')
    setIncome(budget ? String(budget.monthlyIncome || '') : '')
    setCats((budget?.categories.length ? budget.categories : DEFAULT_CATS.map((name, i) => ({ id: `c${i}`, name, planned: 0 }))).map((c) => ({ ...c, planned: c.planned ? String(c.planned) : '' })))
  }, [open, budget])
  const planned = cats.reduce((n, c) => n + (Number(c.planned) || 0), 0)
  const inc = Number(income) || 0
  const save = async () => {
    setBusy(true)
    const body = { currency: currency.trim().toUpperCase().slice(0, 3) || 'TZS', monthlyIncome: inc, categories: cats.filter((c) => c.name.trim()).map((c) => ({ id: c.id, name: c.name.trim(), planned: Number(c.planned) || 0 })) }
    const ok = await act(async () => {
      const existing = (await lifeApi.items<BudgetData>('budget'))[0]
      if (existing) await lifeApi.update<BudgetData>(existing.id, body)
      else await lifeApi.create<BudgetData>('budget', body)
      return true
    }, 'Budget saved')
    setBusy(false)
    if (ok) onSaved()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Monthly budget" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-[88px_1fr] gap-3">
          <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="b-cur">Currency</label><input id="b-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className={`${field} uppercase`} /></div>
          <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="b-inc">Monthly income (what you expect)</label><input id="b-inc" type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} className={field} placeholder="e.g. 300000" /></div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Categories & planned amounts</legend>
          <ul className="space-y-2">
            {cats.map((c, i) => (
              <li key={c.id} className="flex gap-2">
                <input value={c.name} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Category ${i + 1} name`} className={field} maxLength={40} />
                <input type="number" min={0} value={c.planned} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, planned: e.target.value } : x)))} aria-label={`${c.name || 'Category'} planned amount`} className={`${field} max-w-[140px]`} placeholder="0" />
                <button type="button" className={btn.icon} aria-label={`Remove ${c.name || 'category'}`} onClick={() => setCats(cats.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
          {cats.length < 24 && <button type="button" className={`${btn.ghost} mt-2`} onClick={() => setCats([...cats, { id: `c${Date.now().toString(36)}`, name: '', planned: '' }])}><Plus size={15} /> Add category</button>}
        </fieldset>
        <p className="text-[13px] text-ink-muted" aria-live="polite">Planned {fmtMoney(planned, currency || 'TZS')}{inc > 0 ? ` of ${fmtMoney(inc, currency || 'TZS')} (${planned > inc ? 'over by ' + fmtMoney(planned - inc, currency || 'TZS') : fmtMoney(inc - planned, currency || 'TZS') + ' unplanned'})` : ''}</p>
        <button className={`${btn.primary} w-full`} onClick={save} disabled={busy}>{busy ? <Spinner /> : <Check size={16} />} Save budget</button>
      </div>
    </Sheet>
  )
}

function ExpenseSheet({ open, cats, onClose, onSaved }: { open: boolean; cats: string[]; onClose: () => void; onSaved: () => void }) {
  const act = useAct()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayYmd())
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setTitle(''); setAmount(''); setDate(todayYmd()); setCategory(cats[0] ?? 'Other') } }, [open, cats])
  return (
    <Sheet open={open} onClose={onClose} title="Add an expense">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const ok = await act(async () => { await lifeApi.create<ExpenseData>('expense', { title: title.trim(), amount: Number(amount), category, date, paid: false }); return true }, 'Added')
        setBusy(false)
        if (ok) onSaved()
      }}>
        <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="e-t">What is it?</label><input id="e-t" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={field} maxLength={200} placeholder="Internet bundle" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="e-a">Amount</label><input id="e-a" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={field} /></div>
          <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="e-d">Due</label><input id="e-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
        </div>
        <fieldset><legend className="mb-1.5 text-[13px] font-medium">Category</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">{(cats.length ? cats : ['Other']).map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}</div>
        </fieldset>
        <button className={`${btn.primary} w-full`} disabled={!title.trim() || !(Number(amount) > 0) || busy}>{busy ? <Spinner /> : <Check size={16} />} Add expense</button>
      </form>
    </Sheet>
  )
}

function SavingSheet({ open, currency, onClose, onSaved }: { open: boolean; currency: string; onClose: () => void; onSaved: () => void }) {
  const act = useAct()
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [due, setDue] = useState('')
  const [plan, setPlan] = useState<SavingPlan | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setTitle(''); setTarget(''); setDue(''); setPlan(null) } }, [open])
  const t = useDebounced(Number(target) || 0)
  const d = useDebounced(due)
  // Live feasibility check — deterministic server arithmetic, free of charge.
  useEffect(() => {
    if (!open || !(t > 0) || !d) { setPlan(null); return }
    let live = true
    lifeApi.checkSaving({ target: t, due: d, today: todayYmd() }).then((p) => live && setPlan(p)).catch(() => live && setPlan(null))
    return () => { live = false }
  }, [open, t, d])
  return (
    <Sheet open={open} onClose={onClose} title="New savings goal">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const ok = await act(async () => { await lifeApi.create<SavingData>('saving', { title: title.trim(), targetAmount: Number(target), currency, dueDate: due, contributions: [], status: 'active' }); return true }, 'Goal added')
        setBusy(false)
        if (ok) onSaved()
      }}>
        <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="s-t">What are you saving for?</label><input id="s-t" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={field} maxLength={160} placeholder="New phone case" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="s-a">Target ({currency})</label><input id="s-a" type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} className={field} /></div>
          <div><label className="mb-1.5 block text-[13px] font-medium" htmlFor="s-d">By</label><input id="s-d" type="date" min={todayYmd()} value={due} onChange={(e) => setDue(e.target.value)} className={field} /></div>
        </div>
        {plan && (
          <p role="status" className="rounded-xl bg-primary-soft p-3 text-[13.5px]">
            {plan.perWeek != null && plan.state === 'active' && <span className="block font-semibold text-primary">About {fmtMoney(Math.ceil(plan.perWeek), currency)} a week · {fmtMoney(Math.ceil(plan.perDay ?? 0), currency)} a day</span>}
            <span className="text-ink-muted">{plan.note}</span>
          </p>
        )}
        <button className={`${btn.primary} w-full`} disabled={!title.trim() || !(Number(target) > 0) || !due || busy}>{busy ? <Spinner /> : <Check size={16} />} Start planning</button>
      </form>
    </Sheet>
  )
}
