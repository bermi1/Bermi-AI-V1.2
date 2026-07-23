import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// ---------- Routing (pathname-based, scoped under /learn) ----------

export type LearnRoute =
  | { name: 'landing' }
  | { name: 'institution'; slug: string }
  | { name: 'course'; id: string }
  | { name: 'study'; courseId: string; lessonId: string }
  | { name: 'mylearning' }
  | { name: 'studio' }
  | { name: 'certificate'; code: string }

export function parseLearnRoute(pathname: string): LearnRoute {
  const rest = pathname.replace(/^\/(portal|learn)\/?/, '').replace(/\/+$/, '')
  const parts = rest ? rest.split('/') : []
  if (parts.length === 0) return { name: 'landing' }
  if (parts[0] === 'me') return { name: 'mylearning' }
  if (parts[0] === 'studio') return { name: 'studio' }
  if (parts[0] === 'i' && parts[1]) return { name: 'institution', slug: parts[1] }
  if (parts[0] === 'cert' && parts[1]) return { name: 'certificate', code: parts[1] }
  if (parts[0] === 'c' && parts[1]) {
    if (parts[2] === 'lesson' && parts[3])
      return { name: 'study', courseId: parts[1], lessonId: parts[3] }
    return { name: 'course', id: parts[1] }
  }
  return { name: 'landing' }
}

export function routeToPath(route: LearnRoute): string {
  switch (route.name) {
    case 'landing':
      return '/portal'
    case 'mylearning':
      return '/portal/me'
    case 'studio':
      return '/portal/studio'
    case 'institution':
      return `/portal/i/${route.slug}`
    case 'course':
      return `/portal/c/${route.id}`
    case 'study':
      return `/portal/c/${route.courseId}/lesson/${route.lessonId}`
    case 'certificate':
      return `/portal/cert/${route.code}`
  }
}

// ---------- Small UI primitives ----------

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-faint">
      <Loader2 size={22} className="animate-spin" />
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Btn({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-[14px]'
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    ghost: 'text-ink-muted hover:bg-surface-sunken',
    outline: 'border border-edge-strong text-ink hover:bg-surface-sunken',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }[variant]
  return (
    <button
      className={`${base} ${sizes} ${variants} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-semibold text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-faint">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-edge bg-surface-raised px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-primary'

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' | 'amber' | 'primary' }) {
  const tones = {
    muted: 'bg-surface-sunken text-ink-muted',
    green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
    primary: 'bg-primary-soft text-primary',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tones}`}>
      {children}
    </span>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-[13px] text-rose-600 dark:text-rose-400">
      {children}
    </div>
  )
}

// Hand a lesson/course off to Bermi AI's Study Mode. The portal is the B2B
// console; the actual learning happens in the main app. We stash the context
// and do a full navigation to '/', where the workspace picks it up on mount.
export function handoffToStudy(payload: { title: string; prompt: string }) {
  try {
    localStorage.setItem('bermi-study-handoff', JSON.stringify(payload))
  } catch {
    /* quota — ignore */
  }
  window.location.assign('/')
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-edge px-6 py-16 text-center">
      <div className="text-ink-faint">{icon}</div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-sm text-[13px] text-ink-muted">{body}</p>}
    </div>
  )
}
