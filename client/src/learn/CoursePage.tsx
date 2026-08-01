import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Building2, CalendarClock, CheckCircle2, Download, MapPin, MessageSquare, Wand2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Course, Enrollment, Lesson, OfferingKind } from '../lib/types'
import { Btn, ErrorNote, Pill, Spinner, handoffToStudy, type LearnRoute } from './ui'
import { Markdown } from '../components/Markdown'

const KIND_LABEL: Record<OfferingKind, string> = { course: 'Course', program: 'Program', event: 'Event', resource: 'Resource' }
const KIND_STEP_HEADING: Record<OfferingKind, string> = {
  course: 'Curriculum',
  program: 'Steps',
  event: 'Agenda',
  resource: 'Contents',
}
const KIND_STEP_SINGULAR: Record<OfferingKind, string> = {
  course: 'lesson',
  program: 'step',
  event: 'agenda item',
  resource: 'section',
}
const KIND_JOIN_VERB: Record<OfferingKind, string> = {
  course: 'Enroll',
  program: 'Enroll',
  event: 'Register',
  resource: 'Get access',
}

function formatEventWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function CoursePage({
  courseId,
  navigate,
}: {
  courseId: string
  navigate: (r: LearnRoute) => void
}) {
  const [data, setData] = useState<{
    course: Course
    institution: { name: string; slug: string; about: string } | null
    lessons: Lesson[]
    enrollment: Enrollment | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    api
      .learnCourse(courseId)
      .then(setData)
      .catch((e) => setError((e as Error).message))
  }, [courseId])

  if (error && !data) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorNote>{error}</ErrorNote></div>
  if (!data) return <Spinner label="Loading course…" />

  const { course, institution, lessons, enrollment } = data
  const kind: OfferingKind = course.kind || 'course'
  const enrolled = Boolean(enrollment)
  const progress = enrollment?.progress || {}
  const doneCount = lessons.filter((l) => progress[l.id]?.done).length
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0
  const joinVerb = KIND_JOIN_VERB[kind]
  const stepSingular = KIND_STEP_SINGULAR[kind]

  // Everything past "browse the catalog" happens in Bermi AI chat — joining,
  // teaching/guiding, evaluating. This portal never acts on anyone's behalf
  // itself; it just hands the request to chat, which does the right thing
  // for the kind (enroll, register, or grant access) in the same message.
  const continuePrompt =
    kind === 'event'
      ? `Tell me more about the event "${course.title}" and confirm my registration status.`
      : kind === 'resource'
        ? `Show me the resource "${course.title}" again.`
        : `Let's continue the ${kind} "${course.title}". Pick up where I left off and guide me through the next part.`
  const joinPrompt =
    kind === 'event'
      ? `I'd like to register for the event "${course.title}"` + (institution ? ` by ${institution.name}` : '') + `.` + (course.summary ? `\n\n${course.summary}` : '')
      : kind === 'resource'
        ? `I'd like to get the resource "${course.title}"` + (institution ? ` by ${institution.name}` : '') + `. Please give me access to it now.`
        : `I'd like to enroll in the ${kind} "${course.title}"` +
          (institution ? ` by ${institution.name}` : '') +
          `. Please enroll me and guide me through it${kind === 'course' ? ' step by step' : ''}.` +
          (course.summary ? `\n\nOverview: ${course.summary}` : '')

  const lessonPrompt = (lesson: Lesson) =>
    (enrolled ? '' : `${joinPrompt} `) +
    `Cover the ${stepSingular} "${lesson.title}" from "${course.title}" right now.`

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'landing' })}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Catalog
      </button>

      <div className="rounded-3xl border border-edge bg-surface-raised p-6 md:p-8">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-4xl">
            {course.cover_emoji || '📘'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Pill tone="primary">{kind === 'course' ? course.level || 'All levels' : KIND_LABEL[kind]}</Pill>
              {enrolled && enrollment?.status === 'completed' && <Pill tone="green"><CheckCircle2 size={12} /> Completed</Pill>}
              {enrolled && kind === 'event' && enrollment?.status !== 'completed' && <Pill tone="green"><CheckCircle2 size={12} /> Registered</Pill>}
            </div>
            <h1 className="text-[22px] font-bold leading-tight text-ink md:text-[26px]">{course.title}</h1>
            {institution && (
              <button
                onClick={() => navigate({ name: 'institution', slug: institution.slug })}
                className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-primary"
              >
                <Building2 size={13} /> {institution.name}
              </button>
            )}
          </div>
        </div>

        {course.summary && <p className="text-[14.5px] leading-relaxed text-ink-muted">{course.summary}</p>}

        {kind === 'event' && (course.event_at || course.event_location) && (
          <div className="mt-4 flex flex-wrap gap-4 text-[13.5px] text-ink-muted">
            {course.event_at && (
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} className="text-primary" /> {formatEventWhen(course.event_at)}</span>
            )}
            {course.event_location && (
              <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-primary" /> {course.event_location}</span>
            )}
          </div>
        )}

        {enrolled && kind !== 'event' && lessons.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-ink-muted">
              <span>Your progress</span>
              <span>{doneCount}/{lessons.length} {stepSingular}s · {pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Btn onClick={() => handoffToStudy({ title: course.title, prompt: enrolled ? continuePrompt : joinPrompt })} disabled={kind !== 'event' && kind !== 'resource' && !lessons.length}>
            <Wand2 size={17} /> {enrolled ? (kind === 'event' ? 'Ask about this event' : kind === 'resource' ? 'Open in Bermi AI' : 'Continue in Bermi AI') : `${joinVerb} in Bermi AI`}
          </Btn>
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </div>

      {course.description && (
        <div className="mt-6 rounded-3xl border border-edge bg-surface-raised p-6 md:p-8">
          <h2 className="mb-3 text-[16px] font-semibold text-ink">About this {kind}</h2>
          <Markdown>{course.description}</Markdown>
        </div>
      )}

      {kind !== 'event' && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-ink">
            <BookOpen size={17} /> {KIND_STEP_HEADING[kind]} · {lessons.length} {stepSingular}{lessons.length === 1 ? '' : 's'}
          </h2>
          <div className="space-y-2">
            {lessons.map((l, i) => {
              const done = progress[l.id]?.done
              return (
                <button
                  key={l.id}
                  onClick={() => handoffToStudy({ title: course.title, prompt: lessonPrompt(l) })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-3.5 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-muted">
                    {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{l.title}</span>
                  </span>
                  {l.attachment_url && <Download size={15} className="shrink-0 text-ink-faint" />}
                  <MessageSquare size={16} className="shrink-0 text-ink-faint" />
                </button>
              )
            })}
            {!lessons.length && (
              <p className="rounded-2xl border border-dashed border-edge px-4 py-8 text-center text-[13px] text-ink-faint">
                Nothing added here yet.
              </p>
            )}
          </div>
          {lessons.length > 0 && (
            <p className="mt-3 text-center text-[12.5px] text-ink-faint">
              <MessageSquare size={12} className="mr-1 inline" /> Every {stepSingular} opens inside Bermi AI chat.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
