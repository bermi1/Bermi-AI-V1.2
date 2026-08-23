import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { GlowBackdrop, Reveal, useDocumentMeta, useJsonLd } from './shared'

const faqGroups = [
  {
    label: 'Getting started',
    items: [
      {
        q: 'Is Bermi AI free to use?',
        a: 'Yes — create a free account to chat, build courses, and use Study Mode. See the Pricing page for what happens as paid plans roll out.',
      },
      {
        q: 'Can I really build a course just by asking in chat?',
        a: 'Yes. Describe what you want taught and Bermi drafts the lessons, enrolls you, and starts teaching right there in the conversation — no separate builder required.',
      },
      {
        q: 'Do I need to know what I want to learn before I start?',
        a: "No. Ask Bermi to suggest a topic, or just start chatting about what you're trying to get done — it can turn that into a structured course on the spot.",
      },
    ],
  },
  {
    label: 'For organizations',
    items: [
      {
        q: 'Can my organization publish its own courses?',
        a: 'Yes — for registered organizations. Institution Studio lets you publish courses, programs, and resources under your own catalog, then track learner progress and export the data.',
      },
      {
        q: 'How is progress tracked across learners?',
        a: 'A live analytics dashboard shows completions and mastery per learner, plus a searchable learner directory with CSV export for reporting.',
      },
      {
        q: 'Do we need to migrate from our existing LMS?',
        a: "No migration is required to start — publish new courses, programs, or resources directly in Bermi and grow your catalog from there.",
      },
    ],
  },
  {
    label: 'Trust & data',
    items: [
      {
        q: 'What happens to my conversations and content?',
        a: 'Everything you create stays tied to your own account and is never shared with other organizations on Bermi.',
      },
      {
        q: 'When will paid plans be available?',
        a: 'Pricing is on the way — see the Pricing page. Everyone can get started for free in the meantime.',
      },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[14px] font-medium text-white">{q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-white/60">{a}</p>
        </div>
      </div>
    </div>
  )
}

export function Faq() {
  useDocumentMeta(
    'Frequently Asked Questions',
    "Answers on getting started, building courses from chat, institution publishing, learner analytics, and data privacy on Bermi AI.",
  )
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqGroups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    ),
  })
  return (
    <>
      <section className="relative isolate px-5 pb-6 pt-14 md:pt-20">
        <GlowBackdrop size="sm" />
        <Reveal className="mx-auto max-w-lg text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur">
            <Sparkles size={13} className="text-white/70" />
            FAQ
          </span>
          <h1 className="mt-5 text-[32px] font-semibold leading-[1.15] tracking-tight md:text-[42px]">
            Frequently asked questions
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-white/60">
            Everything you'd want to know before chatting your way to your first course.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-2xl px-5 pb-16">
        <div className="space-y-8">
          {faqGroups.map((group, gi) => (
            <Reveal key={group.label} delay={gi * 100}>
              <h2 className="mb-3 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-white/70">
                {group.label}
              </h2>
              <div className="divide-y divide-white/10 rounded-2xl bermi-glass">
                {group.items.map((f) => (
                  <FaqItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
