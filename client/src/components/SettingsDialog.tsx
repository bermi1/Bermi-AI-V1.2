import { useEffect, useState } from 'react'
import {
  Check,
  Database,
  Download,
  Loader2,
  LogOut,
  Mic,
  Monitor,
  Moon,
  Palette,
  Plug,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  User,
  X,
  Cpu,
} from 'lucide-react'
import { inputCls, labelCls, primaryBtnCls } from './Modal'
import { useTheme, type ThemePreference } from '../lib/theme'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'
import * as api from '../lib/api'
import type { Connector, ModelOption, Profile, SettingsInfo } from '../lib/types'

type Tab = 'profile' | 'appearance' | 'models' | 'voice' | 'connectors' | 'data'

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: Tab
  models: ModelOption[]
  selectedModel: string
  onSelectModel: (id: string) => void
  onModelsChanged: () => void
  onProfileSaved: (profile: Profile) => void
  onSignOut: () => void
}

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'connectors', label: 'Connectors', icon: Plug },
  { id: 'data', label: 'API & Data', icon: Database },
]

export function SettingsDialog({
  onClose,
  initialTab = 'profile',
  models,
  selectedModel,
  onSelectModel,
  onModelsChanged,
  onProfileSaved,
  onSignOut,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>(initialTab)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-raised shadow-2xl animate-fade-up md:h-[600px] md:max-w-4xl md:flex-row md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Nav — left rail on desktop, scrolling tabs on mobile */}
        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-edge px-3 py-2 md:w-52 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-3 md:py-4">
          <div className="hidden px-2 pb-3 md:block">
            <h2 className="text-[16px] font-semibold tracking-tight">Settings</h2>
          </div>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                tab === id
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-ink-muted hover:bg-surface-sunken md:hidden"
            aria-label="Close settings"
          >
            <X size={17} />
          </button>
        </nav>

        <div className="relative flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 hidden rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken md:block"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
          {tab === 'profile' && (
            <ProfileTab onProfileSaved={onProfileSaved} onSignOut={onSignOut} />
          )}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'models' && (
            <ModelsTab
              models={models}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              onModelsChanged={onModelsChanged}
            />
          )}
          {tab === 'voice' && <VoiceTab />}
          {tab === 'connectors' && <ConnectorsTab />}
          {tab === 'data' && <DataTab />}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
      {subtitle && <p className="mt-1 text-[13.5px] text-ink-muted">{subtitle}</p>}
    </header>
  )
}

// ---------------- Profile ----------------

function ProfileTab({
  onProfileSaved,
  onSignOut,
}: {
  onProfileSaved: (p: Profile) => void
  onSignOut: () => void
}) {
  const [profile, setProfile] = useState<Profile>({ name: '', role: '', preferences: '' })
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setProfile(s.profile)
        setAccount(s.account)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const { profile: next } = await api.saveProfile(profile)
      setProfile(next)
      onProfileSaved(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle
        title="Profile"
        subtitle="Bermi uses this to personalize responses — it rides along with every chat."
      />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary">
            {(profile.name || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <label className={labelCls}>Full name</label>
            <input
              className={inputCls}
              value={profile.name}
              disabled={!loaded}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="What should Bermi call you?"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>What best describes your work?</label>
          <input
            className={inputCls}
            value={profile.role}
            disabled={!loaded}
            onChange={(e) => setProfile({ ...profile, role: e.target.value })}
            placeholder="e.g. Founder, developer, student — what you do"
          />
        </div>
        <div>
          <label className={labelCls}>
            What preferences should Bermi consider in responses?
          </label>
          <textarea
            className={inputCls + ' min-h-[110px] resize-y'}
            value={profile.preferences}
            disabled={!loaded}
            onChange={(e) => setProfile({ ...profile, preferences: e.target.value })}
            placeholder={'e.g. Be concise. Explain step by step. Prefer simple language.'}
          />
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving || !loaded} className={primaryBtnCls}>
            {saved ? <Check size={16} /> : saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>

        <div className="mt-2 border-t border-edge pt-4">
          <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-4 py-3">
            <div>
              <div className="text-sm font-medium">{account?.name ?? '—'}</div>
              <div className="text-xs text-ink-faint">{account?.email ?? ''}</div>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-red-300 hover:text-red-500"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------- Appearance ----------------

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun; hint: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Warm paper white' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Charcoal night' },
  { value: 'system', label: 'System', icon: Monitor, hint: 'Match your device' },
]

function AppearanceTab() {
  const { preference, setPreference } = useTheme()
  return (
    <div>
      <SectionTitle title="Appearance" subtitle="How Bermi looks on this device." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {themeOptions.map(({ value, label, icon: Icon, hint }) => (
          <button
            key={value}
            onClick={() => setPreference(value)}
            className={`flex flex-col items-start gap-2 rounded-xl border px-4 py-4 text-left transition-colors ${
              preference === value
                ? 'border-primary bg-primary-soft'
                : 'border-edge hover:bg-surface-sunken'
            }`}
          >
            <Icon size={18} className={preference === value ? 'text-primary' : 'text-ink-muted'} />
            <div>
              <div
                className={`text-sm font-semibold ${preference === value ? 'text-primary' : ''}`}
              >
                {label}
              </div>
              <div className="text-xs text-ink-faint">{hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------- Models ----------------

function ModelsTab({
  models,
  selectedModel,
  onSelectModel,
  onModelsChanged,
}: {
  models: ModelOption[]
  selectedModel: string
  onSelectModel: (id: string) => void
  onModelsChanged: () => void
}) {
  const [customId, setCustomId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const addModel = async () => {
    if (!customId.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.addCustomModel(customId.trim())
      setCustomId('')
      onModelsChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <SectionTitle
        title="Models"
        subtitle="Any OpenRouter model can power Bermi — pick a default and add your own."
      />
      <div className="space-y-2.5">
        {models.map((m) => (
          <div
            key={m.id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
              m.id === selectedModel ? 'border-primary bg-primary-soft' : 'border-edge'
            }`}
          >
            <button onClick={() => onSelectModel(m.id)} className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{m.label}</span>
                {m.id === selectedModel && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Default
                  </span>
                )}
                {m.custom && (
                  <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] font-medium text-ink-faint">
                    Custom
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-faint">
                {m.description} · <code className="text-[11px]">{m.id}</code>
              </div>
            </button>
            {m.custom && (
              <button
                onClick={() => api.removeCustomModel(m.id).then(onModelsChanged)}
                className="rounded-lg p-1.5 text-ink-faint hover:text-red-500"
                aria-label={`Remove ${m.label}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <label className={labelCls}>Add an OpenRouter model</label>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            placeholder="provider/model — e.g. mistralai/mistral-large"
            onKeyDown={(e) => e.key === 'Enter' && addModel()}
          />
          <button
            onClick={addModel}
            disabled={busy || !customId.trim()}
            className={primaryBtnCls + ' flex shrink-0 items-center gap-1.5'}
          >
            <Plus size={15} />
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}
      </div>
    </div>
  )
}

// ---------------- Voice cloning ----------------

const ACTIVE_VOICE_KEY = 'bermi-tts-voice'

function VoiceTab() {
  const [voices, setVoices] = useState<api.VoiceClone[] | null>(null)
  const [activeVoiceId, setActiveVoiceId] = useState(() => localStorage.getItem(ACTIVE_VOICE_KEY) || '')
  const [phrase, setPhrase] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [consentBlob, setConsentBlob] = useState<Blob | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => api.listVoiceClones().then(setVoices).catch(() => setVoices([]))
  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const recorder = useVoiceRecorder(async (blob) => {
    setConsentBlob(blob)
  })

  const getPhrase = async () => {
    setError(null)
    setConsentBlob(null)
    try {
      const r = await api.requestVoiceConsentPhrase()
      setPhrase(r.phrase)
      setExpiresAt(Date.now() + r.expiresInSeconds * 1000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const create = async () => {
    if (!consentBlob) return
    setBusy(true)
    setError(null)
    try {
      await api.createVoiceClone({ title: title.trim() || 'My voice', consent: consentBlob })
      setPhrase(null)
      setExpiresAt(null)
      setConsentBlob(null)
      setTitle('')
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this cloned voice? This cannot be undone.')) return
    await api.deleteVoiceClone(id)
    if (activeVoiceId === id) {
      localStorage.removeItem(ACTIVE_VOICE_KEY)
      setActiveVoiceId('')
    }
    refresh()
  }

  const setActive = (id: string, fishModelId: string) => {
    if (activeVoiceId === id) {
      localStorage.removeItem(ACTIVE_VOICE_KEY)
      setActiveVoiceId('')
    } else {
      localStorage.setItem(ACTIVE_VOICE_KEY, fishModelId)
      setActiveVoiceId(id)
    }
  }

  const expired = phrase != null && secondsLeft <= 0

  return (
    <div>
      <SectionTitle
        title="Voice"
        subtitle="Clone your own voice so Bermi can speak replies as you — gated by a spoken consent check, since a cloned voice is powerful enough to misuse."
      />

      <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-primary-soft/60 px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" />
        <span>
          Only clone your own voice, or a voice you have explicit permission to use. Every clone requires you to
          speak a fresh, random phrase out loud right before creation — Bermi verifies it was actually said, so a
          clone can't be made from a recording of someone else found elsewhere.
        </span>
      </div>

      <div className="rounded-2xl border border-edge bg-surface p-4">
        <h4 className="mb-3 text-[13.5px] font-semibold">Create a cloned voice</h4>

        {!phrase ? (
          <button onClick={getPhrase} className={primaryBtnCls}>
            Get a consent phrase
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-edge bg-surface-raised px-4 py-3">
              <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Read this out loud</p>
              <p className="mt-1 text-[15px] font-medium text-ink">"{phrase}"</p>
              <p className={`mt-1 text-[11.5px] ${expired ? 'text-rose-500' : 'text-ink-faint'}`}>
                {expired ? 'Expired — get a new phrase.' : `Expires in ${secondsLeft}s`}
              </p>
            </div>

            {expired ? (
              <button onClick={getPhrase} className={primaryBtnCls}>
                Get a new phrase
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => (recorder.phase === 'recording' ? recorder.stop() : recorder.start())}
                  disabled={recorder.phase === 'processing'}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    recorder.phase === 'recording'
                      ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40'
                      : 'border-edge text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  {recorder.phase === 'recording' ? <Square size={14} fill="currentColor" /> : <Mic size={14} />}
                  {recorder.phase === 'recording' ? 'Stop' : consentBlob ? 'Record again' : 'Record myself saying it'}
                </button>
                {consentBlob && recorder.phase !== 'recording' && (
                  <span className="text-[12.5px] text-emerald-600 dark:text-emerald-400">Recorded ✓</span>
                )}
              </div>
            )}

            {consentBlob && !expired && (
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this voice — e.g. My voice"
                />
                <button
                  onClick={create}
                  disabled={busy}
                  className={primaryBtnCls + ' flex shrink-0 items-center gap-1.5'}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {busy ? 'Creating…' : 'Create voice'}
                </button>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
      </div>

      <div className="mt-6">
        <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Your cloned voices</h4>
        {!voices ? (
          <p className="text-[13px] text-ink-faint">Loading…</p>
        ) : voices.length === 0 ? (
          <p className="text-[13px] text-ink-faint">None yet — create one above to hear replies in your own voice.</p>
        ) : (
          <div className="space-y-2">
            {voices.map((v) => {
              const active = activeVoiceId === v.id
              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${
                    active ? 'border-primary bg-primary-soft' : 'border-edge bg-surface'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {v.title}
                      {active && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-ink-faint">
                      Created {new Date(v.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActive(v.id, v.fishModelId)}
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${
                        active
                          ? 'text-primary hover:bg-surface-raised'
                          : 'text-ink-muted hover:bg-surface-sunken'
                      }`}
                    >
                      {active ? 'In use' : 'Use for replies'}
                    </button>
                    <button
                      onClick={() => remove(v.id)}
                      className="rounded-lg p-1.5 text-ink-faint hover:text-red-500"
                      aria-label={`Delete ${v.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Connectors ----------------

const CONNECTOR_BADGES: Record<Connector['status'], { label: string; cls: string }> = {
  connected: {
    label: 'Connected',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  available: { label: 'Ready to connect', cls: 'bg-primary-soft text-primary' },
  setup_required: {
    label: 'Setup required',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  coming_soon: { label: 'Coming soon', cls: 'bg-surface-sunken text-ink-faint' },
}

function ConnectorsTab() {
  const [connectors, setConnectors] = useState<Connector[]>([])

  const refresh = () => api.listConnectors().then(setConnectors).catch(() => {})
  useEffect(() => {
    refresh()
  }, [])

  return (
    <div>
      <SectionTitle
        title="Connectors"
        subtitle="Connect Bermi to the apps you work in. Google unlocks Gmail, Calendar, and Drive access."
      />
      <div className="space-y-3">
        {connectors.map((c) => {
          const badge = CONNECTOR_BADGES[c.status]
          return (
            <div key={c.id} className="rounded-xl border border-edge px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
                    <Plug size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{c.label}</div>
                    <div className="text-xs text-ink-faint">{c.description}</div>
                    {c.account && (
                      <div className="mt-1 text-xs text-ink-muted">
                        Signed in as <span className="font-medium">{c.account}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-edge pt-3">
                {c.status === 'connected' ? (
                  <button
                    onClick={() => api.disconnectConnector(c.id).then(refresh)}
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
                  >
                    Disconnect
                  </button>
                ) : c.status === 'available' && c.id === 'google' ? (
                  <a
                    href={api.googleAuthUrl()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    Connect {c.label}
                  </a>
                ) : c.status === 'setup_required' ? (
                  <p className="text-xs text-ink-faint">
                    Add this provider's OAuth credentials to the server{' '}
                    <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">.env</code>{' '}
                    to enable one-click connect
                    {c.id === 'google' && (
                      <>
                        {' '}
                        (<code className="text-[11px]">GOOGLE_CLIENT_ID</code>,{' '}
                        <code className="text-[11px]">GOOGLE_CLIENT_SECRET</code>)
                      </>
                    )}
                    .
                  </p>
                ) : (
                  <p className="text-xs text-ink-faint">On the roadmap.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- API & Data ----------------

function DataTab() {
  const [info, setInfo] = useState<SettingsInfo | null>(null)

  useEffect(() => {
    api.getSettings().then(setInfo).catch(() => {})
  }, [])

  return (
    <div>
      <SectionTitle title="API & Data" subtitle="Where Bermi's intelligence and memory live." />

      <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
        AI access
      </h4>
      <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-3">
        <div className="flex items-center gap-2.5 text-sm">
          <Sparkles size={15} className="text-primary" />
          <div>
            <div className="font-medium">Managed by Bermi</div>
            <div className="text-xs text-ink-faint">
              AI is included with your account — no API key needed. All requests run through
              Bermi's secure server.
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${
            info?.aiReady
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
          }`}
        >
          {info?.aiReady ? 'Active' : 'Pending'}
        </span>
      </div>

      <h4 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
        Database
      </h4>
      <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-3">
        <div className="flex items-center gap-2.5 text-sm">
          <Database size={15} className="text-primary" />
          <div>
            <div className="font-medium">
              {info?.storageBackend === 'supabase' ? 'Supabase (Postgres)' : 'Local SQLite'}
            </div>
            <div className="text-xs text-ink-faint">
              {info?.storageBackend === 'supabase'
                ? 'Your conversations, documents, and brains sync to the cloud.'
                : 'Data is stored on this server. Cloud sync activates when Supabase is reachable.'}
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${
            info?.storageBackend === 'supabase'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : 'bg-surface-sunken text-ink-faint'
          }`}
        >
          {info?.storageBackend === 'supabase' ? 'Cloud' : 'Local'}
        </span>
      </div>

      <h4 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
        Your data — you're in control
      </h4>
      <p className="mb-3 text-[13px] text-ink-muted">
        Everything you create belongs to you. Download a full copy any time, or erase it.
        Bermi keeps a local cache in this browser so your workspace feels like an installed app.
      </p>
      <div className="space-y-2">
        <a
          href={api.dataExportUrl()}
          className="flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-3 transition-colors hover:bg-surface-sunken"
        >
          <div className="flex items-center gap-2.5 text-sm">
            <Download size={15} className="text-primary" />
            <div>
              <div className="font-medium">Export my data</div>
              <div className="text-xs text-ink-faint">
                All conversations, documents, and knowledge bases as JSON
              </div>
            </div>
          </div>
          <span className="text-[12px] font-medium text-primary">Download</span>
        </a>
        <button
          onClick={async () => {
            if (!confirm('Delete all your conversations, documents, and knowledge bases? This cannot be undone.')) return
            await api.wipeData()
            location.reload()
          }}
          className="flex w-full items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-3 text-left transition-colors hover:bg-surface-sunken"
        >
          <div className="flex items-center gap-2.5 text-sm">
            <Trash2 size={15} className="text-amber-500" />
            <div>
              <div className="font-medium">Clear my content</div>
              <div className="text-xs text-ink-faint">Erase content but keep your account</div>
            </div>
          </div>
          <span className="text-[12px] font-medium text-amber-600">Clear</span>
        </button>
        <button
          onClick={async () => {
            if (!confirm('Permanently delete your account and ALL data? This cannot be undone.')) return
            await api.deleteAccount()
            location.reload()
          }}
          className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-surface px-3.5 py-3 text-left transition-colors hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
        >
          <div className="flex items-center gap-2.5 text-sm">
            <Trash2 size={15} className="text-red-500" />
            <div>
              <div className="font-medium text-red-600 dark:text-red-400">Delete my account</div>
              <div className="text-xs text-ink-faint">Remove everything, permanently</div>
            </div>
          </div>
          <span className="text-[12px] font-medium text-red-600">Delete</span>
        </button>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        Every generated document is versioned — nothing is ever silently overwritten. Your
        brains and profile stay private to your workspace.
      </p>
    </div>
  )
}
