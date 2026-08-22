import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { BermiMark } from '../components/Logo'

export type LandingPath = '/' | '/pricing' | '/faq'

export interface LandingNavProps {
  path: LandingPath
  go: (to: LandingPath) => void
  onSignIn: () => void
  onGetStarted: () => void
}

const NAV_LINKS: { href: LandingPath; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
]

export function LandingNav({ path, go, onSignIn, onGetStarted }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div
        className={`mx-auto flex max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          scrolled
            ? 'border border-white/10 bg-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl'
            : 'border border-transparent bg-transparent'
        }`}
      >
        <button
          onClick={() => go('/')}
          className="flex items-center gap-2"
          aria-label="Bermi AI home"
        >
          <BermiMark size={22} className="text-violet-300" />
          <span className="text-[15px] font-semibold tracking-tight text-white">Bermi AI</span>
        </button>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((l) => (
            <button
              key={l.href}
              onClick={() => go(l.href)}
              className={`rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors ${
                path === l.href ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={onSignIn}
            className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-white/70 transition-colors hover:text-white"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="group flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0a0a12] shadow-[0_0_0_1px_rgba(255,255,255,0.4)] transition-all hover:shadow-[0_0_24px_rgba(167,139,250,0.55)]"
          >
            Get started
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function LandingFooter({ go }: { go: (to: LandingPath) => void }) {
  return (
    <footer className="border-t border-white/10 px-5 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2 text-white/60">
          <BermiMark size={16} className="text-violet-300" />
          <span className="text-[13px]">Bermi AI</span>
        </div>
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((l) => (
            <button
              key={l.href}
              onClick={() => go(l.href)}
              className="text-[12.5px] text-white/50 transition-colors hover:text-white"
            >
              {l.label}
            </button>
          ))}
        </nav>
        <p className="text-[11.5px] leading-relaxed text-white/35">
          &copy; {new Date().getFullYear()} Bermi AI Labs, a subsidiary of Bermi Techs
          Enterprises. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

// A pure client-rendered SPA has no server-side title/meta per route, so
// every page was shipping the exact same generic <title> and description —
// bad for both search ranking (search engines weight title/description
// heavily per-URL) and for how a shared link previews on social apps. This
// updates them on mount for whichever landing page is showing, and restores
// the app's default on unmount so navigating into the signed-in app (which
// doesn't use this hook) isn't left with a stale marketing title.
const DEFAULT_TITLE = 'Bermi AI'
const DEFAULT_DESCRIPTION = 'Bermi AI — your AI workspace: chat, documents, brains, and connectors'

export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const fullTitle = `${title} — Bermi AI`
    document.title = fullTitle
    const meta = document.querySelector('meta[name="description"]')
    const prevDescription = meta?.getAttribute('content') ?? DEFAULT_DESCRIPTION
    meta?.setAttribute('content', description)

    let ogTitle = document.querySelector('meta[property="og:title"]')
    let ogDescription = document.querySelector('meta[property="og:description"]')
    if (!ogTitle) {
      ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitle)
    }
    if (!ogDescription) {
      ogDescription = document.createElement('meta')
      ogDescription.setAttribute('property', 'og:description')
      document.head.appendChild(ogDescription)
    }
    ogTitle.setAttribute('content', fullTitle)
    ogDescription.setAttribute('content', description)

    return () => {
      document.title = DEFAULT_TITLE
      meta?.setAttribute('content', prevDescription)
    }
  }, [title, description])
}

/**
 * Injects a JSON-LD structured-data script for the current page (e.g.
 * FAQPage schema) and removes it on unmount — lets a page like the FAQ
 * qualify for a rich-result snippet directly in Google search, not just a
 * plain blue link.
 */
export function useJsonLd(data: object) {
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)])
}

/** Fades a section in the moment it scrolls into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, visible }
}

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

/** A compact glowing backdrop — orbital ring + beam, scaled down for a smaller hero. */
export function GlowBackdrop({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const ring = size === 'lg' ? 'h-[34rem] w-[34rem] top-[-8rem]' : 'h-[22rem] w-[22rem] top-[-5rem]'
  const glow = size === 'lg' ? 'h-[22rem] w-[22rem] top-[-4rem]' : 'h-[14rem] w-[14rem] top-[-2rem]'
  const beam = size === 'lg' ? 'h-[380px]' : 'h-[220px]'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bermi-star-field opacity-[0.5]" />
      <div className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-white/[0.08] ${ring}`} />
      <div
        className={`bermi-orbit-spin absolute left-1/2 -translate-x-1/2 rounded-full border border-dashed border-white/[0.06] ${ring}`}
      />
      <div className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-violet-600/25 blur-[90px] ${glow}`} />
      <div className="absolute left-1/2 top-8 h-px w-px -translate-x-1/2">
        <div className={`w-[2px] bg-gradient-to-b from-transparent via-violet-300/70 to-transparent ${beam}`} />
      </div>
    </div>
  )
}
