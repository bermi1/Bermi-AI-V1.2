import { useEffect, useState } from 'react'
import { GraduationCap, Loader2, Plus, Sparkles, X } from 'lucide-react'
import * as api from '../lib/api'
import type { Enrollment } from '../lib/types'

export function MyLearningPanel({ onStudyCourse }: { onStudyCourse: (title: string) => void }) {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)
  const [buildOpen, setBuildOpen] = useState(false)

  const refresh = () => api.learnMyEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
  useEffect(() => {
    refresh()
  }, [])

  if (!enrollments) return null
  if (enrollments.length === 0 && !buildOpen) {
    return (
      <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <GraduationCap size={17} className="text-primary" />
          <h2 className="text-[15px] font-semibold tracking-tight">My learning</h2>
        </div>
        <p className="mb-3 text-[13.5px] text-ink-muted">
          Ask Bermi to enroll you in a course, or build your own module — you learn entirely in chat.
        </p>
        <button
          onClick={() => setBuildOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={14} /> Build a course
        </button>
        {buildOpen && <BuildCourseModal onClose={() => setBuildOpen(false)} onCreated={refresh} />}
      </section>
    )
  }

  return (
    <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap size={17} className="text-primary" />
          <h2 className="text-[15px] font-semibold tracking-tight">My learning</h2>
        </div>
        <button
          onClick={() => setBuildOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken"
        >
          <Plus size={13} /> Build a course
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {enrollments.map((e) => {
          const course = e.course
          if (!course) return null
          const progress = e.progress || {}
          const done = Object.values(progress).filter((p) => p.done).length
          return (
            <button
              key={e.id}
              onClick={() => onStudyCourse(course.title)}
              className="flex items-start gap-3 rounded-xl border border-edge bg-surface p-3.5 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xl">
                {course.cover_emoji || '📘'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{course.title}</span>
                <span className="text-[11.5px] text-ink-faint">
                  {e.status === 'completed' ? `Completed${e.score != null ? ` · ${e.score}%` : ''}` : `${done} lessons done`}
                </span>
              </span>
              <span className="shrink-0 self-center text-[11.5px] font-semibold text-primary">Study →</span>
            </button>
          )
        })}
      </div>
      {buildOpen && <BuildCourseModal onClose={() => setBuildOpen(false)} onCreated={refresh} />}
    </section>
  )
}

function BuildCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [objectives, setObjectives] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.learnQuickCreateCourse({ title, objectives })
      onCreated()
      onClose()
      window.location.assign('/portal')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-edge bg-surface-raised p-5 shadow-xl"
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
        <p className="mb-3 text-[13px] text-ink-muted">
          Give it a title and what you want it to teach. Bermi drafts a module structure — you can edit it, add
          materials, and publish from the organization portal.
        </p>
        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Course title"
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
          />
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder={'Learning objectives, one per line (optional — Bermi can infer them)'}
            className="min-h-[80px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
          />
          {error && <p className="text-[12px] text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Create course
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
