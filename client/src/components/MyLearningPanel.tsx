import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarClock, FileText, GraduationCap, Loader2, Plus, Sparkles, X } from 'lucide-react'
import * as api from '../lib/api'
import type { Attachment, Enrollment, OfferingKind } from '../lib/types'

// Not every enrollment is a "course" being studied: a bank/NGO program is
// guided, an event is attended, a resource is just read. Same widget, four
// vocabularies, so the dashboard reflects what actually happened.
const KIND_META: Record<OfferingKind, { section: string; doneWord: string; cta: string }> = {
  course: { section: 'Courses', doneWord: 'lessons done', cta: 'Study →' },
  program: { section: 'Programs', doneWord: 'steps done', cta: 'Continue →' },
  event: { section: 'Events', doneWord: '', cta: 'View →' },
  resource: { section: 'Resources', doneWord: '', cta: 'Open →' },
}

function formatEventWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function MyLearningPanel({ onStudyCourse }: { onStudyCourse: (title: string, kind?: OfferingKind) => void }) {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)
  const [buildOpen, setBuildOpen] = useState(false)

  const refresh = () => api.learnMyEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
  useEffect(() => {
    refresh()
  }, [])

  if (!enrollments) return null
  if (enrollments.length === 0 && !buildOpen) {
    return (
      <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <GraduationCap size={17} className="text-primary" />
          <h2 className="text-[15px] font-semibold tracking-tight">My activity</h2>
        </div>
        <p className="mb-3 text-[13.5px] text-ink-muted">
          Ask Bermi to enroll you in a course, register for an event, walk you through an organization's program,
          or hand you a resource — or build your own course, answer a few quick questions and Bermi drafts it. It
          all happens right here in Bermi AI.
        </p>
        <button
          onClick={() => setBuildOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={14} /> Build a course
        </button>
        {buildOpen && (
          <BuildCourseWizard
            onClose={() => setBuildOpen(false)}
            onCreated={(title) => {
              refresh()
              setBuildOpen(false)
              onStudyCourse(title)
            }}
          />
        )}
      </section>
    )
  }

  const byKind = new Map<OfferingKind, Enrollment[]>()
  for (const e of enrollments) {
    if (!e.course) continue
    const kind = e.course.kind || 'course'
    if (!byKind.has(kind)) byKind.set(kind, [])
    byKind.get(kind)!.push(e)
  }
  const order: OfferingKind[] = ['course', 'program', 'event', 'resource']

  return (
    <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap size={17} className="text-primary" />
          <h2 className="text-[15px] font-semibold tracking-tight">My activity</h2>
        </div>
        <button
          onClick={() => setBuildOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken"
        >
          <Plus size={13} /> Build a course
        </button>
      </div>

      <div className="space-y-4">
        {order
          .filter((k) => byKind.get(k)?.length)
          .map((kind) => {
            const meta = KIND_META[kind]
            const items = byKind.get(kind)!
            return (
              <div key={kind}>
                {order.filter((k) => byKind.get(k)?.length).length > 1 && (
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{meta.section}</div>
                )}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {items.map((e) => {
                    const course = e.course!
                    const progress = e.progress || {}
                    const done = Object.values(progress).filter((p) => p.done).length
                    const sub =
                      kind === 'event'
                        ? e.status === 'applied'
                          ? 'Requested'
                          : `Registered${course.event_at ? ` · ${formatEventWhen(course.event_at)}` : ''}`
                        : kind === 'resource'
                          ? 'Available'
                          : e.status === 'completed'
                            ? `Completed${e.score != null ? ` · ${e.score}%` : ''}`
                            : `${done} ${meta.doneWord}`
                    return (
                      <button
                        key={e.id}
                        onClick={() => onStudyCourse(course.title, kind)}
                        className="flex items-start gap-2.5 rounded-xl border border-edge bg-surface p-3 text-left transition-colors hover:border-primary sm:gap-3 sm:p-3.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-lg sm:h-10 sm:w-10 sm:text-xl">
                          {kind === 'event' ? <CalendarClock size={18} /> : course.cover_emoji || '📘'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-ink">{course.title}</span>
                          <span className="text-[11.5px] text-ink-faint">{sub}</span>
                        </span>
                        <span className="shrink-0 self-center text-[11.5px] font-semibold text-primary">{meta.cta}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </div>

      {buildOpen && (
        <BuildCourseWizard
          onClose={() => setBuildOpen(false)}
          onCreated={(title) => {
            refresh()
            setBuildOpen(false)
            onStudyCourse(title)
          }}
        />
      )}
    </section>
  )
}

const LEVELS = ['All levels', 'Beginner', 'Intermediate', 'Advanced']

type WizardData = {
  topic: string
  audience: string
  level: string
  objectives: string
  avoid: string
}

// A short guided conversation instead of a form dump — one question at a
// time, so building your own course feels like Bermi asking rather than
// you filling in fields. Nothing here ever leaves the dashboard: the
// finished course is created and studied right here in Bermi AI.
function BuildCourseWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (title: string) => void }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({ topic: '', audience: '', level: 'All levels', objectives: '', avoid: '' })
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const steps = [
    {
      key: 'topic',
      question: 'What do you want to learn or teach?',
      hint: 'A topic, skill, or subject — as specific as you like.',
    },
    {
      key: 'audience',
      question: "Who is this for, and what's their starting level?",
      hint: 'e.g. "me, complete beginner" or "high school students with some algebra". Optional.',
    },
    {
      key: 'objectives',
      question: 'What should they be able to do after finishing?',
      hint: 'The concrete outcomes Bermi should teach and test toward. Optional — Bermi can infer them.',
    },
    {
      key: 'material',
      question: 'Have any material to build this from?',
      hint: "Attach a document (notes, a syllabus, a textbook chapter) and Bermi will ground the course in it. Optional.",
    },
    {
      key: 'avoid',
      question: 'Anything to skip or avoid?',
      hint: "Topics already known, angles you don't want covered. Optional.",
    },
  ] as const

  const cur = steps[step]
  const canNext = cur.key !== 'topic' || data.topic.trim().length > 0
  const last = step === steps.length - 1

  const handleFile = async (file: File) => {
    setAttaching(true)
    setError(null)
    try {
      const att = await api.extractFile(file)
      setAttachment(att)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAttaching(false)
    }
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.learnQuickCreateCourse({
        topic: data.topic,
        audience: data.audience,
        level: data.level,
        objectives: data.objectives,
        avoid: data.avoid,
        material: attachment?.text || '',
      })
      onCreated(res.course.title)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-edge bg-surface-raised p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Sparkles size={16} className="text-primary" /> Build your own course
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-surface-sunken">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          {steps.map((s, i) => (
            <div key={s.key} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-surface-sunken'}`} />
          ))}
        </div>

        <p className="mb-1 text-[14.5px] font-medium text-ink">{cur.question}</p>
        <p className="mb-3 text-[12px] text-ink-faint">{cur.hint}</p>

        {cur.key === 'topic' && (
          <input
            autoFocus
            value={data.topic}
            onChange={(e) => setData({ ...data, topic: e.target.value })}
            placeholder="e.g. Photosynthesis, negotiation tactics, React hooks..."
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
          />
        )}

        {cur.key === 'audience' && (
          <div className="space-y-2.5">
            <input
              autoFocus
              value={data.audience}
              onChange={(e) => setData({ ...data, audience: e.target.value })}
              placeholder="Who is this for?"
              className="w-full rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  onClick={() => setData({ ...data, level: lv })}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
                    data.level === lv ? 'border-primary bg-primary-soft text-primary' : 'border-edge text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>
        )}

        {cur.key === 'objectives' && (
          <textarea
            autoFocus
            value={data.objectives}
            onChange={(e) => setData({ ...data, objectives: e.target.value })}
            placeholder={'One outcome per line (optional)'}
            className="min-h-[90px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
          />
        )}

        {cur.key === 'material' && (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {attachment ? (
              <div className="flex items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-2.5">
                <FileText size={16} className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="rounded p-1 text-ink-faint hover:bg-surface-sunken">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInput.current?.click()}
                disabled={attaching}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge px-3 py-3 text-[13px] font-medium text-ink-muted hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {attaching ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                {attaching ? 'Reading document…' : 'Attach a document'}
              </button>
            )}
          </div>
        )}

        {cur.key === 'avoid' && (
          <textarea
            autoFocus
            value={data.avoid}
            onChange={(e) => setData({ ...data, avoid: e.target.value })}
            placeholder="Optional"
            className="min-h-[70px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
          />
        )}

        {error && <p className="mt-3 text-[12px] text-rose-500">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken"
          >
            <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {last ? (
            <button
              onClick={submit}
              disabled={busy || !data.topic.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} {busy ? 'Building your course…' : 'Create course'}
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
