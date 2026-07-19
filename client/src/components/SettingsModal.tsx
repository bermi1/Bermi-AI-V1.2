import { useEffect, useState } from 'react'
import { Check, KeyRound, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, primaryBtnCls } from './Modal'
import { useTheme, type ThemePreference } from '../lib/theme'
import { clearApiKey, getSettings, saveApiKey } from '../lib/api'
import type { ModelOption, SettingsInfo } from '../lib/types'

interface SettingsModalProps {
  onClose: () => void
  models: ModelOption[]
  selectedModel: string
  onSelectModel: (id: string) => void
}

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function SettingsModal({
  onClose,
  models,
  selectedModel,
  onSelectModel,
}: SettingsModalProps) {
  const { preference, setPreference } = useTheme()
  const [info, setInfo] = useState<SettingsInfo | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(setInfo).catch(() => setInfo(null))
  }, [])

  const submitKey = async () => {
    if (!keyInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      const next = await saveApiKey(keyInput.trim())
      setInfo(next)
      setKeyInput('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const removeKey = async () => {
    try {
      setInfo(await clearApiKey())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal title="Settings" subtitle="Profile, appearance, and model configuration" onClose={onClose}>
      <div className="space-y-6">
        {/* Profile */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Profile
          </h3>
          <div className="flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-base font-semibold text-primary">
              U
            </div>
            <div>
              <div className="text-sm font-medium">You</div>
              <div className="text-xs text-ink-faint">Local workspace</div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Appearance
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setPreference(value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[13px] font-medium transition-colors ${
                  preference === value
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-edge text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Default model */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Default model
          </h3>
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className={inputCls}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </section>

        {/* API key */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            OpenRouter API key
          </h3>
          <p className="mb-2.5 text-[13px] text-ink-muted">
            Stored server-side only — the key is never sent to the browser. An{' '}
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">
              OPENROUTER_API_KEY
            </code>{' '}
            environment variable on the server works too.
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
                  onClick={removeKey}
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
        </section>

        <div className="flex justify-end border-t border-edge pt-4">
          <button onClick={onClose} className={ghostBtnCls}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
