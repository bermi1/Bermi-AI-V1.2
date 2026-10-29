import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, RefreshCw, Settings, WifiOff, X } from 'lucide-react'
import { BermiMark } from '../components/Logo'
import { LifeError } from './api'

// Shared building blocks for the Life OS screens: loading / empty / error
// states, an accessible sheet, toasts, and small SVG charts. Charts always
// carry a text equivalent — colour is never the only signal.

// ------------------------------------------------------------------ data

export const LIFE_CHANGED = 'bermi:life-changed'
export const notifyLifeChanged = () => window.dispatchEvent(new Event(LIFE_CHANGED))

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(
    (silent = false) => {
      const id = ++seq.current
      if (!silent) setLoading(true)
      fn()
        .then((d) => {
          if (id === seq.current) {
            setData(d)
            setError(null)
          }
        })
        .catch((e) => {
          if (id === seq.current) setError(e as Error)
        })
        .finally(() => {
          if (id === seq.current) setLoading(false)
        })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  )
  useEffect(() => {
    run()
  }, [run])
  // Come back online, or the companion changed something → quietly refresh.
  useEffect(() => {
    const on = () => run(true)
    window.addEventListener('online', on)
    window.addEventListener(LIFE_CHANGED, on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener(LIFE_CHANGED, on)
    }
  }, [run])
  return { data, error, loading, reload: run, setData }
}

export function ErrorState({ error, onRetry, compact }: { error: Error; onRetry?: () => void; compact?: boolean }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const notProvisioned = error instanceof LifeError && error.code === 'life_not_provisioned'
  const Icon = offline ? WifiOff : AlertCircle
  const title = offline
    ? "You're offline"
    : notProvisioned
      ? 'This section is being set up'
      : "That didn't load"
  const body = offline
    ? "Reconnect and this will refresh on its own. Anything you've already entered is safe."
    : notProvisioned
      ? "Bermi's storage for this feature isn't switched on yet on this server. Nothing you do here is lost — an administrator just needs to finish setup."
      : error.message
  return (
    <div role="alert" className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-14'}`}>
      <Icon size={22} className="text-ink-faint" aria-hidden />
      <p className="mt-3 text-[14px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{body}</p>
      {onRetry && !notProvisioned && (
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-edge px-3.5 py-2 text-[13px] font-medium hover:bg-surface-sunken">
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="text-[14px] font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-sunken ${className}`} />
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden />
}

// ------------------------------------------------------------------ layout

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-5 pt-1">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Bento tile with a heading. */
export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`tile mb-3 p-4 sm:mb-4 sm:p-5 ${className}`} aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight sm:text-[16px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ------------------------------------------------------------------ hero

interface ShellCtlValue { openAccount: () => void; openChat: () => void }
export const ShellCtl = createContext<ShellCtlValue>({ openAccount: () => {}, openChat: () => {} })

/** Immersive gradient header. On phones it also carries the top bar. */
export function Hero({ kicker, title, children, actions }: { kicker?: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  const ctl = useContext(ShellCtl)
  return (
    <header className="hero -mx-4 -mt-5 mb-3 rounded-b-[1.75rem] px-4 pb-4 pt-[calc(env(safe-area-inset-top)+10px)] md:mx-0 md:mb-4 md:mt-0 md:rounded-[2.25rem] md:px-9 md:pb-8 md:pt-9">
      <div className="mb-3 flex items-center justify-between md:hidden">
        <BermiMark size={28} className="text-white" />
        <div className="flex gap-2">
          <button onClick={ctl.openChat} aria-label="Open full chat" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"><MessageSquare size={17} /></button>
          <button onClick={ctl.openAccount} aria-label="Account and settings" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"><Settings size={17} /></button>
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker && <p className="text-[13px] text-white/70 sm:text-[14px]">{kicker}</p>}
          <h1 className="mt-0.5 text-[25px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[38px]">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** Round glass icon button for use on a hero. */
export const heroBtn = 'grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40'

/** Sub-page switcher for a hero: equal-width segments that always fit on one line. */
export function HeroTabs<T extends string>({ tabs, value, onChange, label, panelId }: { tabs: { id: T; label: string; title?: string }[]; value: T; onChange: (id: T) => void; label: string; panelId?: string }) {
  return (
    <div role="tablist" aria-label={label} className="mt-4 grid grid-flow-col auto-cols-fr gap-0.5 rounded-full bg-white/10 p-1 md:mt-5 md:max-w-xl">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={panelId}
          title={t.title ?? t.label}
          onClick={() => onChange(t.id)}
          className={`min-h-[38px] min-w-0 truncate rounded-full px-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:text-[13.5px] ${value === t.id ? 'bg-white text-[#0B1020] shadow-sm' : 'text-white/75 hover:text-white'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Date pills on a hero: selected = solid white disc. */
export function DayStrip({ days, value, today, onPick }: { days: string[]; value: string; today: string; onPick: (d: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Choose a day" className="scroll-x -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 md:-mx-1 md:mt-4 md:gap-2 md:px-1">
      {days.map((d) => {
        const [y, m, dd] = d.split('-').map(Number)
        const wd = new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short' })
        const on = d === value
        return (
          <button key={d} role="radio" aria-checked={on} onClick={() => onPick(d)} aria-label={`${wd} ${dd}${d === today ? ', today' : ''}`} className="flex shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none">
            <span className={`grid h-[44px] w-[44px] place-items-center rounded-full text-[15px] md:h-[48px] md:w-[48px] md:text-[16px] font-semibold tabular-nums transition-colors ${on ? 'bg-white text-[#0B1020]' : 'bg-white/10 text-white hover:bg-white/20'} ${d === today && !on ? 'ring-1 ring-white/50' : ''}`}>{dd}</span>
            <span className={`text-[11px] ${on ? 'font-semibold text-white' : 'text-white/60'}`}>{wd}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Semicircle gauge (value within [min, max]) with the reading in the middle. */
export function Gauge({ value, min = 0, max = 100, label, children, tone = 'var(--primary)' }: { value: number; min?: number; max?: number; label: string; children?: ReactNode; tone?: string }) {
  const w = 220
  const r = 92
  const cx = w / 2
  const cy = 112
  const frac = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1e-9)))
  const arc = (f: number) => {
    const a = Math.PI * (1 - f)
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy - r * Math.sin(a)).toFixed(2)}`
  }
  const path = (f: number) => `M ${arc(0)} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${arc(f)}`
  return (
    <div className="relative mx-auto w-full max-w-[260px]" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${w} 124`} className="w-full">
        <path d={path(1)} fill="none" stroke="var(--edge-strong)" strokeWidth="12" strokeLinecap="round" opacity=".7" />
        {frac > 0.004 && <path d={path(frac)} fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" />}
        {frac > 0.004 && <circle cx={arc(frac).split(' ')[0]} cy={arc(frac).split(' ')[1]} r="8" fill="#fff" stroke={tone} strokeWidth="4" />}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">{children}</div>
    </div>
  )
}

/** Soft rounded bars (one per label); the highlighted one uses the accent. */
export function BarBlobs({ values, labels, highlight, label, onDark }: { values: number[]; labels: string[]; highlight?: number; label: string; onDark?: boolean }) {
  const max = Math.max(...values, 1)
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-16 items-end gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="flex flex-1 flex-col items-center justify-end self-stretch">
            <span
              className="w-full max-w-[34px] rounded-full"
              style={{
                height: `${Math.max(v ? 14 : 8, (v / max) * 100)}%`,
                background: i === highlight ? (onDark ? '#fff' : 'var(--primary)') : onDark ? 'rgb(255 255 255 / 0.22)' : 'var(--edge-strong)',
                boxShadow: i === highlight ? (onDark ? '0 0 14px rgb(255 255 255 / 0.4)' : '0 0 16px color-mix(in srgb, var(--primary) 50%, transparent)') : undefined,
                opacity: v || i === highlight ? 1 : 0.55,
              }}
            />
          </span>
        ))}
      </div>
      <div className={`mt-1.5 flex gap-1.5 text-center text-[11px] ${onDark ? 'text-white/60' : 'text-ink-muted'}`}>
        {labels.map((l, i) => <span key={i} className={`flex-1 ${i === highlight ? 'font-semibold' : ''}`}>{l}</span>)}
      </div>
    </div>
  )
}

export const btn = {
  primary:
    'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[13.5px] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  soft:
    'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-primary-soft px-4 text-[13.5px] font-semibold text-primary transition-colors hover:brightness-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  ghost:
    'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-edge px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  icon:
    'grid h-10 w-10 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
}

export const field =
  'w-full rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-ink-faint focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25'

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!active}
      onClick={onClick}
      className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
        active ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'bg-surface-sunken text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ sheet

/** Accessible modal: focus moves in, Escape closes, Tab is trapped, focus returns. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
  side,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
  side?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []).filter(
        (n) => !n.hasAttribute('disabled') && n.offsetParent !== null,
      )
    ;(focusables()[0] ?? el)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={`fixed inset-0 z-50 flex ${side ? 'items-stretch justify-end' : 'items-end justify-center sm:items-center'} bg-black/45 backdrop-blur-[2px]`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`animate-sheet-in flex w-full flex-col overflow-hidden bg-surface-raised shadow-2xl outline-none ${
          side
            ? 'max-w-[460px] sm:rounded-l-3xl max-sm:rounded-t-3xl max-sm:mt-12'
            : `max-h-[92dvh] rounded-t-3xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`
        }`}
      >
        <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className={btn.icon} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ toast

interface ToastItem { id: number; text: string; tone: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((cur) => [...cur.slice(-2), { id, text, tone }])
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} role="status" className="animate-fade-up pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-[13px] font-medium text-surface shadow-lg">
            {t.tone === 'ok' ? <CheckCircle2 size={15} aria-hidden /> : <AlertCircle size={15} aria-hidden />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ------------------------------------------------------------------ charts

export const sr = 'sr-only'

/** Progress ring. `label` is the text equivalent announced to screen readers. */
export function Ring({ value, size = 56, stroke = 6, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-[12px] font-semibold tabular-nums">{children}</div>}
    </div>
  )
}

const SERIES = ['var(--primary)', '#16A779', '#E9A23B', '#D94B61', '#8B6CF0', '#2BB5C8', '#9AA5B8', '#C27A2C']
export const seriesColor = (i: number) => SERIES[i % SERIES.length]

/** Allocation donut with a text list underneath (never colour-only). */
export function Donut({ parts, size = 148, centre, format }: { parts: { label: string; value: number }[]; size?: number; centre?: ReactNode; format: (n: number) => string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  const stroke = 18
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" role="img" aria-label={`Spending allocation: ${parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
          {total > 0 &&
            parts.map((p, i) => {
              const len = (p.value / total) * c
              const el = (
                <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seriesColor(i)} strokeWidth={stroke} strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-acc} />
              )
              acc += len
              return el
            })}
        </svg>
        {centre && <div className="absolute inset-0 grid place-items-center text-center">{centre}</div>}
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seriesColor(i) }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-muted">
              {format(p.value)}
              {total > 0 && <span className="ml-1.5 text-ink-faint">{Math.round((p.value / total) * 100)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Small trend line with first/last values stated in text. */
export function Sparkline({ points, label, height = 40, onDark }: { points: (number | null)[]; label: string; height?: number; onDark?: boolean }) {
  const stroke = onDark ? '#fff' : 'var(--primary)'
  const w = 240
  const valid = points.map((p, i) => (p == null ? null : ([i, p] as const))).filter(Boolean) as (readonly [number, number])[]
  if (valid.length < 2) return null
  const max = Math.max(...valid.map((v) => v[1]), 1)
  const min = Math.min(...valid.map((v) => v[1]), 0)
  const x = (i: number) => (i / Math.max(points.length - 1, 1)) * w
  const y = (v: number) => height - 4 - ((v - min) / Math.max(max - min, 1)) * (height - 8)
  const d = valid.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-10 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {valid.map(([i, v]) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={stroke} />
      ))}
    </svg>
  )
}

// ------------------------------------------------------------------ format

export const fmtMoney = (n: number, currency = 'TZS') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`
  }
}
export const fmtCompact = (n: number, currency = 'TZS') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n)
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`
  }
}
export const fmtDateLong = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}
export const fmtDateShort = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}
