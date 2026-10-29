import { Check, Monitor, Moon, Sun } from 'lucide-react'
import {
  ACCENTS,
  ACCENT_META,
  useTheme,
  type Accent,
  type Prefs,
  type ThemePreference,
} from '../lib/theme'
import { BermiTile } from './Logo'

// Appearance & personalisation. Every theme card renders a tiny live mock of
// the product using the REAL design tokens (the card itself carries
// data-accent/data-theme, so the same CSS that themes the app themes the
// preview) — what you see is exactly what you get.

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      {hint && <p className="mt-0.5 text-[12.5px] text-ink-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; icon?: React.ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-edge bg-surface-sunken p-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
              on ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** One half of a theme card: a miniature app surface in a given mode. */
function MiniPreview({ accent, mode }: { accent: Accent; mode: 'light' | 'dark' }) {
  return (
    <div
      data-accent={accent}
      data-theme={mode}
      aria-hidden
      className="flex-1 overflow-hidden bg-surface p-2.5 text-ink"
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="h-1.5 w-10 rounded-full bg-ink" />
      </div>
      <div className="mt-2 rounded-md border border-edge bg-surface-raised p-1.5">
        <div className="h-1 w-12 rounded-full bg-ink-muted" />
        <div className="mt-1.5 flex items-center gap-1.5">
          <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 -rotate-90">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="var(--edge-strong)" strokeWidth="3" />
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray="47" strokeDashoffset="15" />
          </svg>
          <div className="h-1 flex-1 rounded-full bg-primary-soft" />
        </div>
      </div>
      <div className="mt-2 flex gap-1">
        <span className="rounded bg-primary px-1.5 py-[2px] text-[7px] font-semibold leading-none text-on-primary">Plan</span>
        <span className="rounded bg-primary-soft px-1.5 py-[2px] text-[7px] font-semibold leading-none text-primary">Study</span>
      </div>
    </div>
  )
}

function ThemeCard({ accent, selected, onSelect }: { accent: Accent; selected: boolean; onSelect: () => void }) {
  const meta = ACCENT_META[accent]
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={`${meta.label} — ${meta.mood}`}
      className={`group overflow-hidden rounded-2xl border text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-edge hover:border-edge-strong'
      }`}
    >
      <div className="flex h-[92px] divide-x divide-edge border-b border-edge">
        <MiniPreview accent={accent} mode="light" />
        <MiniPreview accent={accent} mode="dark" />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{meta.label}</div>
          <div className="truncate text-[11.5px] text-ink-muted">{meta.mood}</div>
        </div>
        {selected && (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  )
}

export function AppearanceSettings() {
  const { prefs, setPrefs, saveState } = useTheme()
  const set = (patch: Partial<Prefs>) => setPrefs(patch)

  const status =
    saveState === 'saved'
      ? 'Saved to your account — it will follow you to other devices.'
      : saveState === 'saving'
        ? 'Saving…'
        : saveState === 'error'
          ? "Saved on this device only — we couldn't reach your account. It will sync next time you're online."
          : 'Saved on this device.'

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[17px] font-semibold tracking-tight">Appearance</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Make Bermi yours. Changes apply instantly.</p>
      </div>

      <Section title="Mode" hint="Light, dark, or follow your device. This is separate from your colour theme.">
        <Segmented<ThemePreference>
          label="Appearance mode"
          value={prefs.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'light', label: 'Light', icon: <Sun size={14} /> },
            { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
            { value: 'system', label: 'System', icon: <Monitor size={14} /> },
          ]}
        />
      </Section>

      <Section title="Colour theme" hint="Each theme is designed for both light and dark. Previews show both.">
        <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCENTS.map((a) => (
            <ThemeCard key={a} accent={a} selected={prefs.accent === a} onSelect={() => set({ accent: a })} />
          ))}
        </div>
      </Section>

      <Section
        title="App icon"
        hint="Changes the Bermi icon inside the app and in your browser tab. Your phone's home-screen icon is set by your device when you install Bermi, so it won't change."
      >
        <div role="radiogroup" aria-label="App icon" className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const on = prefs.icon === a
            return (
              <button
                key={a}
                role="radio"
                aria-checked={on}
                aria-label={`${ACCENT_META[a].label} icon`}
                onClick={() => set({ icon: a })}
                className={`relative rounded-2xl p-1.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  on ? 'bg-primary-soft ring-2 ring-primary' : 'hover:bg-surface-sunken'
                }`}
              >
                <BermiTile size={52} accent={a} className="rounded-[14px]" />
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Assistant" hint="How your assistant looks while it listens and thinks.">
        <Segmented
          label="Assistant style"
          value={prefs.assistant}
          onChange={(assistant) => set({ assistant })}
          options={[
            { value: 'orb', label: 'Orb' },
            { value: 'wave', label: 'Waveform' },
          ]}
        />
      </Section>

      <Section title="Accessibility & comfort">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Text size</div>
            <Segmented
              label="Text size"
              value={prefs.textSize}
              onChange={(textSize) => set({ textSize })}
              options={[
                { value: 'default', label: 'Default' },
                { value: 'large', label: 'Large' },
                { value: 'xlarge', label: 'Extra large' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Motion</div>
            <Segmented
              label="Motion"
              value={prefs.motion}
              onChange={(motion) => set({ motion })}
              options={[
                { value: 'system', label: 'Follow device' },
                { value: 'reduce', label: 'Reduce motion' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Layout density</div>
            <Segmented
              label="Layout density"
              value={prefs.density}
              onChange={(density) => set({ density })}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>
        </div>
      </Section>

      <p
        role="status"
        className={`text-[12.5px] ${saveState === 'error' ? 'text-[#D94B61]' : 'text-ink-muted'}`}
      >
        {status}
      </p>
    </div>
  )
}
