import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as api from './api'

// Appearance ("light/dark/system") and theme (the five brand palettes) are
// independent preferences. The palettes themselves live in index.css as
// attribute-scoped CSS variables; this module only decides WHICH attributes
// are set on <html> — so the same CSS powers live previews on any element.

export type ThemePreference = 'light' | 'dark' | 'system'
export const ACCENTS = ['blue', 'orange', 'rose', 'violet', 'teal'] as const
export type Accent = (typeof ACCENTS)[number]

export const ACCENT_META: Record<Accent, { label: string; mood: string; icon: string }> = {
  blue: { label: 'Bermi Blue', mood: 'Focused and trustworthy', icon: '#3159EA' },
  orange: { label: 'Sunset Orange', mood: 'Energetic and motivating', icon: '#E25A12' },
  rose: { label: 'Rose Pink', mood: 'Warm and expressive', icon: '#D6336C' },
  violet: { label: 'Royal Violet', mood: 'Creative and elegant', icon: '#6741D9' },
  teal: { label: 'Emerald Teal', mood: 'Calm and balanced', icon: '#0F8F88' },
}

export interface Prefs {
  mode: ThemePreference
  accent: Accent
  icon: Accent
  density: 'comfortable' | 'compact'
  motion: 'system' | 'reduce'
  textSize: 'default' | 'large' | 'xlarge'
  assistant: 'orb' | 'wave'
  updatedAt: number
}

export const DEFAULT_PREFS: Prefs = {
  mode: 'system',
  accent: 'blue',
  icon: 'blue',
  density: 'comfortable',
  motion: 'system',
  textSize: 'default',
  assistant: 'orb',
  updatedAt: 0,
}

const STORAGE_KEY = 'bermi-prefs'

/** Validates untrusted input (localStorage / server) into a safe Prefs. */
export function sanitizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback
  return {
    mode: pick(r.mode, ['light', 'dark', 'system'] as const, DEFAULT_PREFS.mode),
    accent: pick(r.accent, ACCENTS, DEFAULT_PREFS.accent),
    icon: pick(r.icon, ACCENTS, DEFAULT_PREFS.icon),
    density: pick(r.density, ['comfortable', 'compact'] as const, DEFAULT_PREFS.density),
    motion: pick(r.motion, ['system', 'reduce'] as const, DEFAULT_PREFS.motion),
    textSize: pick(r.textSize, ['default', 'large', 'xlarge'] as const, DEFAULT_PREFS.textSize),
    assistant: pick(r.assistant, ['orb', 'wave'] as const, DEFAULT_PREFS.assistant),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  }
}

function loadLocal(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitizePrefs(JSON.parse(raw))
    // Migrate the pre-themes single "bermi-theme" key.
    const legacy = localStorage.getItem('bermi-theme')
    if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
      return { ...DEFAULT_PREFS, mode: legacy }
    }
  } catch {
    /* storage blocked — fall through to defaults */
  }
  return DEFAULT_PREFS
}

function resolveMode(mode: ThemePreference): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export type SaveState = 'local' | 'saving' | 'saved' | 'error'

interface ThemeContextValue {
  prefs: Prefs
  /** Legacy API: the light/dark/system choice. */
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (p: ThemePreference) => void
  setPrefs: (patch: Partial<Prefs>) => void
  /** Apply preferences that came from the server (does not echo back). */
  applyRemote: (p: Prefs) => void
  saveState: SaveState
  setSaveState: (s: SaveState) => void
  /** Reduced motion is in effect (user choice OR OS setting). */
  reducedMotion: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Mirrors the favicon to the chosen icon colour — in-app only. */
function setFavicon(accent: Accent) {
  const fill = ACCENT_META[accent].icon
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="118" fill="${fill}"/>` +
    `<g fill="#fff"><rect x="143" y="61" width="72" height="256" rx="36"/><path fill-rule="evenodd" d="M286 164a143 143 0 1 0 0 286a143 143 0 0 0 0-286zm0 71a72 72 0 1 1 0 144a72 72 0 0 1 0-144z"/></g></svg>`
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(loadLocal)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveMode(prefs.mode))
  const [saveState, setSaveState] = useState<SaveState>('local')
  const [osReduced, setOsReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setOsReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      localStorage.setItem('bermi-theme', prefs.mode) // keep legacy readers working
    } catch {
      /* ignore */
    }
    setResolved(resolveMode(prefs.mode))
    if (prefs.mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(resolveMode('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs])

  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = resolved
    el.dataset.accent = prefs.accent
    el.dataset.density = prefs.density
    el.dataset.motion = prefs.motion
    el.dataset.text = prefs.textSize
    setFavicon(prefs.icon)
    // Browser chrome / status bar follows the surface colour of the theme.
    requestAnimationFrame(() => {
      const surface = getComputedStyle(el).getPropertyValue('--surface').trim()
      if (surface) {
        document
          .querySelectorAll('meta[name="theme-color"]')
          .forEach((m) => m.setAttribute('content', surface))
      }
    })
  }, [resolved, prefs.accent, prefs.density, prefs.motion, prefs.textSize, prefs.icon])

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((cur) => sanitizePrefs({ ...cur, ...patch, updatedAt: Date.now() }))
    setSaveState('saving')
  }, [])

  const applyRemote = useCallback((p: Prefs) => setPrefsState(sanitizePrefs(p)), [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      prefs,
      preference: prefs.mode,
      resolved,
      setPreference: (mode) => setPrefs({ mode }),
      setPrefs,
      applyRemote,
      saveState,
      setSaveState,
      reducedMotion: prefs.motion === 'reduce' || osReduced,
    }),
    [prefs, resolved, setPrefs, applyRemote, saveState, osReduced],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** Non-throwing variant for components that can render outside the provider
 * (e.g. the build-time prerender of the marketing pages). */
export function useOptionalTheme() {
  return useContext(ThemeContext)
}

/**
 * Mounted once inside the authenticated app. On sign-in it reconciles local
 * and account preferences (newest wins) so a theme chosen on one device
 * follows the user to another; afterwards it saves changes, debounced. The
 * save state is surfaced in Settings so we never claim a failed save worked.
 */
export function PrefsSync() {
  const { prefs, applyRemote, setSaveState } = useTheme()
  const ready = useRef(false)
  const lastSent = useRef(0)
  const latest = useRef(prefs)
  latest.current = prefs

  useEffect(() => {
    let cancelled = false
    api
      .getPrefs()
      .then((remote) => {
        if (cancelled) return
        const server = remote ? sanitizePrefs(remote) : null
        if (server && server.updatedAt >= latest.current.updatedAt) {
          lastSent.current = server.updatedAt // already on the server — don't echo it back
          applyRemote(server)
          setSaveState('saved')
        } else if (latest.current.updatedAt > 0) {
          // Local is newer (or the account has none yet) — push it up.
          api
            .savePrefs(latest.current)
            .then(() => setSaveState('saved'))
            .catch(() => setSaveState('error'))
        } else {
          setSaveState('saved')
        }
      })
      .catch(() => setSaveState('error'))
      .finally(() => {
        ready.current = true
      })
    return () => {
      cancelled = true
    }
  }, [applyRemote, setSaveState])

  useEffect(() => {
    if (!ready.current || prefs.updatedAt === 0 || prefs.updatedAt === lastSent.current) return
    const t = setTimeout(() => {
      lastSent.current = prefs.updatedAt
      api
        .savePrefs(prefs)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 600)
    return () => clearTimeout(t)
  }, [prefs, setSaveState])

  return null
}
