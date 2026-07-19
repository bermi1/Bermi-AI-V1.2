import { useEffect, useState } from 'react'
import {
  Check,
  Database,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Plug,
  Plus,
  Sun,
  Trash2,
  User,
  X,
  Cpu,
} from 'lucide-react'
import { inputCls, labelCls, primaryBtnCls } from './Modal'
import { useTheme, type ThemePreference } from '../lib/theme'
import * as api from '../lib/api'
import type { Connector, ModelOption, Profile, SettingsInfo } from '../lib/types'

type Tab = 'profile' | 'appearance' | 'models' | 'connectors' | 'data'

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: Tab
  models: ModelOption[]
  selectedModel: string
  onSelectModel: (id: string) => void
  onModelsChanged: () => void
  onProfileSaved: (profile: Profile) => void
}

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'Models', icon: Cpu },
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
          {tab === 'profile' && <ProfileTab onProfileSaved={onProfileSaved} />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'models' && (
            <ModelsTab
              models={models}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              onModelsChanged={onModelsChanged}
            />
          )}
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

function ProfileTab({ onProfileSaved }: { onProfileSaved: (p: Profile) => void }) {
  const [profile, setProfile] = useState<Profile>({ name: '', role: '', preferences: '' })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setProfile(s.profile)
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
            placeholder="e.g. Founder at Basil Link — media, events & real estate"
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
            placeholder={'e.g. Be concise. Use British English. Default currency is TZS.'}
          />
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving || !loaded} className={primaryBtnCls}>
            {saved ? <Check size={16} /> : saving ? 'Saving…' : 'Save profile'}
          </button>
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
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSettings().then(setInfo).catch(() => {})
  }, [])

  const submitKey = async () => {
    if (!keyInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      const next = await api.saveApiKey(keyInput.trim())
      setInfo((cur) => (cur ? { ...cur, ...next } : cur))
      setKeyInput('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle
        title="API & Data"
        subtitle="Where Bermi's intelligence and memory live."
      />

      <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
        OpenRouter API key
      </h4>
      <p className="mb-2.5 text-[13px] text-ink-muted">
        Stored server-side only — never sent to the browser. An{' '}
        <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">OPENROUTER_API_KEY</code>{' '}
        environment variable works too.
      </p>
      {info?.hasApiKey && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <KeyRound size={14} className="text-primary" />
            <span>
              Key configured{' '}
              <span className="text-ink-faint">
                ({info.apiKeyHint}, via {info.apiKeySource === 'env' ? 'environment' : 'settings'})
              </span>
            </span>
          </div>
          {info.apiKeySource === 'settings' && (
            <button
              onClick={() => api.clearApiKey().then((n) => setInfo((c) => (c ? { ...c, ...n } : c)))}
              className="rounded-lg p-1.5 text-ink-faint hover:text-red-500"
              aria-label="Remove stored key"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="sk-or-v1-…"
          className={inputCls}
          autoComplete="off"
        />
        <button
          onClick={submitKey}
          disabled={saving || !keyInput.trim()}
          className={primaryBtnCls + ' shrink-0'}
        >
          {saved ? <Check size={16} /> : 'Save'}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

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
                ? 'Conversations, documents, and brains sync to your Supabase project.'
                : 'Set SUPABASE_URL and SUPABASE_KEY in the server .env to sync to Supabase.'}
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
    </div>
  )
}
