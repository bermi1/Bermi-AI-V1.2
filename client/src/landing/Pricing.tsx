import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { GlowBackdrop, Reveal, useDocumentMeta } from './shared'

interface PricingProps {
  onGetStarted: () => void
}

const included = [
  'Full AI chat, documents, and your own custom AI "brains"',
  'Build and take mastery-gated courses, right from the conversation',
  'Gamified Study Mode with XP and streaks',
  'Institution publishing: courses, programs, and resources',
  'Live learner analytics and CSV export',
]

export function Pricing({ onGetStarted }: PricingProps) {
  useDocumentMeta(
    'Pricing',
    'See what\'s included with Bermi AI — full AI chat, mastery-gated courses, gamified Study Mode, and institution publishing with live learner analytics.',
  )
  return (
    <>
      <section className="relative isolate px-5 pb-10 pt-14 md:pt-20">
        <GlowBackdrop size="sm" />
        <Reveal className="mx-auto max-w-lg text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur">
            <Sparkles size={13} className="text-white/70" />
            Pricing
          </span>
          <h1 className="mt-5 text-[32px] font-semibold leading-[1.15] tracking-tight md:text-[42px]">
            Simple plans are on the way
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-white/60">
            We're finalizing pricing for individuals and organizations. Everything below is free
            to use right now, while we get it right.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-lg px-5 pb-16">
        <Reveal className="rounded-3xl bermi-glass px-8 py-9">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Free, for now
          </p>
          <p className="mt-2 text-[28px] font-bold text-white">
            $0<span className="text-[14px] font-medium text-white/40"> / no credit card</span>
          </p>
          <ul className="mt-6 space-y-3">
            {included.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-white/70" />
                <span className="text-white/65">{f}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onGetStarted}
            className="group mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-[14px] font-semibold text-[#0a0a0a] transition-all hover:shadow-[0_0_28px_rgba(255,255,255,0.35)]"
          >
            Get started free
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-4 text-center text-[12px] text-white/40">
            Paid plans for teams and larger institutions are coming soon — we'll notify everyone
            before anything changes.
          </p>
        </Reveal>
      </section>
    </>
  )
}
