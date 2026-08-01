import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, MessageSquare, Sparkles, Wand2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Lesson } from '../lib/types'
import { Btn, ErrorNote, Pill, Spinner, handoffToStudy, type LearnRoute } from './ui'
import { Markdown } from '../components/Markdown'

// A read-only lesson preview for browsing (reached from a course's public
// curriculum list). Actual teaching, evaluation and progress-tracking all
// happen in Bermi AI chat — this page never marks anything complete itself.
export function LessonStudy({
  courseId,
  lessonId,
  navigate,
}: {
  courseId: string
  lessonId: string
  navigate: (r: LearnRoute) => void
}) {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [siblings, setSiblings] = useState<Lesson[]>([])
  const [courseMeta, setCourseMeta] = useState<{ title: string; institution: string }>({ title: '', institution: '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setLesson(null)
    setError(null)
    setDone(false)
    Promise.all([api.learnLessonStudy(lessonId), api.learnCourse(courseId)])
      .then(([study, course]) => {
        setLesson(study.lesson)
        setSiblings(course.lessons)
        setCourseMeta({ title: course.course.title, institution: course.institution?.name || '' })
        setDone(Boolean(study.enrollment.progress?.[lessonId]?.done))
      })
      .catch((e) => setError((e as Error).message))
  }, [lessonId, courseId])

  if (error && !lesson) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorNote>{error}</ErrorNote></div>
  if (!lesson) return <Spinner label="Opening lesson…" />

  const idx = siblings.findIndex((l) => l.id === lessonId)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'course', id: courseId })}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to course
      </button>

      <div className="mb-2 flex items-center gap-2 text-[12.5px] text-ink-faint">
        <span>Lesson {idx + 1} of {siblings.length}</span>
        {done && <Pill tone="green"><CheckCircle2 size={12} /> Completed</Pill>}
      </div>
      <h1 className="mb-6 text-[24px] font-bold leading-tight text-ink md:text-[28px]">{lesson.title}</h1>

      <div className="rounded-3xl border border-edge bg-surface-raised p-6 md:p-8">
        {lesson.content ? (
          <Markdown>{lesson.content}</Markdown>
        ) : (
          <p className="text-[14px] text-ink-muted">{lesson.material || 'No content for this lesson yet.'}</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Btn
          onClick={() =>
            handoffToStudy({
              title: lesson.title,
              prompt:
                `I'm learning the lesson "${lesson.title}"` +
                (courseMeta.title ? ` from the course "${courseMeta.title}"` : '') +
                (courseMeta.institution ? ` by ${courseMeta.institution}` : '') +
                `. Enroll me if I'm not already, then be my tutor: teach me this material step by step, test my ` +
                `understanding as we go, and don't move on until I've actually demonstrated I've got it.\n\n` +
                `--- LESSON MATERIAL ---\n${(lesson.content || lesson.material || '').slice(0, 8000)}`,
            })
          }
        >
          <Wand2 size={17} /> Study in Bermi AI
        </Btn>
      </div>
      <p className="mt-3 text-[12px] text-ink-faint">
        <Sparkles size={12} className="mr-1 inline" /> This is a preview. Teaching, quizzing, and marking a lesson
        complete all happen in Bermi AI chat — <MessageSquare size={12} className="mx-0.5 mb-0.5 inline" /> nothing
        here counts as progress until you've actually studied it there.
      </p>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
    </div>
  )
}
