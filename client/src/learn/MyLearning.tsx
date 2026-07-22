import { useEffect, useState } from 'react'
import { GraduationCap, PlayCircle } from 'lucide-react'
import * as api from '../lib/api'
import type { Enrollment } from '../lib/types'
import { Btn, EmptyState, Pill, Spinner, type LearnRoute } from './ui'

export function MyLearning({ navigate }: { navigate: (r: LearnRoute) => void }) {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)

  useEffect(() => {
    api.learnMyEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
  }, [])

  if (!enrollments) return <Spinner label="Loading your learning…" />

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <h1 className="mb-1 text-[24px] font-bold text-ink">My learning</h1>
      <p className="mb-6 text-[14px] text-ink-muted">Courses you're enrolled in and your progress.</p>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={30} />}
          title="You haven't enrolled in anything yet"
          body="Browse the catalog and enroll in a course to start learning."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {enrollments.map((e) => {
            const course = e.course
            if (!course) return null
            const progress = e.progress || {}
            const doneCount = Object.values(progress).filter((p) => p.done).length
            return (
              <div key={e.id} className="flex flex-col rounded-2xl border border-edge bg-surface-raised p-5">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-2xl">
                    {course.cover_emoji || '📘'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold text-ink">{course.title}</h3>
                    <div className="mt-1">
                      {e.status === 'completed' ? (
                        <Pill tone="green">Completed{e.score != null ? ` · ${e.score}%` : ''}</Pill>
                      ) : e.status === 'applied' ? (
                        <Pill tone="amber">Pending approval</Pill>
                      ) : (
                        <Pill tone="primary">In progress</Pill>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mb-4 text-[12.5px] text-ink-faint">
                  {doneCount} {doneCount === 1 ? 'lesson' : 'lessons'} completed
                </p>
                <Btn size="sm" variant="outline" className="mt-auto" onClick={() => navigate({ name: 'course', id: course.id })}>
                  <PlayCircle size={15} /> {e.status === 'completed' ? 'Revisit' : 'Continue'}
                </Btn>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
