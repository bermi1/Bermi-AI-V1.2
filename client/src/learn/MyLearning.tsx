import { useEffect, useState } from 'react'
import { CalendarClock, GraduationCap, PlayCircle } from 'lucide-react'
import * as api from '../lib/api'
import type { Enrollment, OfferingKind } from '../lib/types'
import { Btn, EmptyState, Pill, Spinner, type LearnRoute } from './ui'

// A course, program, event, and resource are each a different kind of
// relationship to an organization's offering — this page groups by kind so
// "3/5 lessons done" (a course) doesn't sit next to "Registered" (an event)
// as if they meant the same thing.
const KIND_META: Record<OfferingKind, { section: string; doneWord: string; cta: string; revisitCta: string }> = {
  course: { section: 'Courses', doneWord: 'lesson', cta: 'Continue', revisitCta: 'Revisit' },
  program: { section: 'Programs', doneWord: 'step', cta: 'Continue', revisitCta: 'Revisit' },
  event: { section: 'Events', doneWord: '', cta: 'View details', revisitCta: 'View details' },
  resource: { section: 'Resources', doneWord: '', cta: 'Open', revisitCta: 'Open' },
}

function formatEventWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function MyLearning({ navigate }: { navigate: (r: LearnRoute) => void }) {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)

  useEffect(() => {
    api.learnMyEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
  }, [])

  if (!enrollments) return <Spinner label="Loading your activity…" />

  const byKind = new Map<OfferingKind, Enrollment[]>()
  for (const e of enrollments) {
    if (!e.course) continue
    const kind = e.course.kind || 'course'
    if (!byKind.has(kind)) byKind.set(kind, [])
    byKind.get(kind)!.push(e)
  }
  const order: OfferingKind[] = ['course', 'program', 'event', 'resource']
  const groups = order.filter((k) => byKind.get(k)?.length)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <h1 className="mb-1 text-[24px] font-bold text-ink">My activity</h1>
      <p className="mb-6 text-[14px] text-ink-muted">
        Everything you've enrolled in, registered for, or been given access to, and your progress.
      </p>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={30} />}
          title="You haven't joined anything yet"
          body="Browse the catalog and enroll, register, or get access to something to see it here."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((kind) => {
            const meta = KIND_META[kind]
            return (
              <section key={kind}>
                {groups.length > 1 && <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">{meta.section}</h2>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {byKind.get(kind)!.map((e) => {
                    const course = e.course
                    if (!course) return null
                    const progress = e.progress || {}
                    const doneCount = Object.values(progress).filter((p) => p.done).length
                    return (
                      <div key={e.id} className="flex flex-col rounded-2xl border border-edge bg-surface-raised p-5">
                        <div className="mb-3 flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-2xl">
                            {kind === 'event' ? <CalendarClock size={20} /> : course.cover_emoji || '📘'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[15px] font-semibold text-ink">{course.title}</h3>
                            <div className="mt-1">
                              {e.status === 'completed' ? (
                                <Pill tone="green">Completed{e.score != null ? ` · ${e.score}%` : ''}</Pill>
                              ) : e.status === 'applied' ? (
                                <Pill tone="amber">{kind === 'event' ? 'Registration requested' : 'Pending approval'}</Pill>
                              ) : kind === 'event' ? (
                                <Pill tone="green">Registered</Pill>
                              ) : kind === 'resource' ? (
                                <Pill tone="primary">Available</Pill>
                              ) : (
                                <Pill tone="primary">In progress</Pill>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mb-4 text-[12.5px] text-ink-faint">
                          {kind === 'event'
                            ? course.event_at
                              ? formatEventWhen(course.event_at)
                              : 'Date to be announced'
                            : kind === 'resource'
                              ? 'Ready whenever you are'
                              : `${doneCount} ${meta.doneWord}${doneCount === 1 ? '' : 's'} completed`}
                        </p>
                        <Btn size="sm" variant="outline" className="mt-auto" onClick={() => navigate({ name: 'course', id: course.id })}>
                          <PlayCircle size={15} /> {e.status === 'completed' ? meta.revisitCta : meta.cta}
                        </Btn>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
