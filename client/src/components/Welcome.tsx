import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { BermiMark } from './Logo'

// The front door: a short, swipeable intro. Few words, one idea per slide,
// all visuals drawn here (no images to load). Honours reduced-motion by not
// auto-advancing.

const SLIDES: { title: ReactNode; line: string; art: () => ReactNode }[] = [
  { title: <>Your life,<br />better organized.</>, line: 'Your potential, better supported.', art: ArtLogo },
  { title: 'Plan your day', line: 'One calm timeline for everything.', art: ArtDay },
  { title: 'Learn every day', line: 'Audiobooks, notes and focus beats.', art: ArtLearn },
  { title: 'Spend with a plan', line: 'Budgets and savings goals you control.', art: ArtMoney },
  { title: 'Look after you', line: 'Mood, breathing and habits. Private.', art: ArtCalm },
]

function ArtLogo() {
  return (
    <div className="relative grid h-[220px] w-[220px] place-items-center">
      <span aria-hidden className="absolute inset-0 rounded-full border border-white/15" style={{ animation: 'welcome-spin 24s linear infinite' }}>
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_6px_rgb(255_255_255/0.5)]" />
      </span>
      <span aria-hidden className="absolute inset-6 rounded-full border border-white/10" />
      <span aria-hidden className="absolute inset-10 rounded-full bg-white/10 blur-2xl" style={{ animation: 'welcome-pulse 5s ease-in-out infinite' }} />
      <BermiMark size={116} className="relative text-white drop-shadow-[0_10px_30px_rgba(255,255,255,0.35)]" />
    </div>
  )
}

function ArtDay() {
  const rows = [['08:00', 'Statistics lecture', 82], ['11:30', 'Study group', 58], ['14:00', 'Focus: chapter 3', 70]] as const
  return (
    <div className="w-[270px] space-y-2.5" style={{ animation: 'welcome-float 6s ease-in-out infinite' }}>
      {rows.map(([t, n, w], i) => (
        <div key={t} className="tile-glass flex items-center gap-3 px-4 py-3.5" style={{ transform: `translateX(${i % 2 ? 14 : -10}px)` }}>
          <span className="text-[12px] tabular-nums text-white/60">{t}</span>
          <span className="flex-1 text-[14px] font-medium">{n}</span>
          <span aria-hidden className="h-1.5 rounded-full bg-white/80" style={{ width: w * 0.35 }} />
        </div>
      ))}
    </div>
  )
}

function ArtLearn() {
  const covers = [['#0E8F6B', '#0A3D3A', -12, -66], ['#F2682A', '#7A1D5C', 0, 0], ['#3D6BFF', '#16206B', 12, 66]] as const
  return (
    <div className="relative h-[230px] w-[290px]" style={{ animation: 'welcome-float 7s ease-in-out infinite' }}>
      {covers.map(([a, b, r, x], i) => (
        <div key={i} aria-hidden className="absolute left-1/2 top-3 h-[200px] w-[140px] overflow-hidden rounded-xl shadow-[0_24px_40px_-14px_rgba(0,0,0,0.7)]" style={{ background: `linear-gradient(155deg, ${a}, ${b})`, transform: `translateX(calc(-50% + ${x}px)) rotate(${r}deg)`, zIndex: i === 1 ? 2 : 1 }}>
          <svg viewBox="0 0 140 200" className="h-full w-full" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="2">{[24, 46, 68].map((r2) => <circle key={r2} cx="105" cy="48" r={r2} />)}</svg>
          <span className="absolute inset-x-3 bottom-4 h-2 w-16 rounded-full bg-white/70" />
          <span className="absolute inset-x-3 bottom-8 h-2 w-24 rounded-full bg-white/40" />
        </div>
      ))}
    </div>
  )
}

function ArtMoney() {
  const r = 92, c = 110
  const arc = (f: number) => { const a = Math.PI * (1 - f); return `${c + r * Math.cos(a)} ${112 - r * Math.sin(a)}` }
  return (
    <div className="relative w-[260px]" style={{ animation: 'welcome-float 6.5s ease-in-out infinite' }}>
      <svg viewBox="0 0 220 124" className="w-full" aria-hidden>
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`} fill="none" stroke="rgb(255 255 255 / .18)" strokeWidth="14" strokeLinecap="round" />
        <path d={`M ${arc(0)} A ${r} ${r} 0 1 1 ${arc(0.72)}`} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
        <circle cx={arc(0.72).split(' ')[0]} cy={arc(0.72).split(' ')[1]} r="9" fill="#fff" stroke="rgb(0 0 0 / .25)" strokeWidth="3" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center"><p className="text-[34px] font-semibold leading-none">72%</p><p className="mt-1 text-[12px] text-white/65">of the way there</p></div>
      <div className="tile-glass mx-auto mt-5 w-fit px-4 py-2 text-[13px]">Save TZS 40,000 by Friday</div>
    </div>
  )
}

function ArtCalm() {
  return (
    <div className="relative grid h-[230px] w-[230px] place-items-center">
      <span aria-hidden className="absolute inset-0 rounded-full border border-white/15" />
      <span aria-hidden className="absolute inset-8 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, rgb(255 255 255 / .55), rgb(255 255 255 / .1))', boxShadow: '0 0 60px rgb(255 255 255 / .25)', animation: 'welcome-pulse 6s ease-in-out infinite' }} />
      <p className="relative text-[15px] font-medium text-white/90">Breathe in…</p>
    </div>
  )
}

export function Welcome({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const [i, setI] = useState(0)
  const [drag, setDrag] = useState(0)
  const [paused, setPaused] = useState(false)
  const start = useRef<number | null>(null)
  const width = useRef(1)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const n = SLIDES.length
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n])

  useEffect(() => {
    if (paused || reduced) return
    const t = setInterval(() => { if (!document.hidden) setI((v) => (v + 1) % n) }, 5200)
    return () => clearInterval(t)
  }, [paused, reduced, n, i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setPaused(true); setI((v) => Math.min(v + 1, n - 1)) }
      if (e.key === 'ArrowLeft') { setPaused(true); setI((v) => Math.max(v - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n])

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    start.current = e.clientX
    width.current = e.currentTarget.getBoundingClientRect().width
    setPaused(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => { if (start.current != null) setDrag(e.clientX - start.current) }
  const up = () => {
    if (start.current == null) return
    const dx = drag
    start.current = null
    setDrag(0)
    if (Math.abs(dx) > Math.min(60, width.current / 5)) setI((v) => Math.max(0, Math.min(n - 1, v + (dx < 0 ? 1 : -1))))
  }

  return (
    <div className="aurora flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5"><BermiMark size={30} className="text-white" /><span className="text-[18px] font-semibold tracking-tight">Bermi</span></div>
        <button onClick={onSignIn} className="min-h-[44px] rounded-full px-4 text-[14px] font-medium text-white/80 hover:text-white">Sign in</button>
      </header>

      <main className="flex flex-1 flex-col justify-center py-6" aria-roledescription="carousel" aria-label="Welcome to Bermi">
        <h1 className="sr-only">Bermi — your life better organized, your potential better supported</h1>
        <div className="touch-pan-y select-none overflow-hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="flex" style={{ transform: `translateX(calc(${-i * 100}% + ${drag}px))`, transition: start.current != null ? 'none' : 'transform 650ms cubic-bezier(.22,1,.36,1)' }}>
            {SLIDES.map((s, k) => (
              <section key={k} aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} aria-hidden={k !== i} className="flex w-full shrink-0 flex-col items-center px-8 text-center">
                <div className="grid h-[290px] place-items-center">{s.art()}</div>
                <h2 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">{s.title}</h2>
                <p className="mt-2.5 max-w-[300px] text-[15.5px] text-white/70">{s.line}</p>
              </section>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="Slides">
          {SLIDES.map((_, k) => (
            <button key={k} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => { setPaused(true); go(k) }} className="grid h-6 place-items-center px-0.5">
              <span className={`block h-1.5 rounded-full transition-all duration-500 ${k === i ? 'w-7 bg-white' : 'w-1.5 bg-white/35'}`} />
            </button>
          ))}
        </div>
      </main>

      <footer className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
          <button onClick={onGetStarted} className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-[#0B1020] shadow-[0_14px_34px_-10px_rgba(255,255,255,0.45)] transition-transform active:scale-[0.98]">
            Get started <ArrowRight size={18} />
          </button>
          <button onClick={onSignIn} className="min-h-[44px] text-[14px] text-white/70 hover:text-white">I already have an account</button>
        </div>
      </footer>
    </div>
  )
}
