import { Check, Minus, Sparkles } from 'lucide-react'
import { GlowBackdrop, PrimaryCta, Reveal, SecondaryCta, useDocumentMeta } from './shared'

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

type Cell = boolean | string

const comparison: { feature: string; free: Cell; individual: Cell; institution: Cell }[] = [
  { feature: 'AI chat, documents & custom Brains', free: true, individual: true, institution: true },
  { feature: 'Mastery-gated course building', free: true, individual: true, institution: true },
  { feature: 'Gamified Study Mode (XP & streaks)', free: true, individual: true, institution: true },
  { feature: 'Institution publishing & catalog', free: true, individual: true, institution: true },
  { feature: 'Live learner analytics & CSV export', free: true, individual: true, institution: true },
  { feature: 'Higher AI usage limits', free: false, individual: 'Planned', institution: 'Planned' },
  { feature: 'Priority AI model access', free: false, individual: 'Planned', institution: 'Planned' },
  { feature: 'Multiple institution seats & roles', free: false, individual: false, institution: 'Planned' },
  { feature: 'Dedicated support', free: false, individual: false, institution: 'Planned' },
]

function Cell({ value }: { value: Cell }) {
  if (value === true) return <Check size={16} className="mx-auto text-white/80" />
  if (value === false) return <Minus size={16} className="mx-auto text-white/25" />
  return <span className="text-[11.5px] font-medium text-white/50">{value}</span>
}

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

      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal className="flex flex-col rounded-3xl border-2 border-white/20 bermi-glass px-7 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Free, for now</p>
            <p className="mt-2 text-[28px] font-bold text-white">
              $0<span className="text-[14px] font-medium text-white/40"> / no credit card</span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {included.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                  <Check size={16} className="mt-0.5 shrink-0 text-white/70" />
                  <span className="text-white/65">{f}</span>
                </li>
              ))}
            </ul>
            <PrimaryCta onClick={onGetStarted} className="mt-7 w-full">
              Get started free
            </PrimaryCta>
          </Reveal>

          <Reveal delay={80} className="flex flex-col rounded-3xl bermi-glass px-7 py-8 opacity-90">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Individual — coming soon</p>
            <p className="mt-2 text-[20px] font-bold text-white">For serious solo learners</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Everything in Free, plus higher AI usage limits and priority model access once
              pricing is finalized.
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Check size={16} className="mt-0.5 shrink-0 text-white/50" />
                <span className="text-white/55">Everything in Free</span>
              </li>
              <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Minus size={16} className="mt-0.5 shrink-0 text-white/30" />
                <span className="text-white/45">Higher AI usage limits (planned)</span>
              </li>
              <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Minus size={16} className="mt-0.5 shrink-0 text-white/30" />
                <span className="text-white/45">Priority AI model access (planned)</span>
              </li>
            </ul>
            <SecondaryCta onClick={onGetStarted} className="mt-7 w-full">
              Join the waitlist
            </SecondaryCta>
          </Reveal>

          <Reveal delay={160} className="flex flex-col rounded-3xl bermi-glass px-7 py-8 opacity-90">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Institution — coming soon</p>
            <p className="mt-2 text-[20px] font-bold text-white">For organizations at scale</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Everything in Free, plus multiple seats, roles, and dedicated support for larger
              publishing teams.
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Check size={16} className="mt-0.5 shrink-0 text-white/50" />
                <span className="text-white/55">Everything in Free</span>
              </li>
              <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Minus size={16} className="mt-0.5 shrink-0 text-white/30" />
                <span className="text-white/45">Multiple seats & roles (planned)</span>
              </li>
              <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Minus size={16} className="mt-0.5 shrink-0 text-white/30" />
                <span className="text-white/45">Dedicated support (planned)</span>
              </li>
            </ul>
            <SecondaryCta onClick={onGetStarted} className="mt-7 w-full">
              Talk to us
            </SecondaryCta>
          </Reveal>
        </div>
        <p className="mt-4 text-center text-[12px] text-white/40">
          Paid plans for individuals and institutions are coming soon — we'll notify everyone
          before anything changes. Nothing above is billed today.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-16">
        <Reveal>
          <h2 className="mb-6 text-center text-[18px] font-semibold text-white">Compare plans</h2>
          <div className="overflow-x-auto rounded-2xl bermi-glass">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="px-5 py-3.5 font-medium">Feature</th>
                  <th className="px-4 py-3.5 text-center font-medium">Free</th>
                  <th className="px-4 py-3.5 text-center font-medium">Individual</th>
                  <th className="px-4 py-3.5 text-center font-medium">Institution</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-5 py-3 text-white/75">{row.feature}</td>
                    <td className="px-4 py-3 text-center"><Cell value={row.free} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.individual} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.institution} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>
    </>
  )
}
