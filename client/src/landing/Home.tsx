import { useRef } from 'react'
import type { MouseEvent } from 'react'
import {
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  GraduationCap,
  Layers,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react'
import { BermiMark } from '../components/Logo'
import { GlowBackdrop, Reveal } from './shared'

interface HomeProps {
  onSignIn: () => void
  onGetStarted: () => void
}

/** A single, clean product mockup: a glass chat panel with one overlapping stat card. */
function HeroMockup() {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-2xl px-2">
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
      <div className="bermi-float absolute -right-3 -top-6 hidden w-40 rounded-2xl p-3 bermi-glass sm:block">
        <div className="flex items-center gap-1.5 text-violet-300">
          <BarChart3 size={13} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Mastery
          </span>
        </div>
        <p className="mt-1 text-[18px] font-semibold text-white">Lesson 3/6</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-violet-400" />
        </div>
      </div>
    </div>
  )
}

const steps = [
  { icon: MessageSquare, title: 'Ask', body: 'Describe what you want built, learned, or done — in plain chat.' },
  { icon: Wand2, title: 'AI drafts', body: 'Bermi writes the document, course, or curriculum on the spot.' },
  { icon: GraduationCap, title: 'You learn', body: 'Mastery-gated lessons teach it step by step, right in the chat.' },
  { icon: TrendingUp, title: 'Progress tracks', body: 'XP, streaks, and analytics show real skill gained over time.' },
]

/** Horizontal step flow with a glowing connector line and a pulse that travels along it. */
function HowItWorks() {
  return (
    <div className="relative mt-12">
      <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[26px] hidden h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent sm:block">
        <div className="bermi-pulse-travel absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_10px_3px_rgba(167,139,250,0.7)]" />
      </div>
      <div className="grid gap-6 sm:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 100} className="relative text-center">
            <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bermi-glass text-violet-300">
              <s.icon size={22} />
            </div>
            <h3 className="mt-4 text-[14.5px] font-semibold text-white">
              <span className="mr-1.5 text-violet-400/70">{i + 1}.</span>
              {s.title}
            </h3>
            <p className="mx-auto mt-1.5 max-w-[200px] text-[12.5px] leading-relaxed text-white/55">
              {s.body}
            </p>
          </Reveal>
        ))}
      </div>
    </div>
  )
}

/** A small orbit diagram: Bermi mark at the center, four capabilities around it. */
function OrbitDiagram() {
  const nodes = [
    { icon: MessageSquare, label: 'Chat', pos: 'left-1/2 top-0 -translate-x-1/2' },
    { icon: GraduationCap, label: 'Learn', pos: 'right-0 top-1/2 -translate-y-1/2' },
    { icon: Building2, label: 'Publish', pos: 'left-1/2 bottom-0 -translate-x-1/2' },
    { icon: BarChart3, label: 'Track', pos: 'left-0 top-1/2 -translate-y-1/2' },
  ]
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      <div className="bermi-orbit-spin absolute inset-0 rounded-full border border-dashed border-white/10" />
      <div className="absolute inset-[15%] rounded-full border border-white/[0.06]" />
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bermi-glass shadow-[0_0_40px_rgba(139,92,246,0.35)]">
        <BermiMark size={26} className="text-violet-300" />
      </div>
      {nodes.map((n) => (
        <div key={n.label} className={`absolute flex flex-col items-center gap-1.5 ${n.pos}`}>
          <div className="bermi-float flex h-11 w-11 items-center justify-center rounded-xl bermi-glass text-violet-300">
            <n.icon size={17} />
          </div>
          <span className="text-[10.5px] font-medium text-white/55">{n.label}</span>
        </div>
      ))}
    </div>
  )
}

const explainPoints = [
  'A capable AI assistant for writing, research, and documents — plus your own custom AI "brains".',
  'Ask for a course on anything and get it drafted, enrolled, and taught step by step, instantly.',
  'Organizations publish courses, programs, events, and resources under their own catalog.',
]

const capabilities = [
  {
    icon: Brain,
    title: 'AI chat & documents',
    body: 'Write, research, and get real work done with an assistant that reads what you give it.',
  },
  {
    icon: GraduationCap,
    title: 'Instant course builder',
    body: "Describe a topic in chat — a full curriculum is drafted and you're enrolled immediately.",
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

const learnerFeatures = [
  'Ask for any course, program, or guide and get it drafted and taught instantly',
  'Mastery-gated lessons with a quiz before you advance',
  'Gamified Study Mode: XP, streaks, and real progress',
  'Attach documents, PDFs, and images — Bermi works with them directly',
]

const orgFeatures = [
  'Publish courses, programs, events, and resources to your own catalog',
  'AI-assisted authoring — describe a topic, get a drafted curriculum',
  'Live analytics dashboard for progress, completions, and mastery',
  'Searchable learner directory with CSV export for reporting',
]

const stats = [
  { value: '4', label: 'Catalog types', sub: 'Courses, programs, events & resources' },
  { value: '100%', label: 'Mastery-gated', sub: 'Every lesson checked before advancing' },
  { value: '1 chat', label: 'To a full course', sub: 'No wizard or dashboard detour' },
  { value: '0', label: 'Setup required', sub: 'For institutions to start publishing' },
]

export function Home({ onSignIn, onGetStarted }: HomeProps) {
  const heroRef = useRef<HTMLDivElement>(null)

  const onHeroMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  return (
    <>
      {/* Hero — intentionally compact */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        className="relative isolate px-5 pb-6 pt-10 md:pt-14"
      >
        <GlowBackdrop size="sm" />
        <div aria-hidden className="bermi-spotlight pointer-events-none absolute inset-0" />
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur">
            <Sparkles size={13} className="text-violet-300" />
            AI chat, meet learning management
          </span>
          <h1 className="mt-5 text-[32px] font-semibold leading-[1.12] tracking-tight md:text-[44px]">
            Learn faster.{' '}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent">
              Build smarter.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed text-white/60">
            One AI workspace that chats, writes, and teaches — for people who want to get things
            done, and organizations that want real courses in front of real learners.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onGetStarted}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-[14px] font-semibold text-[#0a0a12] shadow-[0_0_30px_rgba(167,139,250,0.25)] transition-all hover:shadow-[0_0_36px_rgba(167,139,250,0.55)] sm:w-auto"
            >
              Get started free
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onSignIn}
              className="w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-2.5 text-[14px] font-medium text-white/85 backdrop-blur transition-colors hover:bg-white/[0.08] sm:w-auto"
            >
              Sign in
            </button>
          </div>
        </div>
        <HeroMockup />
      </section>

      {/* How it works — infographic step flow */}
      <section className="mx-auto max-w-4xl px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-md text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            From a message to a finished skill
          </h2>
        </Reveal>
        <HowItWorks />
      </section>

      {/* Expanded explanation with orbit illustration */}
      <section className="mx-auto max-w-5xl px-5 py-14 md:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-[24px] font-semibold tracking-tight md:text-[30px]">
              What is Bermi AI?
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/60">
              One AI workspace that's equally at home helping you draft a document and teaching
              you — or your whole organization — something new, with a real learning management
              system underneath it.
            </p>
            <ul className="mt-5 space-y-3">
              {explainPoints.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-violet-300" />
                  <span className="text-white/65">{p}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <OrbitDiagram />
          </Reveal>
        </div>
      </section>

      {/* Stat infographic band */}
      <section className="px-5 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3.5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="rounded-2xl bermi-glass px-4 py-5 text-center">
                <p className="bg-gradient-to-r from-violet-300 to-fuchsia-200 bg-clip-text text-[26px] font-bold text-transparent">
                  {s.value}
                </p>
                <p className="mt-1 text-[12.5px] font-semibold text-white">{s.label}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/45">{s.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* For learners / organizations */}
      <section className="mx-auto max-w-5xl px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-md text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            Built for learners and organizations alike
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl bermi-glass p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <Users size={16} />
                </div>
                <h3 className="text-[16px] font-semibold text-white">For learners</h3>
              </div>
              <ul className="mt-4 space-y-2.5">
                {learnerFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-violet-300" />
                    <span className="text-white/60">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="h-full rounded-2xl bermi-glass p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <Layers size={16} />
                </div>
                <h3 className="text-[16px] font-semibold text-white">For organizations</h3>
              </div>
              <ul className="mt-4 space-y-2.5">
                {orgFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-violet-300" />
                    <span className="text-white/60">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Capabilities grid */}
      <section className="mx-auto max-w-5xl px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-lg text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            A modern learning system, built in
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">
            Everything a training team usually stitches together from three tools — here from day
            one.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <div
              key={c.title}
              className="group rounded-2xl bermi-glass p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_30px_-8px_rgba(139,92,246,0.5)]"
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

      {/* Closing CTA */}
      <section className="px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-2xl rounded-3xl bermi-glass px-8 py-10 text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            Ready to bring your ideas — and your curriculum — to life?
          </h2>
          <p className="mx-auto mt-2.5 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Start chatting in seconds. Publish your first course whenever you're ready.
          </p>
          <button
            onClick={onGetStarted}
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[14px] font-semibold text-[#0a0a12] transition-all hover:shadow-[0_0_28px_rgba(167,139,250,0.5)]"
          >
            Get started free
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </Reveal>
      </section>
    </>
  )
}
