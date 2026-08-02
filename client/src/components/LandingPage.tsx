import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  ChevronDown,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { BermiMark } from './Logo'

interface LandingPageProps {
  onSignIn: () => void
  onGetStarted: () => void
}

const NAV_LINKS = [
  { href: '#capabilities', label: 'Home' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

function NavBar({ onSignIn, onGetStarted }: LandingPageProps) {
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
        <div className="flex items-center gap-2">
          <BermiMark size={22} className="text-violet-300" />
          <span className="text-[15px] font-semibold tracking-tight text-white">Bermi AI</span>
        </div>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-white/60 transition-colors hover:text-white"
            >
              {l.label}
            </a>
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

/** Glowing orbital rings + a beam of light behind the hero headline — no imagery, pure CSS. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bermi-star-field opacity-[0.5]" />
      <div className="absolute left-1/2 top-[-8rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full border border-white/[0.08]" />
      <div className="bermi-orbit-spin absolute left-1/2 top-[-8rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full border border-dashed border-white/[0.06]" />
      <div className="absolute left-1/2 top-[-4rem] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[90px]" />
      <div className="absolute left-1/2 top-8 h-px w-px -translate-x-1/2">
        <div className="h-[380px] w-[2px] bg-gradient-to-b from-transparent via-violet-300/70 to-transparent" />
      </div>
    </div>
  )
}

/** A single, clean product mockup: a glass chat panel with one overlapping stat card. */
function HeroMockup() {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-3xl px-2">
      <div className="bermi-glass rounded-2xl p-3 shadow-[0_30px_80px_-20px_rgba(109,80,255,0.35)] sm:p-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            <BermiMark size={14} className="text-violet-300" />
            <span className="text-[12px] font-medium text-white/60">Bermi AI</span>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 px-1 pb-1">
          <div className="ml-auto w-fit max-w-[80%] rounded-xl rounded-tr-sm bg-violet-500/20 px-3.5 py-2 text-[13px] text-white/90">
            Build me a course on negotiation skills
          </div>
          <div className="w-fit max-w-[85%] rounded-xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2 text-[13px] leading-relaxed text-white/70">
            Done — 6 lessons drafted and you're enrolled. Starting lesson one now…
          </div>
        </div>
      </div>
      <div className="bermi-float absolute -right-3 -top-6 hidden w-44 rounded-2xl p-3.5 bermi-glass sm:block">
        <div className="flex items-center gap-1.5 text-violet-300">
          <BarChart3 size={14} />
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/50">
            Mastery
          </span>
        </div>
        <p className="mt-1 text-[20px] font-semibold text-white">Lesson 3/6</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-violet-400" />
        </div>
      </div>
    </div>
  )
}

const capabilities = [
  {
    icon: Brain,
    title: 'AI chat & documents',
    body: 'Write, research, and get real work done with an assistant that reads what you give it.',
  },
  {
    icon: GraduationCap,
    title: 'Instant course builder',
    body: 'Describe a topic in chat — a full curriculum is drafted and you\'re enrolled immediately.',
  },
  {
    icon: ShieldCheck,
    title: 'Mastery-gated lessons',
    body: 'A quiz gates every lesson, so "done" always means actually understood.',
  },
  {
    icon: Building2,
    title: 'Organization publishing',
    body: 'Institutions list courses, programs, events, and resources under their own catalog.',
  },
  {
    icon: BarChart3,
    title: 'Live learner analytics',
    body: 'Track completions and mastery across every learner, with a CSV export for reporting.',
  },
  {
    icon: Trophy,
    title: 'Gamified Study Mode',
    body: 'XP, streaks, and progress that reflects skill gained — not just clicks.',
  },
]

const faqs = [
  {
    q: 'Is Bermi AI free to use?',
    a: 'Yes — create a free account to chat, build courses, and use Study Mode. You can also try Bermi as a guest for a day without signing up at all.',
  },
  {
    q: 'Can I really build a course just by asking in chat?',
    a: 'Yes. Describe what you want taught and Bermi drafts the lessons, enrolls you, and starts teaching right there in the conversation — no separate builder required.',
  },
  {
    q: 'Can my organization publish its own courses?',
    a: 'Yes. Institution Studio lets you publish courses, programs, events, and resources under your own catalog, then track learner progress and export the data.',
  },
  {
    q: 'What happens to my conversations and content?',
    a: 'Everything you create stays tied to your own account and is never shared with other organizations on Bermi.',
  },
  {
    q: 'When will paid plans be available?',
    a: 'Pricing is on the way — see the note below. Everyone can get started for free in the meantime.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="mx-auto max-w-2xl divide-y divide-white/10 rounded-2xl bermi-glass">
      {faqs.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-[14px] font-medium text-white">{f.q}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-white/60">{f.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LandingPage({ onSignIn, onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-dvh bg-[#07070c] text-white">
      <NavBar onSignIn={onSignIn} onGetStarted={onGetStarted} />

      {/* Hero */}
      <section className="relative isolate px-5 pb-10 pt-16 md:pt-20">
        <HeroBackdrop />
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur">
            <Sparkles size={13} className="text-violet-300" />
            AI chat, meet learning management
          </span>
          <h1 className="mt-6 text-[38px] font-semibold leading-[1.1] tracking-tight md:text-[56px]">
            Learn faster.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent">
              Build smarter.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/60 md:text-[16.5px]">
            One AI workspace that chats, writes, and teaches — for people who want to get things
            done, and organizations that want real courses in front of real learners.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onGetStarted}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[14.5px] font-semibold text-[#0a0a12] shadow-[0_0_30px_rgba(167,139,250,0.25)] transition-all hover:shadow-[0_0_36px_rgba(167,139,250,0.55)] sm:w-auto"
            >
              Get started free
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onSignIn}
              className="w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-[14.5px] font-medium text-white/85 backdrop-blur transition-colors hover:bg-white/[0.08] sm:w-auto"
            >
              Sign in
            </button>
          </div>
        </div>
        <HeroMockup />
      </section>

      {/* Capabilities — single condensed grid */}
      <section id="capabilities" className="mx-auto max-w-5xl px-5 py-16 md:py-20">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-[24px] font-semibold tracking-tight md:text-[28px]">
            A modern learning system, built in
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">
            Everything a training team usually stitches together from three tools — here from day
            one.
          </p>
        </div>
        <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <div
              key={c.title}
              className="group rounded-2xl bermi-glass p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 transition-transform duration-300 group-hover:scale-110">
                <c.icon size={18} />
              </div>
              <h3 className="mt-3.5 text-[14.5px] font-semibold text-white">{c.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — coming soon */}
      <section id="pricing" className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-lg rounded-3xl bermi-glass px-8 py-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-violet-300">
            Pricing
          </span>
          <h2 className="mt-4 text-[22px] font-semibold tracking-tight md:text-[26px]">
            Simple plans are on the way
          </h2>
          <p className="mx-auto mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-white/55">
            We're finalizing pricing for individuals and organizations. Get started for free right
            now — no credit card required.
          </p>
          <button
            onClick={onGetStarted}
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13.5px] font-semibold text-[#0a0a12] transition-all hover:shadow-[0_0_24px_rgba(167,139,250,0.45)]"
          >
            Get started free
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-5 py-16 md:py-20">
        <h2 className="text-center text-[24px] font-semibold tracking-tight md:text-[28px]">
          Frequently asked questions
        </h2>
        <div className="mt-10">
          <Faq />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-5 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2 text-white/60">
            <BermiMark size={16} className="text-violet-300" />
            <span className="text-[13px]">Bermi AI</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-white/35">
            &copy; {new Date().getFullYear()} Bermi AI Labs, a subsidiary of Bermi Techs
            Enterprises. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
