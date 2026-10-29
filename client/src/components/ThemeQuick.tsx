import { Moon, Monitor, Sun } from 'lucide-react'
import { ACCENTS, ACCENT_META, useTheme, type ThemePreference } from '../lib/theme'

/** One-tap colour and light/dark switching (the full options live in Settings). */
export function ThemeQuick() {
  const { prefs, setPrefs } = useTheme()
  const modes: { v: ThemePreference; icon: typeof Sun; label: string }[] = [
    { v: 'light', icon: Sun, label: 'Light' },
    { v: 'dark', icon: Moon, label: 'Dark' },
    { v: 'system', icon: Monitor, label: 'Auto' },
  ]
  return (
    <div className="mb-3 rounded-2xl bg-surface-sunken p-3.5">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Colour</p>
      <div role="radiogroup" aria-label="Colour theme" className="flex flex-wrap items-center gap-2.5">
        {ACCENTS.map((a) => (
          <button
            key={a}
            role="radio"
            aria-checked={prefs.accent === a}
            aria-label={ACCENT_META[a].label}
            title={ACCENT_META[a].label}
            onClick={() => setPrefs({ accent: a, icon: a })}
            className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-[var(--surface-sunken)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${prefs.accent === a ? 'ring-2 ring-primary' : ''}`}
            style={{ background: `linear-gradient(145deg, ${ACCENT_META[a].from}, ${ACCENT_META[a].to})` }}
          />
        ))}
        <label
          title="Any colour"
          className={`relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full ring-offset-2 ring-offset-[var(--surface-sunken)] focus-within:outline focus-within:outline-2 focus-within:outline-primary ${prefs.accent === 'custom' ? 'ring-2 ring-primary' : ''}`}
          style={{ background: prefs.accent === 'custom' ? prefs.custom : 'conic-gradient(#ff5a5a, #ffc94d, #4ddb8c, #4db5ff, #a06bff, #ff5a5a)' }}
        >
          <span className="sr-only">Pick any colour</span>
          <input type="color" value={prefs.custom} onChange={(e) => setPrefs({ accent: 'custom', custom: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
      <div role="radiogroup" aria-label="Appearance" className="mt-3 grid grid-cols-3 gap-1.5 rounded-full bg-surface-raised p-1">
        {modes.map(({ v, icon: Icon, label }) => (
          <button key={v} role="radio" aria-checked={prefs.mode === v} onClick={() => setPrefs({ mode: v })} className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-full text-[13px] font-medium ${prefs.mode === v ? 'bg-primary text-on-primary' : 'text-ink-muted'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </div>
  )
}
