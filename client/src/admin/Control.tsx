import { useEffect, useMemo, useState } from 'react'
import { apiFetch, json } from '../lib/api'
import { btn, Chip, EmptyState, ErrorState, field, Sheet, Skeleton, Spinner, ToastProvider, useAsync, useToast } from '../life/ui'

// "Bermi Control" screens. Every action here is re-checked on the server by
// role; this UI only hides what a role can't do. Nothing on these screens
// reads a user's private journals, money plans, health, faith or documents.

export interface CtlMe { role: string | null; perms: string[] }

export const ctlMe = () => apiFetch('/api/admin/ctl/me').then((r) => json<CtlMe>(r)).catch(() => ({ role: null, perms: [] }) as CtlMe)

async function ctl<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/api/admin/ctl${path}`, init)
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).error || msg } catch { /* not json */ }
    throw new Error(msg)
  }
  return json<T>(res)
}
const send = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const can = (me: CtlMe, perm: string) => me.perms.includes('*') || me.perms.includes(perm)

export type ControlTab = 'metrics' | 'ai' | 'accounts' | 'content' | 'audit' | 'roles'
export const CONTROL_TABS: { id: ControlTab; label: string; perm: string }[] = [
  { id: 'metrics', label: 'Metrics', perm: 'metrics.read' },
  { id: 'ai', label: 'AI operations', perm: 'ai.read' },
  { id: 'accounts', label: 'Accounts & credits', perm: 'users.read' },
  { id: 'content', label: 'Content', perm: 'content.read' },
  { id: 'audit', label: 'Audit log', perm: 'audit.read' },
  { id: 'roles', label: 'Roles', perm: '*' },
]

export function ControlPanel({ tab, me }: { tab: ControlTab; me: CtlMe }) {
  return (
    <ToastProvider>
      {tab === 'metrics' && <Metrics />}
      {tab === 'ai' && <AIOps me={me} />}
      {tab === 'accounts' && <Accounts me={me} />}
      {tab === 'content' && <Content me={me} />}
      {tab === 'audit' && <Audit />}
      {tab === 'roles' && <Roles />}
    </ToastProvider>
  )
}

const H = ({ children, sub }: { children: string; sub?: string }) => (
  <header className="mb-5"><h2 className="text-[20px] font-bold text-ink">{children}</h2>{sub && <p className="mt-1 text-[13px] text-ink-muted">{sub}</p>}</header>
)
const Unavailable = ({ label, reason }: { label: string; reason: string }) => (
  <div className="rounded-xl border border-dashed border-edge p-4"><p className="text-[13px] font-semibold">{label}</p><p className="mt-1 text-[12.5px] text-ink-muted">Unavailable — {reason}</p></div>
)
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-5 rounded-2xl border border-edge bg-surface-raised p-5"><h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-muted">{title}</h3>{children}</section>
)

// ------------------------------------------------------------ metrics

interface Metrics {
  days: number
  platform: Record<string, number>
  adoption: { kind: string; users: number; items: number }[] | { available: false; reason: string }
  ai: { available: true; byFeature: { feature: string; n: number; spent: number }[]; creditsSpent: number; outcomes: { feature: string; requests: number; refunded: number }[] | null } | { available: false; reason: string }
  revenue: { reason: string }; conversion: { reason: string }; churn: { reason: string }; support: { reason: string }
}

function Metrics() {
  const [days, setDays] = useState(7)
  const q = useAsync(() => ctl<Metrics>(`/metrics?days=${days}`), [days])
  const m = q.data
  return (
    <div>
      <H sub="Real numbers only. Anything we can't measure yet says so.">Metrics</H>
      <div role="radiogroup" aria-label="Period" className="mb-5 flex gap-2">{[7, 30, 90].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>Last {d} days</Chip>)}</div>
      {q.loading && !m ? <Skeleton className="h-40" /> : q.error && !m ? <ErrorState error={q.error} onRetry={() => q.reload()} /> : m && (
        <>
          <Card title="Platform (all time)">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Object.entries(m.platform).map(([k, v]) => <div key={k}><dt className="text-[12px] capitalize text-ink-muted">{k.replace(/_/g, ' ')}</dt><dd className="text-[22px] font-semibold tabular-nums">{v.toLocaleString()}</dd></div>)}</dl>
          </Card>
          <Card title={`AI usage · last ${m.days} days`}>
            {'available' in m.ai && m.ai.available ? (
              m.ai.byFeature.length === 0 ? <p className="text-[13px] text-ink-muted">No AI requests in this period.</p> : (
                <>
                  <p className="mb-3 text-[13px]">Credits spent: <strong className="tabular-nums">{m.ai.creditsSpent.toLocaleString()}</strong></p>
                  <table className="w-full text-left text-[13px]"><thead className="text-ink-muted"><tr><th className="pb-2 font-medium">Feature</th><th className="pb-2 font-medium">Requests</th><th className="pb-2 font-medium">Credits</th><th className="pb-2 font-medium">Provider failures</th></tr></thead>
                    <tbody>{m.ai.byFeature.map((f) => { const o = m.ai.available ? m.ai.outcomes?.find((x) => x.feature === f.feature) : undefined; return (
                      <tr key={f.feature} className="border-t border-edge"><td className="py-2">{f.feature}</td><td className="tabular-nums">{o?.requests ?? f.n}</td><td className="tabular-nums">{f.spent}</td><td className="tabular-nums">{o ? `${o.refunded}${o.requests ? ` (${Math.round((o.refunded / o.requests) * 100)}%)` : ''}` : '—'}</td></tr>) })}</tbody></table>
                </>
              )
            ) : <Unavailable label="AI usage" reason={(m.ai as { reason: string }).reason} />}
          </Card>
          <Card title="Feature adoption">
            {Array.isArray(m.adoption) ? (m.adoption.length === 0 ? <p className="text-[13px] text-ink-muted">No Life OS activity yet.</p> : (
              <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">{[...m.adoption].sort((a, b) => b.users - a.users).map((a) => <li key={a.kind} className="flex justify-between border-b border-edge py-1.5 text-[13px]"><span className="capitalize">{a.kind.replace(/_/g, ' ')}</span><span className="tabular-nums text-ink-muted">{a.users} user{a.users === 1 ? '' : 's'} · {a.items} item{a.items === 1 ? '' : 's'}</span></li>)}</ul>
            )) : <Unavailable label="Adoption" reason={m.adoption.reason} />}
            <p className="mt-3 text-[11.5px] text-ink-faint">Counts of distinct users per feature. Health, faith, money and journal features are deliberately not broken out.</p>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Unavailable label="Revenue" reason={m.revenue.reason} /><Unavailable label="Conversion" reason={m.conversion.reason} />
            <Unavailable label="Churn" reason={m.churn.reason} /><Unavailable label="Support volume" reason={m.support.reason} />
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------ AI operations

interface AIState { disabled: boolean; dailyCap: number | null; providers: { id: string; totalKeys: number; coolingKeys: number; nextRetryInSeconds: number | null }[] | null; entitlements: { plans: Record<string, { label: string; monthlyCredits: number }>; costs: Record<string, number> } }

function AIOps({ me }: { me: CtlMe }) {
  const q = useAsync(() => ctl<AIState>('/ai'), [])
  const toast = useToast()
  const [cap, setCap] = useState('')
  const [costs, setCosts] = useState<Record<string, string>>({})
  const [plans, setPlans] = useState<Record<string, string>>({})
  const s = q.data
  useEffect(() => {
    if (!s) return
    setCap(s.dailyCap ? String(s.dailyCap) : '')
    setCosts(Object.fromEntries(Object.entries(s.entitlements.costs).map(([k, v]) => [k, String(v)])))
    setPlans(Object.fromEntries(Object.entries(s.entitlements.plans).map(([k, v]) => [k, String(v.monthlyCredits)])))
  }, [s])
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); q.reload(true) } catch (e) { toast((e as Error).message, 'error') } }
  if (q.loading && !s) return <Skeleton className="h-40" />
  if (q.error && !s) return <ErrorState error={q.error} onRetry={() => q.reload()} />
  if (!s) return null
  const w = can(me, 'ai.write')
  return (
    <div>
      <H sub="Emergency controls and cost settings for all AI features. Deterministic features (scheduling, budgets, flashcard review) never use credits.">AI operations</H>
      <Card title="Kill switch">
        <p className={`mb-3 text-[14px] font-medium ${s.disabled ? 'text-red-600' : ''}`}>{s.disabled ? 'AI features are OFF for everyone.' : 'AI features are on.'}</p>
        {w ? <button className={s.disabled ? btn.primary : btn.ghost} onClick={() => { if (!s.disabled && !window.confirm('Turn off all AI features for every user?')) return; act(() => ctl('/ai/kill', send('POST', { disabled: !s.disabled })), s.disabled ? 'AI turned on' : 'AI turned off') }}>{s.disabled ? 'Turn AI back on' : 'Turn AI off'}</button> : <p className="text-[12.5px] text-ink-muted">Your role can’t change this.</p>}
      </Card>
      <Card title="Global daily credit cap">
        <p className="mb-2 text-[13px] text-ink-muted">Stops AI spending across all users once this many credits are used in a day. Leave empty for no cap.</p>
        <div className="flex gap-2"><input value={cap} onChange={(e) => setCap(e.target.value)} type="number" min={0} disabled={!w} aria-label="Daily credit cap" className={`${field} max-w-[200px]`} placeholder="No cap" />{w && <button className={btn.primary} onClick={() => act(() => ctl('/ai/cap', send('POST', { dailyCap: cap === '' ? null : Number(cap) })), 'Cap saved')}>Save</button>}</div>
      </Card>
      {w && <ProviderTest />}
      <Card title="Providers">
        {!s.providers || s.providers.length === 0 ? <p className="text-[13px] text-ink-muted">No AI provider keys are configured on this server.</p> : (
          <ul className="space-y-1.5 text-[13px]">{s.providers.map((p) => <li key={p.id} className="flex justify-between"><span>{p.id}</span><span className="text-ink-muted">{p.totalKeys} key{p.totalKeys === 1 ? '' : 's'} · {p.coolingKeys ? `${p.coolingKeys} cooling${p.nextRetryInSeconds ? `, retry in ${p.nextRetryInSeconds}s` : ''}` : 'healthy'}</span></li>)}</ul>
        )}
      </Card>
      {can(me, 'entitlements.write') && (
        <Card title="Plans & credit costs">
          <div className="grid gap-6 sm:grid-cols-2">
            <div><p className="mb-2 text-[12.5px] font-medium text-ink-muted">Monthly credits per plan</p>{Object.entries(s.entitlements.plans).map(([id, p]) => <div key={id} className="mb-2 flex items-center gap-2"><label className="w-28 text-[13px]" htmlFor={`pl-${id}`}>{p.label}</label><input id={`pl-${id}`} type="number" min={0} value={plans[id] ?? ''} onChange={(e) => setPlans({ ...plans, [id]: e.target.value })} className={field} /></div>)}</div>
            <div><p className="mb-2 text-[12.5px] font-medium text-ink-muted">Credits per operation</p>{Object.keys(s.entitlements.costs).map((f) => <div key={f} className="mb-2 flex items-center gap-2"><label className="w-36 text-[13px]" htmlFor={`co-${f}`}>{f.replace(/_/g, ' ')}</label><input id={`co-${f}`} type="number" min={1} value={costs[f] ?? ''} onChange={(e) => setCosts({ ...costs, [f]: e.target.value })} className={field} /></div>)}</div>
          </div>
          <button className={`${btn.primary} mt-2`} onClick={() => act(() => ctl('/entitlements', send('PUT', { plans: Object.fromEntries(Object.entries(s.entitlements.plans).map(([id, p]) => [id, { label: p.label, monthlyCredits: Number(plans[id]) }])), costs: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, Number(v)])) })), 'Saved')}>Save changes</button>
          <p className="mt-2 text-[11.5px] text-ink-faint">Changes apply to future requests; existing balances are not rewritten. Recorded in the audit log.</p>
        </Card>
      )}
    </div>
  )
}

function ProviderTest() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ provider: string; workingKeys: number; keys: { key: number; ok: boolean; tried: { model: string; status: number; message: string }[] }[] }[] | null>(null)
  const run = async () => {
    setBusy(true)
    try { setRes((await ctl<{ results: NonNullable<typeof res> }>('/ai/test', send('POST', {}))).results) } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <Card title="Test the AI providers">
      <p className="mb-3 text-[13px] text-ink-muted">Sends one tiny request through every key to show what works right now. Uses a few tokens; never shows the keys.</p>
      <button className={btn.primary} onClick={run} disabled={busy}>{busy ? <Spinner /> : null} Run test</button>
      {res && (
        res.length === 0 ? <p className="mt-3 text-[13px]">No provider keys are configured.</p> : (
          <ul className="mt-4 space-y-3">
            {res.map((p) => (
              <li key={p.provider} className="rounded-xl border border-edge p-3 text-[13px]">
                <p className="font-semibold capitalize">{p.provider} — {p.workingKeys} of {p.keys.length} key{p.keys.length === 1 ? '' : 's'} working</p>
                <ul className="mt-1.5 space-y-1 text-ink-muted">
                  {p.keys.map((k) => (
                    <li key={k.key}>Key {k.key}: {k.ok ? '✅ works' : '❌ failed'} — {k.tried.map((t) => `${t.model} → ${t.status || 'no answer'}${t.status && t.status < 300 ? '' : ` (${t.message || 'error'})`}`).join('; ')}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      )}
    </Card>
  )
}

// ------------------------------------------------------------ accounts

interface UserRow { id: string; name: string; email: string; created_at: string; plan: string; balance: number | null }
interface Ledger { balance: number; ledger: { id: number; kind: string; amount: number; feature: string | null; created_at: string }[] }

function Accounts({ me }: { me: CtlMe }) {
  const [term, setTerm] = useState('')
  const [q, setQ] = useState('')
  const list = useAsync(() => ctl<{ users: UserRow[]; plans: { id: string; label: string }[] }>(`/users?q=${encodeURIComponent(q)}`), [q])
  const [sel, setSel] = useState<UserRow | null>(null)
  return (
    <div>
      <H sub="Look up an account to see its plan and credit history. You can’t see anyone’s personal content here.">Accounts & credits</H>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(term.trim()) }}><input value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search by name or email" placeholder="Search name or email" className={field} /><button className={btn.primary}>Search</button></form>
      {list.loading && !list.data ? <Skeleton className="h-32" /> : list.error ? <ErrorState error={list.error} onRetry={() => list.reload()} /> : list.data!.users.length === 0 ? <EmptyState title="No matching accounts" /> : (
        <ul className="divide-y divide-edge rounded-2xl border border-edge bg-surface-raised">
          {list.data!.users.map((u) => <li key={u.id}><button onClick={() => setSel(u)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-sunken"><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{u.name || u.email}</span><span className="block truncate text-[12.5px] text-ink-muted">{u.email}</span></span><span className="text-[12.5px] text-ink-muted">{u.plan} · {u.balance ?? '—'} credits</span></button></li>)}
        </ul>
      )}
      <AccountSheet user={sel} plans={list.data?.plans ?? []} me={me} onClose={() => setSel(null)} onChanged={() => list.reload(true)} />
    </div>
  )
}

function AccountSheet({ user, plans, me, onClose, onChanged }: { user: UserRow | null; plans: { id: string; label: string }[]; me: CtlMe; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [plan, setPlan] = useState('')
  const led = useAsync(() => (user && can(me, 'credits.read') ? ctl<Ledger>(`/users/${user.id}/credits`) : Promise.resolve(null)), [user?.id])
  useEffect(() => { setAmount(''); setReason(''); setPlan(user?.plan ?? '') }, [user?.id, user?.plan])
  if (!user) return <Sheet open={false} onClose={onClose} title="" children={null} />
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); led.reload(true); onChanged() } catch (e) { toast((e as Error).message, 'error') } }
  return (
    <Sheet open onClose={onClose} title={user.name || user.email} wide>
      <div className="space-y-5">
        <p className="text-[13px] text-ink-muted">{user.email} · joined {user.created_at?.slice(0, 10)}</p>
        {can(me, 'plans.write') && (
          <div><p className="mb-1.5 text-[13px] font-medium">Plan</p><div className="flex gap-2"><select value={plan} onChange={(e) => setPlan(e.target.value)} className={field} aria-label="Plan">{plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select><button className={btn.primary} disabled={plan === user.plan} onClick={() => act(() => ctl('/plan', send('POST', { userId: user.id, plan })), 'Plan updated')}>Set plan</button></div></div>
        )}
        {can(me, 'credits.read') && (
          <div><p className="mb-1.5 text-[13px] font-medium">Credits · balance {led.data?.balance ?? '…'}</p>
            {led.loading && !led.data ? <Spinner /> : led.data && (
              <ul className="max-h-56 divide-y divide-edge overflow-y-auto rounded-xl border border-edge text-[12.5px]">{led.data.ledger.length === 0 ? <li className="p-3 text-ink-muted">No entries yet.</li> : led.data.ledger.map((l) => <li key={l.id} className="flex justify-between gap-3 px-3 py-1.5"><span>{l.kind}{l.feature ? ` · ${l.feature}` : ''}</span><span className="tabular-nums text-ink-muted">{l.amount > 0 ? '+' : ''}{l.amount} · {l.created_at.slice(0, 16).replace('T', ' ')}</span></li>)}</ul>
            )}
          </div>
        )}
        {can(me, 'credits.adjust_small') && (
          <form onSubmit={(e) => { e.preventDefault(); act(() => ctl('/credits/adjust', send('POST', { userId: user.id, amount: Number(amount), reason })), 'Credits adjusted'); setAmount(''); setReason('') }}>
            <p className="mb-1.5 text-[13px] font-medium">Adjust credits {me.role === 'support' ? '(up to ±50)' : ''}</p>
            <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount (negative to remove)" placeholder="+25" className={field} /><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" placeholder="Reason (goes in the audit log)" className={field} /><button className={btn.primary} disabled={!Number(amount) || !reason.trim()}>Apply</button></div>
          </form>
        )}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------ content

type Col = 'books' | 'concepts' | 'verses' | 'sessions' | 'audio'
interface CItem { id: string; status: 'draft' | 'review' | 'published'; updatedBy?: string; [k: string]: unknown }
const FIELDS: Record<Col, { key: string; label: string; area?: boolean; num?: boolean; list?: boolean; req?: boolean }[]> = {
  books: [{ key: 'title', label: 'Title', req: true }, { key: 'author', label: 'Author', req: true }, { key: 'year', label: 'Year', num: true }, { key: 'publisher', label: 'Publisher' }, { key: 'blurb', label: 'Description', area: true }, { key: 'license', label: 'Licence / permission' }, { key: 'sourceUrl', label: 'Where to find the book' }],
  concepts: [{ key: 'bookId', label: 'Book id', req: true }, { key: 'concept', label: 'Idea title', req: true }, { key: 'explanation', label: 'Explanation (your own words)', area: true, req: true }, { key: 'example', label: 'Example', area: true }, { key: 'takeaways', label: 'Takeaways (one per line)', area: true, list: true }, { key: 'action', label: 'Try today' }, { key: 'reflection', label: 'Reflection question' }, { key: 'source', label: 'Source note' }, { key: 'scheduledFor', label: 'Show on date (YYYY-MM-DD, optional)' }],
  verses: [{ key: 'tradition', label: 'Tradition (christian / muslim / other)', req: true }, { key: 'reference', label: 'Reference', req: true }, { key: 'text', label: 'Text (licensed source only)', area: true, req: true }, { key: 'translation', label: 'Translation', req: true }, { key: 'license', label: 'Licence & attribution', area: true, req: true }, { key: 'prompt', label: 'Reflection prompt' }],
  sessions: [{ key: 'title', label: 'Title', req: true }, { key: 'type', label: 'Type (breathing / meditation / reflection / sleep)', req: true }, { key: 'minutes', label: 'Minutes', num: true, req: true }, { key: 'blurb', label: 'Description' }, { key: 'steps', label: 'Steps (one per line)', area: true, list: true }, { key: 'source', label: 'Source note' }],
  audio: [{ key: 'title', label: 'Title', req: true }, { key: 'author', label: 'Author / speaker' }, { key: 'url', label: 'Audio file URL (https)', req: true }, { key: 'license', label: 'Licence', req: true }, { key: 'attribution', label: 'Attribution text shown to listeners' }, { key: 'category', label: 'Category' }, { key: 'minutes', label: 'Minutes', num: true }],
}
const BADGE: Record<string, string> = { draft: 'bg-surface-sunken text-ink-muted', review: 'bg-amber-100 text-amber-900', published: 'bg-emerald-100 text-emerald-900' }

function Content({ me }: { me: CtlMe }) {
  const q = useAsync(() => ctl<Record<Col, CItem[]>>('/content'), [])
  const [col, setCol] = useState<Col>('concepts')
  const [edit, setEdit] = useState<CItem | 'new' | null>(null)
  const items = q.data?.[col] ?? []
  return (
    <div>
      <H sub="Drafts are only visible here. A reviewer approves content before users can see it. Only add text you have the right to publish — verses, books and audio need a licence you can state.">Content</H>
      <div role="tablist" aria-label="Collection" className="mb-4 flex flex-wrap gap-2">{(Object.keys(FIELDS) as Col[]).map((c) => <button key={c} role="tab" aria-selected={col === c} onClick={() => setCol(c)} className={`min-h-[38px] rounded-full px-4 text-[13px] font-medium capitalize ${col === c ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-muted'}`}>{c}</button>)}
        {can(me, 'content.write') && <button className={`${btn.soft} ml-auto`} onClick={() => setEdit('new')}>New {col.replace(/s$/, '')}</button>}</div>
      {q.loading && !q.data ? <Skeleton className="h-40" /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={() => q.reload()} /> : items.length === 0 ? <EmptyState title={`No ${col} yet`} body="Create one to get started." /> : (
        <ul className="divide-y divide-edge rounded-2xl border border-edge bg-surface-raised">
          {items.map((it) => <li key={it.id}><button onClick={() => setEdit(it)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-sunken"><span className="min-w-0 flex-1 truncate text-[14px] font-medium">{String(it.title ?? it.concept ?? it.reference ?? it.id)}</span><span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${BADGE[it.status]}`}>{it.status}</span></button></li>)}
        </ul>
      )}
      <ContentEditor col={col} item={edit} me={me} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(true) }} />
    </div>
  )
}

function ContentEditor({ col, item, me, onClose, onSaved }: { col: Col; item: CItem | 'new' | null; me: CtlMe; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const isNew = item === 'new'
  const existing = item && item !== 'new' ? item : null
  const [id, setId] = useState('')
  const [v, setV] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!item) return
    setId(existing?.id ?? '')
    setV(Object.fromEntries(FIELDS[col].map((f) => { const x = existing?.[f.key]; return [f.key, x == null ? '' : Array.isArray(x) ? x.join('\n') : String(x)] })))
  }, [item, col, existing])
  const publish = can(me, 'content.publish')
  const save = async (status: 'draft' | 'review' | 'published') => {
    setBusy(true)
    try {
      const body: Record<string, unknown> = { status }
      for (const f of FIELDS[col]) body[f.key] = f.list ? v[f.key].split('\n').map((s) => s.trim()).filter(Boolean) : v[f.key]
      await ctl(`/content/${col}/${isNew ? id : existing!.id}`, send('PUT', body))
      toast(status === 'published' ? 'Published' : status === 'review' ? 'Sent for review' : 'Draft saved')
      onSaved()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const missing = FIELDS[col].some((f) => f.req && !v[f.key]?.trim()) || (isNew && !/^[a-z0-9][a-z0-9-_]{1,60}$/.test(id))
  const locked = existing?.status === 'published' && !publish
  return (
    <Sheet open={!!item} onClose={onClose} title={isNew ? `New ${col.replace(/s$/, '')}` : String(existing?.title ?? existing?.concept ?? existing?.reference ?? existing?.id ?? '')} wide>
      <div className="space-y-4">
        {existing && <p className="text-[12.5px] text-ink-muted">Status: <strong>{existing.status}</strong>{existing.updatedBy ? ` · last edited by ${existing.updatedBy}` : ''}</p>}
        {locked && <p role="alert" className="rounded-xl bg-primary-soft p-3 text-[13px]">This item is live. Only a reviewer can change it.</p>}
        {isNew && <div><label htmlFor="c-id" className="mb-1.5 block text-[13px] font-medium">Id (lowercase letters, numbers, dashes)</label><input id="c-id" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} className={field} /></div>}
        {FIELDS[col].map((f) => (
          <div key={f.key}><label htmlFor={`c-${f.key}`} className="mb-1.5 block text-[13px] font-medium">{f.label}{f.req && ' *'}</label>
            {f.area ? <textarea id={`c-${f.key}`} rows={4} value={v[f.key] ?? ''} disabled={locked} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className={`${field} resize-y`} /> : <input id={`c-${f.key}`} type={f.num ? 'number' : 'text'} value={v[f.key] ?? ''} disabled={locked} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className={field} />}</div>
        ))}
        {!locked && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={btn.ghost} disabled={busy || missing} onClick={() => save('draft')}>Save draft</button>
            <button className={btn.soft} disabled={busy || missing} onClick={() => save('review')}>Submit for review</button>
            {publish && <button className={btn.primary} disabled={busy || missing} onClick={() => save('published')}>Publish</button>}
            {publish && existing && <button className={`${btn.ghost} ml-auto`} onClick={async () => { if (!window.confirm('Delete this item?')) return; try { await ctl(`/content/${col}/${existing.id}`, { method: 'DELETE' }); toast('Deleted'); onSaved() } catch (e) { toast((e as Error).message, 'error') } }}>Delete</button>}
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------ audit + roles

function Audit() {
  const q = useAsync(() => ctl<{ entries: { id: number; actor: string; action: string; target: string | null; meta: unknown; created_at: string }[] }>('/audit'), [])
  return (
    <div>
      <H sub="Every sensitive action taken in Bermi Control, newest first.">Audit log</H>
      {q.loading && !q.data ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.reload()} /> : q.data!.entries.length === 0 ? <EmptyState title="Nothing recorded yet" /> : (
        <div className="overflow-x-auto rounded-2xl border border-edge bg-surface-raised"><table className="w-full min-w-[560px] text-left text-[12.5px]"><thead className="text-ink-muted"><tr><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Who</th><th className="p-3 font-medium">Action</th><th className="p-3 font-medium">Target</th></tr></thead>
          <tbody>{q.data!.entries.map((e) => <tr key={e.id} className="border-t border-edge align-top"><td className="whitespace-nowrap p-3 tabular-nums text-ink-muted">{e.created_at.slice(0, 16).replace('T', ' ')}</td><td className="p-3">{e.actor}</td><td className="p-3 font-medium">{e.action}{e.meta ? <span className="block font-normal text-ink-muted">{JSON.stringify(e.meta).slice(0, 120)}</span> : null}</td><td className="p-3 text-ink-muted">{e.target ?? '—'}</td></tr>)}</tbody></table></div>
      )}
    </div>
  )
}

function Roles() {
  const q = useAsync(() => ctl<{ roles: Record<string, string>; available: string[] }>('/roles'), [])
  const toast = useToast()
  const [rows, setRows] = useState<{ email: string; role: string }[]>([])
  const [email, setEmail] = useState('')
  const avail = q.data?.available ?? []
  const [role, setRole] = useState('')
  useEffect(() => { if (q.data) { setRows(Object.entries(q.data.roles).map(([email, role]) => ({ email, role }))); setRole((r) => r || q.data!.available[0] || '') } }, [q.data])
  const save = async (next: typeof rows) => { try { await ctl('/roles', send('PUT', { roles: Object.fromEntries(next.map((r) => [r.email, r.role])) })); setRows(next); toast('Roles saved') } catch (e) { toast((e as Error).message, 'error') } }
  const desc = useMemo<Record<string, string>>(() => ({ operations: 'Metrics, AI controls, content (can publish)', support: 'Look up accounts, small credit corrections', content: 'Draft and submit content for review', finance: 'Credits, plans, entitlements, audit', analytics: 'Metrics only' }), [])
  if (q.loading && !q.data) return <Skeleton className="h-32" />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.reload()} />
  return (
    <div>
      <H sub="Super administrators are set by the server’s ADMIN_EMAILS list. Everyone else gets only the role you give them.">Roles</H>
      <ul className="mb-4 divide-y divide-edge rounded-2xl border border-edge bg-surface-raised">
        {rows.length === 0 && <li className="p-4 text-[13px] text-ink-muted">No extra roles assigned.</li>}
        {rows.map((r) => <li key={r.email} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]"><span className="min-w-0 flex-1 truncate">{r.email}</span><span className="text-ink-muted">{r.role}</span><button className="text-[12.5px] text-ink-muted underline" onClick={() => save(rows.filter((x) => x.email !== r.email))}>Remove</button></li>)}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const em = email.trim().toLowerCase(); if (!em) return; save([...rows.filter((r) => r.email !== em), { email: em, role }]); setEmail('') }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" aria-label="Email" placeholder="person@example.com" className={`${field} max-w-xs`} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className={`${field} max-w-[180px]`}>{avail.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <button className={btn.primary} disabled={!email.trim()}>Assign</button>
      </form>
      <ul className="mt-5 space-y-1 text-[12.5px] text-ink-muted">{avail.map((a) => <li key={a}><strong className="text-ink">{a}</strong> — {desc[a]}</li>)}</ul>
    </div>
  )
}
