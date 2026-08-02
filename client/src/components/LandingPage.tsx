import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  FileText,
  Gauge,
  GraduationCap,
  Layers,
  Library,
  Mic,
  Rocket,
  Sparkles,
  Trophy,
  Users,
  Video,
} from 'lucide-react'
import { BermiMark } from './Logo'

interface LandingPageProps {
  onSignIn: () => void
  onGetStarted: () => void
}

/** Fades a section in the moment it scrolls into view; no-ops until then. */
function useReveal<T extends HTMLElement>() {
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

function Reveal({
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

function NavBar({ onSignIn, onGetStarted }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled ? 'border-b border-edge bg-surface/85 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
        <div className="flex items-center gap-2">
          <BermiMark size={26} className="text-primary" />
          <span className="font-serif text-[17px] font-medium tracking-tight">Bermi AI</span>
        </div>
        <div className="flex items-center gap-2.5 md:gap-3">
          <button
            onClick={onSignIn}
            className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="group flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13.5px] font-medium text-white shadow-sm transition-all hover:bg-primary-hover hover:shadow-md"
          >
            Get started
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  )
}

/** Soft drifting gradient blobs + a faint dotted "network" field behind the hero. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bermi-dot-field opacity-[0.35] dark:opacity-[0.18]" />
      <div className="bermi-blob absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-3xl" />
      <div
        className="bermi-blob absolute -right-20 top-10 h-[22rem] w-[22rem] rounded-full bg-primary/10 blur-3xl"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="bermi-blob absolute bottom-[-8rem] left-1/3 h-[20rem] w-[20rem] rounded-full bg-primary/15 blur-3xl"
        style={{ animationDelay: '-3s' }}
      />
    </div>
  )
}

/** A small floating illustrative mockup: chat, a course card, a stats card. */
function HeroIllustration() {
  return (
    <div className="relative mx-auto mt-14 h-[280px] w-full max-w-2xl sm:h-[320px]">
      {/* Centering (-translate-x-1/2) and the floating animation both drive
          `transform`, so they must live on separate elements — otherwise the
          keyframe's translateY silently replaces the centering translateX,
          shifting this card off to the right and overflowing the viewport. */}
      <div className="absolute left-1/2 top-0 w-[78%] -translate-x-1/2">
        <div className="bermi-float rounded-2xl border border-edge bg-surface-raised p-4 text-left shadow-lg">
          <div className="flex items-center gap-2 border-b border-edge pb-2.5">
            <BermiMark size={16} className="text-primary" />
            <span className="text-[12px] font-medium text-ink-muted">Bermi AI</span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="ml-auto w-fit rounded-lg rounded-tr-sm bg-primary-soft px-3 py-1.5 text-[12px] text-ink">
              Build me a course on negotiation skills
            </div>
            <div className="w-fit max-w-[85%] rounded-lg rounded-tl-sm bg-surface-sunken px-3 py-1.5 text-[12px] leading-relaxed text-ink-muted">
              Done — 6 lessons drafted and you're enrolled. Starting lesson one now…
            </div>
          </div>
        </div>
      </div>
      <div
        className="bermi-float absolute left-0 bottom-4 w-40 rounded-2xl border border-edge bg-surface-raised p-3.5 text-left shadow-lg sm:-left-4 sm:w-52"
        style={{ animationDelay: '-2.4s' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <GraduationCap size={16} />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink">Negotiation Skills</p>
            <p className="text-[11px] text-ink-faint">Lesson 3 of 6 · mastered</p>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full w-1/2 rounded-full bg-primary" />
        </div>
      </div>
      <div
        className="bermi-float absolute right-0 bottom-10 w-36 rounded-2xl border border-edge bg-surface-raised p-3.5 text-left shadow-lg sm:right-6 sm:w-44"
        style={{ animationDelay: '-4.8s' }}
      >
        <div className="flex items-center gap-1.5 text-primary">
          <BarChart3 size={15} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Learners
          </span>
        </div>
        <p className="mt-1.5 font-serif text-[22px] font-medium text-ink">1,204</p>
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">+18% this month</p>
      </div>
    </div>
  )
}

const pillars = [
  {
    icon: Brain,
    title: 'Chat & create',
    body: 'A capable AI assistant for writing, research, documents, and your own custom AI "brains" trained on what you do.',
  },
  {
    icon: GraduationCap,
    title: 'Learn & master',
    body: 'Ask for a course on anything and Bermi drafts it, enrolls you, and teaches it step by step — right inside the chat.',
  },
  {
    icon: Layers,
    title: 'Manage & grow',
    body: 'Organizations publish courses, programs, events, and resources, then track every learner\'s real progress.',
  },
]

const learnerFeatures = [
  'Ask for any course, program, or guide and get it drafted and taught instantly',
  'Mastery-gated lessons with a quiz before you advance — real understanding, not clicking "next"',
  'Gamified Study Mode: XP, streaks, and progress that reflects what you\'ve actually learned',
  'Voice dictation and hands-free Live Voice conversations',
  'Attach documents, PDFs, and images — Bermi reads and works with them directly',
]

const orgFeatures = [
  'Publish courses, programs, events, and resources to your own branded catalog',
  'AI-assisted authoring — describe a topic and get a full curriculum drafted',
  'Track learner progress, completions, and mastery in a live analytics dashboard',
  'A searchable learner directory with CSV export for reporting',
  'Video lessons with captions, playable directly inside the chat experience',
]

const lmsCapabilities = [
  { icon: BookOpen, label: 'Mastery-gated courses' },
  { icon: Layers, label: 'Structured programs' },
  { icon: CalendarClock, label: 'Events & registration' },
  { icon: Library, label: 'Resource library' },
  { icon: BarChart3, label: 'Learner analytics' },
  { icon: Users, label: 'Learner directory & CSV export' },
  { icon: Video, label: 'Video lessons with captions' },
  { icon: Trophy, label: 'XP, streaks & Study Mode' },
]

const advantages = [
  {
    icon: Rocket,
    title: 'From idea to course in minutes',
    body: 'No wizard, no dashboard detour — describe what you want taught and Bermi writes and publishes it on the spot.',
  },
  {
    icon: Gauge,
    title: 'One platform instead of five',
    body: 'Chat, documents, voice, and a full learning management system in a single, coherent workspace.',
  },
  {
    icon: CheckCircle2,
    title: 'Progress that means something',
    body: 'Mastery checks replace vanity completion badges, so "finished" actually means understood.',
  },
  {
    icon: FileText,
    title: 'Built for real organizations',
    body: 'Institutions get their own catalog, learner insights, and export tools from day one — no setup team required.',
  },
]

export function LandingPage({ onSignIn, onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <NavBar onSignIn={onSignIn} onGetStarted={onGetStarted} />

      {/* Hero */}
      <section className="relative isolate px-5 pb-8 pt-14 md:px-8 md:pt-20">
        <HeroBackdrop />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-raised px-3.5 py-1.5 text-[12px] font-medium text-ink-muted shadow-sm">
              <Sparkles size={13} className="text-primary" />
              AI chat, meet learning management
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-serif text-[36px] font-medium leading-[1.12] tracking-tight md:text-[54px]">
              Learn anything.
              <br />
              <span className="text-primary">Build faster</span>, together.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-muted md:text-[17px]">
              Bermi AI is a single workspace that chats, writes, and teaches — for people who want
              to get things done, and for organizations that want to put real courses in front of
              real learners.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={onGetStarted}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-[15px] font-medium text-white shadow-sm transition-all hover:bg-primary-hover hover:shadow-md sm:w-auto"
              >
                Get started free
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={onSignIn}
                className="w-full rounded-xl border border-edge bg-surface-raised px-6 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-surface-sunken sm:w-auto"
              >
                Sign in
              </button>
            </div>
          </Reveal>
        </div>
        <Reveal delay={320}>
          <HeroIllustration />
        </Reveal>
      </section>

      {/* What is Bermi AI */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-[26px] font-medium tracking-tight md:text-[32px]">
            What is Bermi AI?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            One AI workspace that's equally at home helping you draft a document and teaching you
            (or your whole organization) something new — with a real learning management system
            underneath it.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <div className="group h-full rounded-2xl border border-edge bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform duration-300 group-hover:scale-110">
                  <p.icon size={20} />
                </div>
                <h3 className="mt-4 text-[15.5px] font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* For learners / for organizations */}
      <section className="bg-surface-sunken/60 px-5 py-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-xl text-center">
            <h2 className="font-serif text-[26px] font-medium tracking-tight md:text-[32px]">
              Built for learners and organizations alike
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-edge bg-surface-raised p-7 shadow-sm transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Mic size={18} />
                  </div>
                  <h3 className="font-serif text-[19px] font-medium">For learners</h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
                  Stay productive and pick up new skills without leaving the conversation.
                </p>
                <ul className="mt-5 space-y-3">
                  {learnerFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span className="text-ink-muted">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="h-full rounded-2xl border border-edge bg-surface-raised p-7 shadow-sm transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Users size={18} />
                  </div>
                  <h3 className="font-serif text-[19px] font-medium">For organizations</h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
                  List what you teach, put it in front of learners, and see who's actually
                  progressing.
                </p>
                <ul className="mt-5 space-y-3">
                  {orgFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span className="text-ink-muted">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* LMS capabilities grid */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-[26px] font-medium tracking-tight md:text-[32px]">
            A modern learning management system, built in
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            Everything a training team or school usually stitches together from three different
            tools — here from the first course you publish.
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {lmsCapabilities.map((c, i) => (
            <Reveal key={c.label} delay={(i % 4) * 80}>
              <div className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform duration-300 group-hover:scale-110">
                  <c.icon size={19} />
                </div>
                <p className="text-[12.5px] font-medium leading-snug text-ink">{c.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Advantages */}
      <section className="bg-surface-sunken/60 px-5 py-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-xl text-center">
            <h2 className="font-serif text-[26px] font-medium tracking-tight md:text-[32px]">
              Why teams pick Bermi
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {advantages.map((a, i) => (
              <Reveal key={a.title} delay={i * 90}>
                <div className="flex h-full gap-4 rounded-2xl border border-edge bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:shadow-lg">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <a.icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">{a.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{a.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-20 md:px-8">
        <Reveal className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-14 text-center shadow-xl">
            <div
              aria-hidden
              className="bermi-blob absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            />
            <div
              aria-hidden
              className="bermi-blob absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"
              style={{ animationDelay: '-4s' }}
            />
            <h2 className="relative font-serif text-[26px] font-medium tracking-tight text-white md:text-[32px]">
              Ready to bring your ideas — and your curriculum — to life?
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-white/80">
              Start chatting in seconds. Publish your first course whenever you're ready.
            </p>
            <button
              onClick={onGetStarted}
              className="group relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-medium text-primary shadow-sm transition-all hover:shadow-md"
            >
              Get started free
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-edge px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2 text-ink-muted">
            <BermiMark size={18} className="text-primary" />
            <span className="text-[13px]">Bermi AI</span>
          </div>
          <p className="text-[12px] text-ink-faint">
            &copy; {new Date().getFullYear()} Bermi AI. Built for people and organizations who
            like to move fast.
          </p>
        </div>
      </footer>
    </div>
  )
}
