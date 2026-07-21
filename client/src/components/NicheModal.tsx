import { useEffect, useState } from 'react'
import { Compass, Loader2, Sparkles, Target } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, primaryBtnCls } from './Modal'
import * as api from '../lib/api'
import type { NicheQuestion, NicheReport } from '../lib/types'

export function NicheModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [questions, setQuestions] = useState<NicheQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [report, setReport] = useState<NicheReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getNicheQuestions().then((r) => setQuestions(r.questions)).catch(() => {})
    api.getNiche().then((r) => r.report && setReport(r.report)).catch(() => {})
  }, [])

  const discover = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.discoverNiche(answers)
      setReport(r.report)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (report) {
    const Section = ({ title, items }: { title: string; items?: string[] }) =>
      items && items.length ? (
        <div>
          <h4 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{title}</h4>
          <ul className="space-y-1">
            {items.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-[13px] text-ink-muted">
                <span className="mt-0.5 text-primary">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null

    return (
      <Modal title="Your niche" subtitle="Saved to a knowledge base so Bermi remembers it" onClose={onClose} wide>
        <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-5 text-white">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-white/80">
              <Target size={14} /> Your niche
            </div>
            <h3 className="mt-1 font-serif text-[24px] font-medium">{report.niche}</h3>
            <p className="mt-1 text-[14px] text-white/90">{report.tagline}</p>
          </div>

          {report.why_you && <p className="text-[13.5px] leading-relaxed text-ink-muted">{report.why_you}</p>}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Audience</h4>
              <p className="text-[13px] text-ink-muted">{report.audience}</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Positioning</h4>
              <p className="text-[13px] text-ink-muted">{report.positioning}</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Content pillars" items={report.content_pillars} />
            <Section title="First moves" items={report.first_moves} />
            <Section title="Skills to build" items={report.skills_to_build} />
            <Section title="Ways to earn" items={report.monetization} />
            <Section title="Self-improvement" items={report.self_improvement} />
          </div>

          {report.ninety_day_goal && (
            <div className="rounded-xl border border-primary/30 bg-primary-soft px-4 py-3">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-primary">90-day goal</h4>
              <p className="mt-0.5 text-[13.5px] text-ink">{report.ninety_day_goal}</p>
            </div>
          )}

          <div className="flex justify-between border-t border-edge pt-4">
            <button onClick={() => setReport(null)} className={ghostBtnCls}>
              Redo discovery
            </button>
            <button onClick={onClose} className={primaryBtnCls}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Niche discovery"
      subtitle="Answer a few questions — Bermi finds your focus and a plan to grow"
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="mb-1 block text-[13px] font-medium text-ink">{q.q}</label>
            <textarea
              className={inputCls + ' min-h-[60px] resize-y'}
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          </div>
        ))}
        {error && <p className="text-[13px] text-red-500">{error}</p>}
        <div className="flex items-center justify-between border-t border-edge pt-4">
          <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
            <Compass size={13} className="text-primary" />
            Your answers stay private to your workspace.
          </span>
          <button onClick={discover} disabled={busy} className={primaryBtnCls + ' flex items-center gap-2'}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy ? 'Finding your niche…' : 'Discover my niche'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
