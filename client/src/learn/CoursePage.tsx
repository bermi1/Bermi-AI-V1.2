import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Building2, CheckCircle2, Download, ListChecks, Lock, MessageSquare, Wand2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Course, Enrollment, Lesson, OfferingKind } from '../lib/types'
import { CourseIcon } from '../lib/courseIcons'
import { Btn, ErrorNote, Pill, Spinner, handoffToStudy, type LearnRoute } from './ui'
import { Markdown } from '../components/Markdown'
import { QuizModal } from './QuizModal'

const KIND_LABEL: Record<OfferingKind, string> = { course: 'Course', program: 'Program', resource: 'Resource' }
const KIND_STEP_HEADING: Record<OfferingKind, string> = {
  course: 'Curriculum',
  program: 'Steps',
  resource: 'Contents',
}
const KIND_STEP_SINGULAR: Record<OfferingKind, string> = {
  course: 'lesson',
  program: 'step',
  resource: 'section',
}
const KIND_JOIN_VERB: Record<OfferingKind, string> = {
  course: 'Enroll',
  program: 'Enroll',
  resource: 'Get access',
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
  const [quizLesson, setQuizLesson] = useState<Lesson | null>(null)

  function reload() {
    return api.learnCourse(courseId).then(setData)
  }

  useEffect(() => {
    setData(null)
    setError(null)
    reload().catch((e) => setError((e as Error).message))
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
    kind === 'resource'
      ? `Show me the resource "${course.title}" again.`
      : `Let's continue the ${kind} "${course.title}". Pick up where I left off and guide me through the next part.`
  const joinPrompt =
    kind === 'resource'
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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CourseIcon name={course.cover_emoji} size={30} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Pill tone="primary">{kind === 'course' ? course.level || 'All levels' : KIND_LABEL[kind]}</Pill>
              {enrolled && enrollment?.status === 'completed' && <Pill tone="green"><CheckCircle2 size={12} /> Completed</Pill>}
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

        {enrolled && lessons.length > 0 && (
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
          <Btn onClick={() => handoffToStudy({ title: course.title, prompt: enrolled ? continuePrompt : joinPrompt })} disabled={kind !== 'resource' && !lessons.length}>
            <Wand2 size={17} /> {enrolled ? (kind === 'resource' ? 'Open in Bermi AI' : 'Continue in Bermi AI') : `${joinVerb} in Bermi AI`}
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

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-ink">
          <BookOpen size={17} /> {KIND_STEP_HEADING[kind]} · {lessons.length} {stepSingular}{lessons.length === 1 ? '' : 's'}
        </h2>
        <div className="space-y-2">
          {lessons.map((l, i) => {
            const done = progress[l.id]?.done
            // Only courses are hard mastery-gated (quiz + in-order) — a
              // program/resource's steps stay freely browsable, matching
              // their lighter "plain confirmation" evaluation model.
              const locked = kind === 'course' && enrolled && i > 0 && !done && !progress[lessons[i - 1].id]?.done
              if (locked) {
                return (
                  <div
                    key={l.id}
                    className="flex w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-dashed border-edge px-4 py-3.5 opacity-60"
                    title={`Complete "${lessons[i - 1].title}" first`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-faint">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink-faint">{l.title}</span>
                      <span className="block truncate text-[11.5px] text-ink-faint">Complete "{lessons[i - 1].title}" first</span>
                    </span>
                    <Lock size={15} className="shrink-0 text-ink-faint" />
                  </div>
                )
              }
              return (
                <div
                  key={l.id}
                  className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-3.5 transition-colors hover:border-primary hover:bg-primary-soft/40"
                >
                  <button
                    onClick={() => handoffToStudy({ title: course.title, prompt: lessonPrompt(l) })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-muted">
                      {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{l.title}</span>
                    </span>
                  </button>
                  {l.attachment_url && <Download size={15} className="shrink-0 text-ink-faint" />}
                  {kind === 'course' && enrolled && !done && (
                    <button
                      onClick={() => setQuizLesson(l)}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-edge-strong px-2 py-1 text-[11.5px] font-semibold text-ink-muted hover:border-primary hover:text-primary"
                      title="Take the quiz to complete this lesson"
                    >
                      <ListChecks size={13} /> Quiz
                    </button>
                  )}
                  <button onClick={() => handoffToStudy({ title: course.title, prompt: lessonPrompt(l) })} title="Study in Bermi AI chat">
                    <MessageSquare size={16} className="shrink-0 text-ink-faint hover:text-primary" />
                  </button>
                </div>
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
              {kind === 'course' ? (
                <>
                  <ListChecks size={12} className="mr-1 inline" /> Pass each quiz to unlock the next lesson — or{' '}
                  <MessageSquare size={12} className="mx-0.5 mb-0.5 inline" /> study it in Bermi AI chat first.
                </>
              ) : (
                <>
                  <MessageSquare size={12} className="mr-1 inline" /> Every {stepSingular} opens inside Bermi AI chat.
                </>
              )}
            </p>
          )}
          {quizLesson && (
            <QuizModal
              lessonId={quizLesson.id}
              lessonTitle={quizLesson.title}
              onClose={() => setQuizLesson(null)}
              onPassed={() => {
                reload().catch(() => {})
              }}
            />
          )}
      </div>
    </div>
  )
}
