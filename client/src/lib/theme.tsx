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
export type AccentChoice = Accent | 'custom'

import { freeMarkSvg } from './brand'
import { CUSTOM_VARS, customTokens, isHex } from './customTheme'

export const ACCENT_META: Record<Accent, { label: string; mood: string; icon: string; from: string; to: string }> = {
  blue: { label: 'Bermi Blue', mood: 'Focused and trustworthy', icon: '#3159EA', from: '#7C97FF', to: '#2340C6' },
  orange: { label: 'Sunset Orange', mood: 'Energetic and motivating', icon: '#E25A12', from: '#FFA05C', to: '#D1450A' },
  rose: { label: 'Rose Pink', mood: 'Warm and expressive', icon: '#D6336C', from: '#FF7AA6', to: '#B71C54' },
  violet: { label: 'Royal Violet', mood: 'Creative and elegant', icon: '#6741D9', from: '#A184FF', to: '#512EC0' },
  teal: { label: 'Emerald Teal', mood: 'Calm and balanced', icon: '#0F8F88', from: '#35CDBE', to: '#0A7872' },
}

export interface Prefs {
  mode: ThemePreference
  accent: AccentChoice
  /** Used when accent is 'custom'. */
  custom: string
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
  custom: '#7A3FF2',
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
    accent: pick<AccentChoice>(r.accent, [...ACCENTS, 'custom'], DEFAULT_PREFS.accent),
    custom: isHex(r.custom) ? r.custom.toLowerCase() : DEFAULT_PREFS.custom,
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
  const m = ACCENT_META[accent]
  const svg = freeMarkSvg(m.from, m.icon)
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
    // "Any colour": computed tokens go inline; presets clear them.
    if (prefs.accent === 'custom') {
      const vars = customTokens(prefs.custom, resolved)
      for (const k of CUSTOM_VARS) el.style.setProperty(k, vars[k])
      try {
        localStorage.setItem('bermi-custom-vars', JSON.stringify({ light: customTokens(prefs.custom, 'light'), dark: customTokens(prefs.custom, 'dark') }))
      } catch {
        /* ignore */
      }
    } else {
      for (const k of CUSTOM_VARS) el.style.removeProperty(k)
    }
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
  }, [resolved, prefs.accent, prefs.custom, prefs.density, prefs.motion, prefs.textSize, prefs.icon])

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
