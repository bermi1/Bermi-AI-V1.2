import { useRef } from 'react'
import type { MouseEvent } from 'react'
import {
  BarChart3,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  Compass,
  Database,
  FileText,
  GraduationCap,
  Layers,
  Library,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react'
import { BermiMark } from '../components/Logo'
import { GlowBackdrop, PrimaryCta, Reveal, SecondaryCta, useDocumentMeta, usePublicStats } from './shared'

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
            <BermiMark size={14} className="text-white" />
            <span className="text-[12px] font-medium text-white/60">Bermi AI</span>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 px-1 pb-1">
          <div className="ml-auto w-fit max-w-[80%] rounded-xl rounded-tr-sm bg-white/10 px-3.5 py-2 text-[13px] text-white/90">
            Build me a course on negotiation skills
          </div>
          <div className="w-fit max-w-[85%] rounded-xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2 text-[13px] leading-relaxed text-white/70">
            Done — 6 lessons drafted and you're enrolled. Starting lesson one now…
          </div>
        </div>
      </div>
      <div className="bermi-float absolute -right-3 -top-6 hidden w-40 rounded-2xl p-3 bermi-glass sm:block">
        <div className="flex items-center gap-1.5 text-white/70">
          <BarChart3 size={13} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Mastery
          </span>
        </div>
        <p className="mt-1 text-[18px] font-semibold text-white">Lesson 3/6</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-white" />
        </div>
      </div>
    </div>
  )
}

// Real counts only ever get shown once they're large enough to actually read
// as social proof — a truthful "3" looks worse than no number at all. Below
// threshold, the tile falls back to something equally true about the
// product itself, never a padded or invented figure.
function statDisplay(value: number | null, threshold: number, fallback: string): string {
  return value != null && value >= threshold ? `${value.toLocaleString()}+` : fallback
}

function SocialProofLine() {
  const stats = usePublicStats()
  const learnersReady = stats && stats.learners >= 20
  const institutionsReady = stats && stats.institutions >= 5
  if (!learnersReady && !institutionsReady) {
    return (
      <p className="mt-5 text-[12.5px] text-white/40">
        Now onboarding early individual learners and institutions
      </p>
    )
  }
  const parts: string[] = []
  if (learnersReady) parts.push(`${stats!.learners.toLocaleString()}+ learners`)
  if (institutionsReady) parts.push(`${stats!.institutions.toLocaleString()}+ institutions`)
  return <p className="mt-5 text-[12.5px] text-white/40">Trusted by {parts.join(' and ')}</p>
}

function ProofBar() {
  const stats = usePublicStats()
  const tiles = [
    { value: statDisplay(stats?.learners ?? null, 20, 'Growing'), label: 'Individual learners', sub: 'Chatting, building, and mastering skills' },
    { value: statDisplay(stats?.courses ?? null, 20, 'Unlimited'), label: 'Courses created', sub: 'AI-drafted from any topic, on demand' },
    { value: statDisplay(stats?.institutions ?? null, 5, 'Early access'), label: 'Institutions onboard', sub: 'Publishing courses, programs & resources' },
    {
      value: stats?.totalEnrollments != null && stats.totalEnrollments >= 10 && stats.completionRate != null ? `${stats.completionRate}%` : '100%',
      label: 'Mastery-gated',
      sub: 'Every lesson checked before advancing',
    },
  ]
  return (
    <section className="px-5 py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3.5 sm:grid-cols-4">
        {tiles.map((s, i) => (
          <Reveal key={s.label} delay={i * 80}>
            <div className="rounded-2xl bermi-glass px-4 py-5 text-center">
              <p className="text-[26px] font-bold text-white">{s.value}</p>
              <p className="mt-1 text-[12.5px] font-semibold text-white">{s.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-white/45">{s.sub}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

const problems = [
  {
    icon: MessagesSquare,
    title: 'Chatbots give answers, not skill',
    body: 'Ask a question, get an explanation, forget it next week. Nothing was actually learned — or checked.',
  },
  {
    icon: ShieldOff,
    title: 'Certificates without competence',
    body: '"Completed" usually just means clicked through. No quiz, no gate, no proof anyone understood a thing.',
  },
  {
    icon: Compass,
    title: 'No structure, no accountability',
    body: 'A free-form chat has no curriculum, no progression, and no way for an institution to see who actually knows what.',
  },
]

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
      <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[26px] hidden h-px bg-gradient-to-r from-transparent via-white/25 to-transparent sm:block">
        <div className="bermi-pulse-travel absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.5)]" />
      </div>
      <div className="grid gap-6 sm:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 100} className="relative text-center">
            <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bermi-glass text-white/80">
              <s.icon size={22} />
            </div>
            <h3 className="mt-4 text-[14.5px] font-semibold text-white">
              <span className="mr-1.5 text-white/35">{i + 1}.</span>
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
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bermi-glass shadow-[0_0_40px_rgba(255,255,255,0.15)]">
        <BermiMark size={26} className="text-white" />
      </div>
      {nodes.map((n) => (
        <div key={n.label} className={`absolute flex flex-col items-center gap-1.5 ${n.pos}`}>
          <div className="bermi-float flex h-11 w-11 items-center justify-center rounded-xl bermi-glass text-white/80">
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
  'Registered organizations publish courses, programs, and resources under their own catalog.',
]

const capabilities = [
  {
    icon: MessageSquare,
    title: 'Conversation → full courses',
    body: 'Describe a topic in chat — a complete curriculum is drafted, and you\'re enrolled immediately.',
  },
  {
    icon: ShieldCheck,
    title: 'Mastery-gated progression',
    body: 'A quiz gates every lesson, so "done" always means actually understood — never just clicked through.',
  },
  {
    icon: Brain,
    title: 'Custom AI Brains',
    body: 'Train a dedicated AI on your own documents and knowledge — ask it anything, grounded in what you gave it.',
  },
  {
    icon: Trophy,
    title: 'Gamified Study Mode',
    body: 'XP, streaks, and levels that reflect real skill gained — not just time spent clicking.',
  },
  {
    icon: FileText,
    title: 'Document workspace & knowledge base',
    body: 'Attach documents, PDFs, and images — Bermi reads and works with them directly, no separate uploader.',
  },
  {
    icon: Building2,
    title: 'Institution publishing & libraries',
    body: 'Registered organizations list courses, programs, and resources under their own branded catalog.',
  },
  {
    icon: BarChart3,
    title: 'Live learner analytics',
    body: 'Track completions and mastery across every learner, with a CSV export for reporting.',
  },
  {
    icon: Target,
    title: 'Progress visualization & reports',
    body: 'Mastery reports and progress dashboards that show exactly who knows what, and how well.',
  },
]

const learnerFeatures = [
  'Ask for any course, program, or guide and get it drafted and taught instantly',
  'Mastery-gated lessons with a quiz before you advance',
  'Gamified Study Mode: XP, streaks, and real progress',
  'Attach documents, PDFs, and images — Bermi works with them directly',
  'Build your own custom AI Brain from your own material',
]

const orgFeatures = [
  'Publish courses, programs, and resources to your own branded catalog',
  'AI-assisted authoring — describe a topic, get a drafted curriculum',
  'Live analytics dashboard for progress, completions, and mastery',
  'Searchable learner directory with CSV export for reporting',
  'Real organization required to publish — not a personal chatbot skin',
]

const ecosystem = [
  { icon: Library, label: 'Course library' },
  { icon: Brain, label: 'Custom AI Brains' },
  { icon: Database, label: 'Study resources' },
  { icon: BarChart3, label: 'Analytics dashboard' },
  { icon: Building2, label: 'Institutional tools' },
]

export function Home({ onSignIn, onGetStarted }: HomeProps) {
  useDocumentMeta(
    'From Conversation to Real Mastery',
    'Bermi AI is the complete AI learning powerhouse — turn any chat or document into a structured, mastery-gated learning path. Build custom AI brains, publish courses as an institution, and track real, measurable competence.',
  )
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
            <Sparkles size={13} className="text-white/70" />
            The complete AI learning powerhouse
          </span>
          <h1 className="mt-5 text-[36px] font-semibold leading-[1.08] tracking-tight text-white md:text-[56px]">
            From conversation
            <br />
            to real mastery.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed text-white/60">
            Bermi AI turns any chat or document into a structured, mastery-gated learning path —
            so people and institutions get measurable skill, not just explanations or
            certificates.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryCta onClick={onGetStarted} className="w-full sm:w-auto">
              Get started free
            </PrimaryCta>
            <SecondaryCta onClick={onSignIn} className="w-full sm:w-auto">
              Sign in
            </SecondaryCta>
          </div>
          <SocialProofLine />
        </div>
        <HeroMockup />
      </section>

      <ProofBar />

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-lg text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            Most AI learning tools give you answers. Not skill.
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">
            A chat window that just replies isn't a learning system — and a certificate nobody
            earned isn't proof of anything.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-3.5 sm:grid-cols-3">
          {problems.map((p) => (
            <div key={p.title} className="rounded-2xl bermi-glass p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                <p.icon size={18} />
              </div>
              <h3 className="mt-3.5 text-[14.5px] font-semibold text-white">{p.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution — infographic step flow */}
      <section id="how-it-works" className="mx-auto max-w-4xl px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-md text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            From a message to a finished skill
          </h2>
        </Reveal>
        <HowItWorks />
      </section>

      {/* Powerhouse features */}
      <section id="features" className="mx-auto max-w-5xl px-5 py-14 md:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-[24px] font-semibold tracking-tight md:text-[30px]">
              A complete AI learning powerhouse
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/60">
              Not just a chatbot. One AI workspace that's equally at home helping you draft a
              document and teaching you — or your whole organization — something new, with a real
              learning management system underneath it.
            </p>
            <ul className="mt-5 space-y-3">
              {explainPoints.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-white/70" />
                  <span className="text-white/65">{p}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <OrbitDiagram />
          </Reveal>
        </div>

        <div className="mt-14 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c) => (
            <div
              key={c.title}
              className="group rounded-2xl bermi-glass p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.25)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition-transform duration-300 group-hover:scale-110">
                <c.icon size={18} />
              </div>
              <h3 className="mt-3.5 text-[14.5px] font-semibold text-white">{c.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dual audience */}
      <section id="audience" className="mx-auto max-w-5xl px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-md text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            Built for individuals and institutions alike
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl bermi-glass p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-white">For Individuals</h3>
                  <p className="text-[12px] text-white/50">Master any skill deeply</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {learnerFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-white/70" />
                    <span className="text-white/60">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div id="institutions" className="h-full scroll-mt-24 rounded-2xl bermi-glass p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-white">For Institutions</h3>
                  <p className="text-[12px] text-white/50">Deliver measurable competence at scale</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {orgFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-white/70" />
                    <span className="text-white/60">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Resources & ecosystem */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <Reveal>
          <div className="rounded-3xl bermi-glass px-6 py-8 sm:px-10">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-white/50">
                <Bot size={13} /> More than chat — a full ecosystem
              </div>
              <p className="text-[15px] font-semibold text-white">Everything lives in one workspace</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {ecosystem.map((r) => (
                <div key={r.label} className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                    <r.icon size={17} />
                  </div>
                  <span className="text-[12px] font-medium text-white/65">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="px-5 py-14 md:py-16">
        <Reveal className="mx-auto max-w-2xl rounded-3xl bermi-glass px-8 py-10 text-center">
          <h2 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            Ready to turn conversation into real mastery?
          </h2>
          <p className="mx-auto mt-2.5 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Start chatting in seconds. Publish your first course whenever you're ready.
          </p>
          <div className="mt-6 flex justify-center">
            <PrimaryCta onClick={onGetStarted}>Get started free</PrimaryCta>
          </div>
          <SocialProofLine />
        </Reveal>
      </section>
    </>
  )
}
