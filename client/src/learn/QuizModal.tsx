import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RotateCcw, X, XCircle } from 'lucide-react'
import * as api from '../lib/api'
import type { QuizQuestion, QuizSubmitResponse } from '../lib/types'
import { Btn, ErrorNote } from './ui'

// A real, gradeable quiz — separate from (and a hard backstop to) the AI's
// own conversational mastery judgement in chat. Passing (>=threshold) is
// what actually unlocks the next lesson server-side; failing shows exactly
// which answers were wrong so the learner can genuinely close the gap
// before retaking, rather than just re-guessing.
export function QuizModal({
  lessonId,
  lessonTitle,
  onClose,
  onPassed,
}: {
  lessonId: string
  lessonTitle: string
  onClose: () => void
  onPassed: () => void
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QuizSubmitResponse | null>(null)

  function loadQuiz() {
    setLoading(true)
    setError(null)
    setResult(null)
    api
      .learnLessonQuiz(lessonId)
      .then((r) => {
        setQuestions(r.questions)
        setAnswers(r.questions.map(() => null))
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(loadQuiz, [lessonId])

  const allAnswered = questions != null && answers.length === questions.length && answers.every((a) => a != null)

  async function submit() {
    if (!allAnswered) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await api.learnSubmitQuiz(lessonId, answers as number[])
      setResult(r)
      if (r.passed) onPassed()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-edge bg-surface-raised sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-edge px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">Quiz</p>
            <h2 className="truncate text-[15px] font-bold text-ink">{lessonTitle}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-faint">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-[13px]">Preparing your quiz…</span>
            </div>
          )}

          {error && !loading && (
            <div className="space-y-3">
              <ErrorNote>{error}</ErrorNote>
              <Btn variant="outline" size="sm" onClick={loadQuiz}>
                <RotateCcw size={14} /> Try again
              </Btn>
            </div>
          )}

          {!loading && !error && questions && !result && (
            <div className="space-y-5">
              {questions.map((q, qi) => (
                <div key={qi}>
                  <p className="mb-2 text-[14px] font-semibold text-ink">
                    {qi + 1}. {q.q}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                        className={`block w-full rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition-colors ${
                          answers[qi] === oi
                            ? 'border-primary bg-primary-soft text-ink'
                            : 'border-edge text-ink-muted hover:border-edge-strong hover:bg-surface-sunken'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <div
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                  result.passed
                    ? 'border-emerald-500/30 bg-emerald-500/8'
                    : 'border-rose-500/30 bg-rose-500/8'
                }`}
              >
                {result.passed ? (
                  <CheckCircle2 size={22} className="shrink-0 text-emerald-500" />
                ) : (
                  <XCircle size={22} className="shrink-0 text-rose-500" />
                )}
                <div>
                  <p className={`text-[14.5px] font-bold ${result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {result.score}% — {result.passed ? 'Passed' : 'Not quite yet'}
                  </p>
                  <p className="text-[12.5px] text-ink-muted">
                    {result.passed
                      ? 'Lesson complete — the next one is unlocked.'
                      : `You need ${result.threshold}% to pass. Review what you missed below, then retake.`}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {result.results.map((r, i) => (
                  <div key={i} className="rounded-xl border border-edge px-3.5 py-3">
                    <p className="mb-1.5 flex items-start gap-2 text-[13.5px] font-medium text-ink">
                      {r.correct ? (
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
                      )}
                      {r.q}
                    </p>
                    {!r.correct && (
                      <div className="ml-[23px] space-y-0.5 text-[12.5px]">
                        <p className="text-rose-600 dark:text-rose-400">
                          Your answer: {r.chosen >= 0 ? r.options[r.chosen] : '(no answer)'}
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-400">Correct answer: {r.options[r.correctIndex]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-edge px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {result ? (
            result.passed ? (
              <Btn className="w-full" onClick={onClose}>
                Continue
              </Btn>
            ) : (
              <Btn className="w-full" variant="outline" onClick={loadQuiz}>
                <RotateCcw size={15} /> Retake quiz
              </Btn>
            )
          ) : (
            !loading &&
            !error &&
            questions && (
              <Btn className="w-full" onClick={submit} disabled={!allAnswered} loading={submitting}>
                Submit quiz
              </Btn>
            )
          )}
        </div>
      </div>
    </div>
  )
}
