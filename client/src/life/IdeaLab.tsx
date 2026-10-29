import { useEffect, useRef, useState } from 'react'
import { BookMarked, Check, ChevronRight, FlaskConical, Lightbulb, Plus, Sparkles, Trash2 } from 'lucide-react'
import { lifeApi, LifeError, todayYmd, type IdeaCategory, type IdeaData, type Item } from './api'
import { newIdemKey, useAct, useItems } from './hooks'
import { btn, Chip, EmptyState, ErrorState, field, fmtDateShort, Section, Sheet, Skeleton, Spinner, useAsync } from './ui'

// A private diary for raw thoughts — businesses, investing, stocks, savings.
// Nothing is judged or promised: Bermi helps turn the thought into questions,
// assumptions and small experiments the person can run, and tracks what they find.

const CATS: { id: IdeaCategory; label: string }[] = [
  { id: 'business', label: 'Business' }, { id: 'invest', label: 'Investing' }, { id: 'stock', label: 'Stocks' }, { id: 'savings', label: 'Saving' }, { id: 'other', label: 'Other' },
]
const STATUS = [['seed', 'Raw thought'], ['testing', 'Testing it'], ['validated', 'Worked'], ['parked', 'Parked']] as const
const money = (c: IdeaCategory) => c === 'invest' || c === 'stock' || c === 'savings'
const NOTE = 'Educational structure only — not financial advice. Investments can lose money, and nothing here predicts prices or returns. Check anything important with a licensed adviser before committing real money.'

export function IdeaLab() {
  const { items, loading, error, reload } = useItems<IdeaData>('idea')
  const act = useAct()
  const [cat, setCat] = useState<IdeaCategory>('business')
  const [title, setTitle] = useState('')
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const sel = items.find((i) => i.id === open) ?? null

  const save = async () => {
    setBusy(true)
    const it = await act(() => lifeApi.create<IdeaData>('idea', { title: title.trim() || raw.trim().slice(0, 60), raw: raw.trim(), category: cat, status: 'seed', date: todayYmd() }), 'Saved to your diary')
    setBusy(false)
    if (it) { setTitle(''); setRaw(''); reload(true); setOpen(it.id) }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Section title="Brainstorm">
        <p className="mb-3 text-[13.5px] text-ink-muted">Got a rough thought about a business, an investment, a stock or saving? Drop it here exactly as it is. Messy is fine — it’s saved privately in your diary, then you can shape it into something you can test.</p>
        <div role="radiogroup" aria-label="What kind of idea" className="mb-3 flex flex-wrap gap-2">{CATS.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}</div>
        <label htmlFor="idea-title" className="sr-only">Short title</label>
        <input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Short title (optional)" className={`${field} mb-2`} />
        <label htmlFor="idea-raw" className="sr-only">Your raw thought</label>
        <textarea id="idea-raw" value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} maxLength={6000} placeholder="What’s on your mind? e.g. “I keep seeing students struggle to find affordable printing near campus…”" className={`${field} resize-y`} />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[12px] text-ink-faint">{raw.length.toLocaleString()} / 6,000</span>
          <button className={btn.primary} disabled={raw.trim().length < 5 || busy} onClick={save}>{busy ? <Spinner /> : <BookMarked size={15} />} Save to diary</button>
        </div>
        {money(cat) && <p className="mt-3 rounded-xl bg-surface-sunken p-3 text-[12px] leading-relaxed text-ink-muted">{NOTE}</p>}
      </Section>

      <Section title={`Your diary${sorted.length ? ` · ${sorted.length}` : ''}`}>
        {error && !items.length ? <ErrorState error={error} onRetry={() => reload()} compact /> : loading && !items.length ? <Skeleton className="h-24" /> : sorted.length === 0 ? (
          <EmptyState icon={<Lightbulb size={26} />} title="Nothing here yet" body="Your saved thoughts appear here, with what you’ve tested and what you learned." />
        ) : (
          <ul className="divide-y divide-edge">
            {sorted.map((i) => (
              <li key={i.id}>
                <button onClick={() => setOpen(i.id)} className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{i.data.shaped ? <FlaskConical size={18} /> : <Lightbulb size={18} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{i.data.title}</span>
                    <span className="block truncate text-[12.5px] text-ink-muted">{CATS.find((c) => c.id === i.data.category)?.label} · {STATUS.find((s) => s[0] === i.data.status)?.[1]}{i.data.experiments.length ? ` · ${i.data.experiments.filter((e) => e.done).length}/${i.data.experiments.length} tests` : ''}{i.data.date ? ` · ${fmtDateShort(i.data.date)}` : ''}</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-faint" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <IdeaSheet idea={sel} onClose={() => setOpen(null)} onChanged={() => reload(true)} />
    </div>
  )
}

function IdeaSheet({ idea, onClose, onChanged }: { idea: Item<IdeaData> | null; onClose: () => void; onChanged: () => void }) {
  const act = useAct()
  const [title, setTitle] = useState('')
  const [raw, setRaw] = useState('')
  const [value, setValue] = useState('')
  const [newExp, setNewExp] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ message: string; refunded?: boolean } | null>(null)
  const idem = useRef(newIdemKey())
  const credits = useAsync(() => (idea ? lifeApi.credits().catch(() => null) : Promise.resolve(null)), [idea?.id])
  useEffect(() => { setTitle(idea?.data.title ?? ''); setRaw(idea?.data.raw ?? ''); setValue(idea?.data.value ?? ''); setNewExp(''); setErr(null); idem.current = newIdemKey() }, [idea?.id])
  if (!idea) return <Sheet open={false} onClose={onClose} title="" children={null} />
  const d = idea.data
  const patch = (p: Partial<IdeaData>, ok?: string) => act(async () => { await lifeApi.update<IdeaData>(idea.id, p); onChanged() }, ok)
  const dirty = title !== d.title || raw !== d.raw
  const cost = credits.data?.costs.idea_shape
  const shape = async () => {
    setBusy(true); setErr(null)
    try {
      if (dirty) await lifeApi.update<IdeaData>(idea.id, { title, raw })
      await lifeApi.shapeIdea(idea.id, idem.current)
      onChanged(); credits.reload(true)
    } catch (e) {
      const le = e as LifeError
      setErr({ message: le.message, refunded: le.refunded }); idem.current = newIdemKey()
    } finally { setBusy(false) }
  }
  const addExp = (text: string) => text.trim() && d.experiments.length < 20 && patch({ experiments: [...d.experiments, { text: text.trim(), done: false, result: '' }], status: d.status === 'seed' ? 'testing' : d.status })
  const setExp = (i: number, p: Partial<IdeaData['experiments'][number]>) => patch({ experiments: d.experiments.map((e, k) => (k === i ? { ...e, ...p } : e)) })
  const sh = d.shaped

  return (
    <Sheet open onClose={onClose} title={d.title} wide>
      <div className="space-y-6">
        <div>
          <label htmlFor="is-t" className="mb-1.5 block text-[13px] font-medium">Title</label>
          <input id="is-t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={field} />
          <label htmlFor="is-r" className="mb-1.5 mt-3 block text-[13px] font-medium">Your thought</label>
          <textarea id="is-r" value={raw} onChange={(e) => setRaw(e.target.value)} rows={5} maxLength={6000} className={`${field} resize-y`} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btn.ghost} disabled={!dirty || !title.trim()} onClick={() => patch({ title, raw }, 'Saved')}>Save changes</button>
            <button className={btn.primary} disabled={busy || raw.trim().length < 30} onClick={shape}>{busy ? <Spinner /> : <Sparkles size={15} />} {sh ? 'Reshape' : 'Turn it into something useful'}</button>
            <button className={`${btn.icon} ml-auto`} aria-label="Delete idea" onClick={() => window.confirm('Delete this idea from your diary?') && act(async () => { await lifeApi.remove(idea.id); onChanged(); onClose() }, 'Deleted')}><Trash2 size={16} /></button>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-faint">{raw.trim().length < 30 ? 'Write a couple of sentences first.' : `Uses ${cost ?? 'a few'} AI credit${cost === 1 ? '' : 's'} (not money). If the AI fails you aren’t charged. Only this idea’s text is sent.`}</p>
          {err && <p role="alert" className="mt-2 rounded-xl bg-surface-sunken p-3 text-[13px]">{err.message}{err.refunded ? ' You weren’t charged.' : ''}</p>}
        </div>

        <fieldset><legend className="mb-1.5 text-[13px] font-medium">Where is it?</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">{STATUS.map(([v, l]) => <Chip key={v} active={d.status === v} onClick={() => patch({ status: v })}>{l}</Chip>)}</div></fieldset>

        {sh && (
          <div className="space-y-4 rounded-2xl bg-surface-sunken p-4 text-[14px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Shaped by Bermi</p>
            <p className="leading-relaxed">{sh.summary}</p>
            {sh.valueProposition && <div><p className="text-[13px] font-semibold">The value</p><p className="text-ink-muted">{sh.valueProposition}</p></div>}
            <Bullets title="Assumptions to check" items={sh.assumptions} />
            <div>
              <p className="mb-1 text-[13px] font-semibold">Small experiments to try</p>
              <ul className="space-y-1.5">{sh.experiments.map((e, i) => (
                <li key={i} className="flex items-start gap-2"><span className="flex-1">{e}</span>
                  <button className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold text-primary disabled:opacity-40" disabled={d.experiments.some((x) => x.text === e)} onClick={() => addExp(e)}>{d.experiments.some((x) => x.text === e) ? 'Added' : 'Try this'}</button></li>))}</ul>
            </div>
            <Bullets title="Risks to think about" items={sh.risks} />
            <Bullets title="First steps" items={sh.firstSteps} />
            <Bullets title="Questions to research" items={sh.questions} />
            <p className="text-[11.5px] text-ink-faint">AI-generated from your text. It can be wrong or miss things — treat it as a thinking aid and verify before acting.</p>
          </div>
        )}
        {money(d.category) && <p className="rounded-xl bg-surface-sunken p-3 text-[12px] leading-relaxed text-ink-muted">{NOTE}</p>}

        <div>
          <p className="mb-1.5 text-[13px] font-medium">My experiments</p>
          {d.experiments.length === 0 && <p className="mb-2 text-[13px] text-ink-muted">Add a small test you can run this week — it should cost little and tell you something.</p>}
          <ul className="space-y-2">{d.experiments.map((e, i) => (
            <li key={i} className="rounded-xl border border-edge p-3">
              <div className="flex items-start gap-2.5">
                <button onClick={() => setExp(i, { done: !e.done })} aria-pressed={e.done} aria-label={`${e.done ? 'Mark not done' : 'Mark done'}: ${e.text}`} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${e.done ? 'border-primary bg-primary text-on-primary' : 'border-edge-strong'}`}>{e.done && <Check size={14} />}</button>
                <p className={`min-w-0 flex-1 text-[14px] ${e.done ? 'text-ink-muted line-through' : ''}`}>{e.text}</p>
                <button className="text-[12px] text-ink-faint hover:text-ink" onClick={() => patch({ experiments: d.experiments.filter((_, k) => k !== i) })} aria-label={`Remove: ${e.text}`}>Remove</button>
              </div>
              {(e.done || e.result) && <ResultField value={e.result} onSave={(r) => setExp(i, { result: r })} />}
            </li>))}</ul>
          {d.experiments.length < 20 && (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addExp(newExp); setNewExp('') }}>
              <input value={newExp} onChange={(e) => setNewExp(e.target.value)} maxLength={300} aria-label="New experiment" placeholder="e.g. Ask 5 classmates if they’d pay for this" className={field} />
              <button className={btn.soft} disabled={!newExp.trim()}><Plus size={15} /> Add</button>
            </form>
          )}
        </div>

        <div>
          <label htmlFor="is-v" className="mb-1.5 block text-[13px] font-medium">What have you learned — and what is it worth?</label>
          <textarea id="is-v" value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={1000} className={`${field} resize-y`} placeholder="Who would value this, and how do you know?" />
          <button className={`${btn.soft} mt-2`} disabled={value === d.value} onClick={() => patch({ value }, 'Saved')}>Save notes</button>
        </div>
      </div>
    </Sheet>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return <div><p className="mb-1 text-[13px] font-semibold">{title}</p><ul className="list-disc space-y-1 pl-5 text-ink-muted">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
}

function ResultField({ value, onSave }: { value: string; onSave: (r: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="mt-2 flex gap-2 pl-8">
      <input value={v} onChange={(e) => setV(e.target.value)} maxLength={600} aria-label="What happened?" placeholder="What happened?" className={`${field} !py-2`} />
      <button className={btn.ghost} disabled={v === value} onClick={() => onSave(v)}>Save</button>
    </div>
  )
}
