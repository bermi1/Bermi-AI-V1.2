import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import * as api from '../lib/api'
import type {
  AdminActivity,
  AdminProviderKeys,
  AdminStats,
  AdminUser,
  ProviderHealth,
} from '../lib/api'
import { BermiMark } from '../components/Logo'

type Tab = 'overview' | 'users' | 'engagement' | 'settings'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'engagement', label: 'Engagement', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function AdminDashboard({ onExit, selfEmail }: { onExit: () => void; selfEmail: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [denied, setDenied] = useState(false)

  const load = () =>
    api
      .adminOverview()
      .then((r) => {
        setStats(r.stats)
        setUsers(r.users)
      })
      .catch((e) => {
        if ((e as api.ApiError).message?.includes('Admin')) setDenied(true)
        else setUsers([])
      })

  useEffect(() => {
    load()
  }, [])

  if (denied) {
    return (
      <Shell tab={tab} onTab={setTab} onExit={onExit}>
        <div className="mx-auto mt-20 max-w-md rounded-2xl border border-edge bg-surface-raised p-8 text-center">
          <ShieldAlert size={32} className="mx-auto mb-3 text-amber-500" />
          <h2 className="text-[17px] font-semibold text-ink">Admins only</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Your account doesn't have administrator access to this dashboard.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell tab={tab} onTab={setTab} onExit={onExit}>
      {tab === 'overview' && <OverviewTab stats={stats} />}
      {tab === 'users' && <UsersTab users={users} selfEmail={selfEmail} onUsersChange={setUsers} onStatsChange={setStats} />}
      {tab === 'engagement' && <EngagementTab />}
      {tab === 'settings' && <SettingsTab />}
    </Shell>
  )
}

function OverviewTab({ stats }: { stats: AdminStats | null }) {
  const cards = stats
    ? [
        { label: 'Users', value: stats.users, icon: <Users size={16} /> },
        { label: 'Conversations', value: stats.conversations, icon: <MessageSquare size={16} /> },
        { label: 'Messages', value: stats.messages, icon: <MessageSquare size={16} /> },
        { label: 'Documents', value: stats.documents, icon: <FileText size={16} /> },
        { label: 'Organizations', value: stats.institutions, icon: <Building2 size={16} /> },
        { label: 'Courses', value: stats.courses, icon: <BookOpen size={16} /> },
        { label: 'Enrollments', value: stats.enrollments, icon: <GraduationCap size={16} /> },
        { label: 'Certificates', value: stats.certificates, icon: <BadgeCheck size={16} /> },
      ]
    : []

  return (
    <div>
      <h1 className="text-[24px] font-bold text-ink">Overview</h1>
      <p className="mb-6 text-[13.5px] text-ink-muted">Platform-wide totals, at a glance.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-edge bg-surface-raised p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">{c.icon}</div>
            <div className="text-[24px] font-bold leading-none text-ink">{c.value}</div>
            <div className="mt-1 text-[12px] text-ink-faint">{c.label}</div>
          </div>
        ))}
        {!stats && <div className="col-span-full py-6 text-center text-ink-faint"><Loader2 size={18} className="mx-auto animate-spin" /></div>}
      </div>
      <ProviderHealthPanel />
    </div>
  )
}

function UsersTab({
  users,
  selfEmail,
  onUsersChange,
  onStatsChange,
}: {
  users: AdminUser[] | null
  selfEmail: string
  onUsersChange: (fn: (list: AdminUser[] | null) => AdminUser[] | null) => void
  onStatsChange: (fn: (s: AdminStats | null) => AdminStats | null) => void
}) {
  const [query, setQuery] = useState('')
  const [resetFor, setResetFor] = useState<AdminUser | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!users) return []
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, query])

  const toggleVerified = async (u: AdminUser) => {
    setBusyId(u.id)
    try {
      const updated = await api.adminUpdateUser(u.id, { email_verified: !u.email_verified })
      onUsersChange((list) => (list ? list.map((x) => (x.id === u.id ? { ...x, email_verified: updated.email_verified } : x)) : list))
    } finally {
      setBusyId(null)
    }
  }

  const del = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.name} (${u.email})? This removes their account and data.`)) return
    setBusyId(u.id)
    try {
      await api.adminDeleteUser(u.id)
      onUsersChange((list) => (list ? list.filter((x) => x.id !== u.id) : list))
      onStatsChange((s) => (s ? { ...s, users: s.users - 1 } : s))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-ink">Users {users && <span className="text-ink-faint">· {users.length}</span>}</h1>
          <p className="text-[13.5px] text-ink-muted">Manage accounts, verification, and passwords.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-xl border border-edge bg-surface-raised py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
      </div>

      {!users ? (
        <div className="py-10 text-center text-ink-faint"><Loader2 size={20} className="mx-auto animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-edge">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">User</th>
                <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold">Joined</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.email.toLowerCase() === selfEmail.toLowerCase()
                return (
                  <tr key={u.id} className="border-t border-edge">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                          {u.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">
                            {u.name} {isSelf && <span className="text-ink-faint">(you)</span>}
                          </div>
                          <div className="truncate text-[12px] text-ink-faint">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.email_verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <BadgeCheck size={12} /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setResetFor(u)}
                          disabled={busyId === u.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                          title="Reset password"
                        >
                          <KeyRound size={13} /> Password
                        </button>
                        <button
                          onClick={() => toggleVerified(u)}
                          disabled={busyId === u.id}
                          className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                        >
                          {u.email_verified ? 'Unverify' : 'Verify'}
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => del(u)}
                            disabled={busyId === u.id}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">No users match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  )
}

// A minimal bar chart: no charting library, just proportional div heights —
// fine at admin-dashboard scale and keeps bundle size down.
function BarSeries({ points, color }: { points: { day: string; n: number }[]; color: string }) {
  const max = Math.max(1, ...points.map((p) => p.n))
  return (
    <div className="flex h-24 items-end gap-1">
      {points.map((p) => (
        <div key={p.day} className="group relative flex-1">
          <div
            className={`w-full rounded-t-sm ${color} transition-all`}
            style={{ height: `${Math.max(3, (p.n / max) * 96)}px` }}
          />
          <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10.5px] font-medium text-surface group-hover:block">
            {p.n} · {p.day.slice(5)}
          </div>
        </div>
      ))}
    </div>
  )
}

function EngagementTab() {
  const [data, setData] = useState<AdminActivity | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.adminActivity().then(setData).catch(() => setError(true))
  }, [])

  const totalMessages = useMemo(() => data?.messagesByDay.reduce((a, p) => a + p.n, 0) ?? 0, [data])
  const totalSignups = useMemo(() => data?.signupsByDay.reduce((a, p) => a + p.n, 0) ?? 0, [data])
  const peakActive = useMemo(() => Math.max(0, ...(data?.activeUsersByDay.map((p) => p.n) ?? [0])), [data])

  return (
    <div>
      <h1 className="text-[24px] font-bold text-ink">Engagement</h1>
      <p className="mb-6 text-[13.5px] text-ink-muted">How people are using Bermi AI, over the last 14 days.</p>

      {error && <p className="text-[13px] text-rose-500">Couldn't load engagement data.</p>}
      {!data && !error && <div className="py-10 text-center text-ink-faint"><Loader2 size={20} className="mx-auto animate-spin" /></div>}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-edge bg-surface-raised p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13.5px] font-semibold text-ink">Messages / day</h2>
                <span className="text-[12px] text-ink-faint">{totalMessages} total</span>
              </div>
              <BarSeries points={data.messagesByDay} color="bg-primary" />
            </div>
            <div className="rounded-2xl border border-edge bg-surface-raised p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13.5px] font-semibold text-ink">Active users / day</h2>
                <span className="text-[12px] text-ink-faint">peak {peakActive}</span>
              </div>
              <BarSeries points={data.activeUsersByDay} color="bg-emerald-500" />
            </div>
            <div className="rounded-2xl border border-edge bg-surface-raised p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13.5px] font-semibold text-ink">New signups / day</h2>
                <span className="text-[12px] text-ink-faint">{totalSignups} total</span>
              </div>
              <BarSeries points={data.signupsByDay} color="bg-amber-500" />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-edge bg-surface-raised p-4">
              <h2 className="mb-3 text-[13.5px] font-semibold text-ink">Most active users</h2>
              {data.topUsers.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">No messages sent yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.topUsers.map((u, i) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 shrink-0 text-ink-faint">{i + 1}.</span>
                        <span className="truncate font-medium text-ink">{u.name}</span>
                        <span className="truncate text-[12px] text-ink-faint">{u.email}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-semibold text-primary">
                        {u.message_count} msgs
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-edge bg-surface-raised p-4">
              <h2 className="mb-3 text-[13.5px] font-semibold text-ink">Newest signups</h2>
              {data.recentUsers.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">No users yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-ink">{u.name}</span>
                        <span className="truncate text-[12px] text-ink-faint">{u.email}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-faint">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SettingsTab() {
  return (
    <div>
      <h1 className="text-[24px] font-bold text-ink">Settings</h1>
      <p className="mb-6 text-[13.5px] text-ink-muted">AI provider keys, capacity, and the shared chat quota.</p>
      <ProviderKeysPanel />
      <QuotaPanel />
    </div>
  )
}

const PROVIDER_LABEL: Record<string, string> = {
  openrouter: 'OpenRouter',
  groq: 'Groq',
  cerebras: 'Cerebras',
  nvidia: 'NVIDIA NIM',
  local: 'On-device (local)',
}

// Lets an admin widen the shared AI quota pool, or wire up a text-to-speech
// provider (Fish Audio, ElevenLabs), directly from the product — no Vercel
// dashboard access needed. Keys added here are merged with whatever's set
// as an env var; either source works.
function ProviderKeysPanel() {
  const [data, setData] = useState<AdminProviderKeys | null>(null)
  const [provider, setProvider] = useState('openrouter')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => api.adminProviderKeys().then(setData).catch(() => setData(null))
  useEffect(() => {
    load()
  }, [])

  const allProviders = data
    ? [
        ...data.chat.map((p) => ({ id: p.id, label: p.label })),
        ...data.search.map((p) => ({ id: p.id, label: p.label })),
        ...data.tts.filter((p) => p.managed).map((p) => ({ id: p.id, label: p.label })),
      ]
    : []

  const addKey = async () => {
    if (!key.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.adminAddProviderKey(provider, key.trim())
      setKey('')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const removeKey = async (providerId: string, index: number) => {
    try {
      await api.adminDeleteProviderKey(providerId, index)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!data) return null

  return (
    <div className="mb-8 rounded-2xl border border-edge bg-surface-raised p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound size={15} className="text-primary" />
        <h2 className="text-[14px] font-semibold text-ink">AI provider &amp; voice keys</h2>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-muted">
        Add another account's key to widen the shared AI quota pool, a Tavily key to enable real, free web-search
        grounding (current events, prices, "latest" questions), or a Fish Audio / ElevenLabs key for text-to-speech
        in more languages. Added here, not in Vercel — takes effect immediately.
      </p>

      <div className="mb-4 space-y-2">
        {data.chat.map((p) => (
          <div key={p.id} className="rounded-xl border border-edge bg-surface px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="font-semibold text-ink">{p.label}</span>
              <span className="text-[11.5px] text-ink-faint">{p.envKeys} from env · {p.storedKeys.length} added here</span>
            </div>
            {p.storedKeys.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.storedKeys.map((hint, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted">
                    {hint}
                    <button onClick={() => removeKey(p.id, i)} className="text-ink-faint hover:text-rose-500"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {data.search.map((p) => (
          <div key={p.id} className="rounded-xl border border-edge bg-surface px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <Search size={12} className="text-primary" /> {p.label}
              </span>
              <span className="text-[11.5px] text-ink-faint">{p.envKeys} from env · {p.storedKeys.length} added here</span>
            </div>
            {p.storedKeys.length === 0 ? (
              <p className="text-[11.5px] text-ink-faint">Not set up — without this, "what's happening now" questions fall back to the model's own trained knowledge.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {p.storedKeys.map((hint, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted">
                    {hint}
                    <button onClick={() => removeKey(p.id, i)} className="text-ink-faint hover:text-rose-500"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {data.tts.map((p) => (
          <div key={p.id} className="rounded-xl border border-edge bg-surface px-3.5 py-2.5">
            <div className="mb-0.5 flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <Mic size={12} className="text-primary" /> {p.label}
              </span>
              <span className={`text-[11px] font-semibold ${p.configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-faint'}`}>
                {p.configured ? 'Configured' : 'Not set up'}
              </span>
            </div>
            <p className="text-[11.5px] text-ink-faint">{p.languages}{!p.managed ? ' — uses your existing Groq key automatically' : ''}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-xl border border-edge bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-primary">
          {allProviders.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKey()}
          placeholder="Paste API key…"
          type="password"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
        />
        <button
          onClick={addKey}
          disabled={busy || !key.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add key
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
    </div>
  )
}

// Every signed-in user draws from the shared provider pool at this many
// messages per hour (see server routes/chat.js#quotaGate). Raise it as more
// provider keys widen the pool; lower it if the pool is under pressure (see
// AI provider capacity panel above).
function QuotaPanel() {
  const [perHour, setPerHour] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.adminGetQuota().then((r) => {
      setPerHour(r.perHour)
      setInput(String(r.perHour))
    })
  }, [])

  const save = async () => {
    const n = Number(input)
    if (!(n > 0)) return
    setBusy(true)
    try {
      const r = await api.adminSetQuota(n)
      setPerHour(r.perHour)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setBusy(false)
    }
  }

  if (perHour == null) return null

  return (
    <div className="mb-8 rounded-2xl border border-edge bg-surface-raised p-4">
      <div className="mb-1 flex items-center gap-2">
        <MessageSquare size={15} className="text-primary" />
        <h2 className="text-[14px] font-semibold text-ink">Per-user chat quota</h2>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-muted">
        Each signed-in user gets this many AI messages per hour from the shared provider pool, so one heavy user
        can't starve everyone else. Raise it as more provider keys are added above.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="w-28 rounded-xl border border-edge bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
        />
        <span className="text-[12.5px] text-ink-faint">messages / hour / user</span>
        <button
          onClick={save}
          disabled={busy || Number(input) === perHour || !(Number(input) > 0)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// Watch this during a launch: "cooling" keys mean that provider/key just hit
// a quota or auth error and is being skipped for ~60s while the others carry
// load. If every key on every provider is cooling at once, the shared
// free-tier pool is genuinely exhausted — that's the signal to add more
// provider keys, not a bug to chase.
function ProviderHealthPanel() {
  const [providers, setProviders] = useState<ProviderHealth[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = () => {
    setRefreshing(true)
    api
      .adminProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setRefreshing(false))
  }
  useEffect(load, [])

  return (
    <div className="mt-6 rounded-2xl border border-edge bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-primary" />
          <h2 className="text-[14px] font-semibold text-ink">AI provider capacity</h2>
        </div>
        <button onClick={load} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken" title="Refresh">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      {!providers ? (
        <div className="py-4 text-center text-ink-faint"><Loader2 size={16} className="mx-auto animate-spin" /></div>
      ) : providers.length === 0 ? (
        <p className="text-[13px] text-rose-500">No AI provider is configured on the server at all — chat will fail for every user.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {providers.map((p) => {
            const allCooling = p.coolingKeys >= p.totalKeys && p.totalKeys > 0
            return (
              <div key={p.id} className="rounded-xl border border-edge bg-surface px-3.5 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">{PROVIDER_LABEL[p.id] || p.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      allCooling
                        ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                        : p.coolingKeys > 0
                          ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {allCooling ? 'Exhausted' : p.coolingKeys > 0 ? 'Under pressure' : 'Healthy'}
                  </span>
                </div>
                <p className="text-[12px] text-ink-faint">
                  {p.totalKeys} key{p.totalKeys === 1 ? '' : 's'} configured
                  {p.coolingKeys > 0 ? ` · ${p.coolingKeys} cooling down` : ''}
                </p>
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-ink-faint">
        A key "cools down" for ~60s right after it returns a quota/auth error, so requests route to a healthy key
        instead. If a provider shows "Exhausted" often, add another key for it (env vars support up to 4 OpenRouter
        keys and 2 Groq keys) or enable Cerebras for another independent free quota pool.
      </p>
    </div>
  )
}

function Shell({
  children,
  tab,
  onTab,
  onExit,
}: {
  children: React.ReactNode
  tab: Tab
  onTab: (t: Tab) => void
  onExit: () => void
}) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 shrink-0 border-r border-edge bg-surface-raised transition-transform md:static md:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-edge px-4">
          <BermiMark size={20} className="text-primary" />
          <span className="text-[14.5px] font-bold text-ink">Bermi Admin</span>
        </div>
        <nav className="space-y-0.5 p-2.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onTab(t.id)
                setNavOpen(false)
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors ${
                tab === t.id ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-edge p-2.5">
          <button
            onClick={onExit}
            className="w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            ← Back to app
          </button>
        </div>
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-10 bg-black/30 md:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b border-edge px-4 md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken"
            aria-label="Open menu"
          >
            <LayoutDashboard size={18} />
          </button>
          <span className="text-[14.5px] font-semibold text-ink">{TABS.find((t) => t.id === tab)?.label}</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.adminResetPassword(user.id, password)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-edge bg-surface-raised p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <KeyRound size={16} className="text-primary" /> Reset password
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-surface-sunken"><X size={16} /></button>
        </div>
        <p className="mb-3 text-[13px] text-ink-muted">
          Set a new password for <span className="font-medium text-ink">{user.email}</span>.
        </p>
        {done ? (
          <div className="rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
            Password updated.
          </div>
        ) : (
          <>
            <input
              autoFocus
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="New password"
              className="w-full rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
            />
            {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken">Cancel</button>
              <button
                onClick={submit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Set password
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
