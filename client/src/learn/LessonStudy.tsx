import { useEffect, useState } from 'react'
import { ArrowLeft, Award, Brain, CheckCircle2, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Certificate, Lesson, QuizQuestion } from '../lib/types'
import { Btn, ErrorNote, Pill, Spinner, handoffToStudy, type LearnRoute } from './ui'
import { Markdown } from '../components/Markdown'

type Phase = 'read' | 'quiz' | 'result'

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

  const [phase, setPhase] = useState<Phase>('read')
  const [quiz, setQuiz] = useState<{ questions: QuizQuestion[]; key: number[] } | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [scorePct, setScorePct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setLesson(null)
    setError(null)
    setPhase('read')
    setQuiz(null)
    setAnswers({})
    setScorePct(null)
    setCertificate(null)
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

  const startQuiz = async () => {
    setQuizLoading(true)
    setError(null)
    try {
      const q = await api.learnLessonQuiz(lessonId)
      setQuiz(q)
      setAnswers({})
      setPhase('quiz')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setQuizLoading(false)
    }
  }

  const submitQuiz = async () => {
    if (!quiz) return
    let correct = 0
    quiz.questions.forEach((_, i) => {
      if (answers[i] === quiz.key[i]) correct++
    })
    const pct = Math.round((correct / quiz.questions.length) * 100)
    setScorePct(pct)
    setPhase('result')
    await finish(pct)
  }

  const finish = async (pct?: number) => {
    setSaving(true)
    setError(null)
    try {
      const res = await api.learnCompleteLesson(lessonId, pct)
      setDone(true)
      if (res.certificate) setCertificate(res.certificate)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !lesson) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorNote>{error}</ErrorNote></div>
  if (!lesson) return <Spinner label="Opening lesson…" />

  const idx = siblings.findIndex((l) => l.id === lessonId)
  const nextLesson = idx >= 0 ? siblings[idx + 1] : undefined

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

      {phase === 'read' && (
        <>
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
                    `. Be my tutor: teach me this material step by step, check my understanding as we go, and quiz me at the end.\n\n--- LESSON MATERIAL ---\n${(lesson.content || lesson.material || '').slice(0, 8000)}`,
                })
              }
            >
              <Wand2 size={17} /> Study in Bermi AI
            </Btn>
            <Btn variant="outline" onClick={startQuiz} loading={quizLoading}>
              <Brain size={16} /> Take the quiz
            </Btn>
            <Btn variant="ghost" onClick={() => finish()} loading={saving} disabled={done}>
              <CheckCircle2 size={16} /> {done ? 'Completed' : 'Mark complete'}
            </Btn>
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">
            <Sparkles size={12} className="mr-1 inline" /> Study Mode opens this lesson in Bermi AI as a hands-on tutor.
            The quiz here is generated from the lesson and averages into your course grade.
          </p>
        </>
      )}

      {phase === 'quiz' && quiz && (
        <div className="space-y-5">
          {quiz.questions.map((q, qi) => (
            <div key={qi} className="rounded-3xl border border-edge bg-surface-raised p-5 md:p-6">
              <p className="mb-3 text-[15px] font-semibold text-ink">
                {qi + 1}. {q.q}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[14px] transition-colors ${
                      answers[qi] === oi
                        ? 'border-primary bg-primary-soft text-ink'
                        : 'border-edge text-ink-muted hover:border-edge-strong'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                      answers[qi] === oi ? 'border-primary bg-primary text-white' : 'border-edge-strong'
                    }`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Btn onClick={submitQuiz} disabled={Object.keys(answers).length < quiz.questions.length}>
            Submit answers
          </Btn>
        </div>
      )}

      {phase === 'result' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-edge bg-surface-raised p-8 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Award size={28} />
            </div>
            <p className="text-[13px] font-medium text-ink-muted">You scored</p>
            <p className="text-[44px] font-bold leading-none text-ink">{scorePct}%</p>
            <p className="mt-2 text-[13px] text-ink-muted">
              {scorePct != null && scorePct >= 70 ? 'Great work — lesson complete.' : 'Lesson recorded — review and retry anytime to raise your grade.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Btn variant="outline" size="sm" onClick={() => { setPhase('read'); setScorePct(null) }}>
                <RotateCcw size={14} /> Review lesson
              </Btn>
              {nextLesson ? (
                <Btn size="sm" onClick={() => navigate({ name: 'study', courseId, lessonId: nextLesson.id })}>
                  Next lesson →
                </Btn>
              ) : (
                <Btn size="sm" onClick={() => navigate({ name: 'course', id: courseId })}>
                  Back to course
                </Btn>
              )}
            </div>
          </div>

          {certificate && (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/8 p-6 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Award size={22} />
              </div>
              <h3 className="text-[16px] font-bold text-ink">🎉 You've earned your certificate!</h3>
              <p className="mt-1 text-[13px] text-ink-muted">
                Certificate of completion for <strong>{certificate.course_title}</strong>, issued by{' '}
                {certificate.institution_name} via Bermi.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Btn size="sm" onClick={() => navigate({ name: 'certificate', code: certificate.code })}>
                  View certificate
                </Btn>
                <a href={api.learnCertificatePdfUrl(certificate.code)} target="_blank" rel="noreferrer">
                  <Btn size="sm" variant="outline">Download PDF</Btn>
                </a>
              </div>
            </div>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      )}
    </div>
  )
}
