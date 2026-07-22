import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Building2, CheckCircle2, Lock, PlayCircle } from 'lucide-react'
import * as api from '../lib/api'
import type { Course, Enrollment, Lesson } from '../lib/types'
import { Btn, ErrorNote, Pill, Spinner, type LearnRoute } from './ui'
import { Markdown } from '../components/Markdown'

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
  const [enrolling, setEnrolling] = useState(false)

  const load = () =>
    api
      .learnCourse(courseId)
      .then(setData)
      .catch((e) => setError((e as Error).message))

  useEffect(() => {
    setData(null)
    setError(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const enroll = async () => {
    setEnrolling(true)
    setError(null)
    try {
      await api.learnEnroll(courseId)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnrolling(false)
    }
  }

  if (error && !data) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorNote>{error}</ErrorNote></div>
  if (!data) return <Spinner label="Loading course…" />

  const { course, institution, lessons, enrollment } = data
  const enrolled = Boolean(enrollment)
  const progress = enrollment?.progress || {}
  const doneCount = lessons.filter((l) => progress[l.id]?.done).length
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0

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
              <Pill tone="primary">{course.level || 'All levels'}</Pill>
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
              <span>{doneCount}/{lessons.length} lessons · {pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!enrolled ? (
            <Btn onClick={enroll} loading={enrolling}>
              <PlayCircle size={17} /> Enroll — it's free
            </Btn>
          ) : (
            <Btn
              onClick={() => {
                const next = lessons.find((l) => !progress[l.id]?.done) || lessons[0]
                if (next) navigate({ name: 'study', courseId: course.id, lessonId: next.id })
              }}
              disabled={!lessons.length}
            >
              <PlayCircle size={17} /> {doneCount ? 'Continue learning' : 'Start learning'}
            </Btn>
          )}
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </div>

      {course.description && (
        <div className="mt-6 rounded-3xl border border-edge bg-surface-raised p-6 md:p-8">
          <h2 className="mb-3 text-[16px] font-semibold text-ink">About this course</h2>
          <Markdown>{course.description}</Markdown>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-ink">
          <BookOpen size={17} /> Curriculum · {lessons.length} lessons
        </h2>
        <div className="space-y-2">
          {lessons.map((l, i) => {
            const done = progress[l.id]?.done
            return (
              <button
                key={l.id}
                disabled={!enrolled}
                onClick={() => navigate({ name: 'study', courseId: course.id, lessonId: l.id })}
                className={`flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-3.5 text-left transition-colors ${
                  enrolled ? 'hover:border-primary hover:bg-primary-soft/40' : 'cursor-default'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-muted">
                  {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{l.title}</span>
                </span>
                {enrolled ? (
                  <PlayCircle size={17} className="shrink-0 text-ink-faint" />
                ) : (
                  <Lock size={15} className="shrink-0 text-ink-faint" />
                )}
              </button>
            )
          })}
          {!lessons.length && (
            <p className="rounded-2xl border border-dashed border-edge px-4 py-8 text-center text-[13px] text-ink-faint">
              This course doesn't have any lessons yet.
            </p>
          )}
        </div>
        {!enrolled && lessons.length > 0 && (
          <p className="mt-3 text-center text-[12.5px] text-ink-faint">
            <Lock size={12} className="mr-1 inline" /> Enroll to unlock lesson content, AI tutoring, and your certificate.
          </p>
        )}
      </div>
    </div>
  )
}
