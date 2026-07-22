import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react'
import * as api from '../lib/api'
import type { Course, Institution, InstitutionAnalytics, Lesson } from '../lib/types'
import { Btn, EmptyState, ErrorNote, Field, inputClass, Pill, Spinner, type LearnRoute } from './ui'

export function InstitutionStudio({ navigate }: { navigate: (r: LearnRoute) => void }) {
  const [institutions, setInstitutions] = useState<Institution[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const refresh = () =>
    api.learnMyInstitutions().then((list) => {
      setInstitutions(list)
      setActiveId((cur) => cur ?? list[0]?.id ?? null)
    })

  useEffect(() => {
    refresh().catch(() => setInstitutions([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!institutions) return <Spinner label="Loading your organization…" />

  const active = institutions.find((i) => i.id === activeId) || null

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'landing' })}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Portal home
      </button>

      {institutions.length === 0 ? (
        <CreateInstitution onCreated={refresh} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                <Building2 size={22} />
              </div>
              <div>
                {institutions.length > 1 ? (
                  <select
                    value={activeId ?? ''}
                    onChange={(e) => setActiveId(e.target.value)}
                    className="rounded-lg border border-edge bg-surface-raised px-2 py-1 text-[16px] font-bold text-ink"
                  >
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                ) : (
                  <h1 className="text-[20px] font-bold text-ink">{active?.name}</h1>
                )}
                <p className="text-[12.5px] text-ink-faint">Organization workspace</p>
              </div>
            </div>
            {active && (
              <a
                href={`/learn/i/${active.slug}`}
                onClick={(e) => { e.preventDefault(); navigate({ name: 'institution', slug: active.slug }) }}
                className="text-[13px] font-medium text-primary hover:underline"
              >
                View public page →
              </a>
            )}
          </div>

          {active && <StudioBody institution={active} navigate={navigate} />}

          <NewInstitutionInline onCreated={refresh} />
        </>
      )}
    </div>
  )
}

function CreateInstitution({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.learnCreateInstitution({ name, about, website })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-edge bg-surface-raised p-6 md:p-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Building2 size={24} />
      </div>
      <h1 className="text-[20px] font-bold text-ink">Set up your organization</h1>
      <p className="mb-5 mt-1 text-[13.5px] text-ink-muted">
        Publish courses the public can learn from, evaluate learners with AI, and issue certificates of completion.
      </p>
      <div className="space-y-4">
        <Field label="Organization name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Institute of Design" />
        </Field>
        <Field label="About" hint="Shown on your public page.">
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What your organization teaches and who it's for." />
        </Field>
        <Field label="Website (optional)">
          <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn onClick={submit} loading={busy} disabled={!name.trim()} className="w-full">
          Create organization
        </Btn>
      </div>
    </div>
  )
}

function NewInstitutionInline({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-primary">
        <Plus size={14} /> Add another organization
      </button>
    )
  return (
    <div className="mt-8">
      <CreateInstitution onCreated={() => { setOpen(false); onCreated() }} />
    </div>
  )
}

function StudioBody({ institution, navigate }: { institution: Institution; navigate: (r: LearnRoute) => void }) {
  const [tab, setTab] = useState<'courses' | 'analytics'>('courses')
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  if (editingCourse)
    return <CourseEditor course={editingCourse} onBack={() => setEditingCourse(null)} navigate={navigate} />

  return (
    <>
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-sunken p-1">
        {(['courses', 'analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold capitalize transition-colors ${
              tab === t ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            {t === 'courses' ? <Layers size={15} /> : <BarChart3 size={15} />} {t}
          </button>
        ))}
      </div>

      {tab === 'courses' ? (
        <CoursesTab institution={institution} onEdit={setEditingCourse} />
      ) : (
        <AnalyticsTab institutionId={institution.id} />
      )}
    </>
  )
}

function CoursesTab({ institution, onEdit }: { institution: Institution; onEdit: (c: Course) => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => api.learnInstitutionCourses(institution.id).then(setCourses).catch(() => setCourses([]))
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [institution.id])

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const c = await api.learnCreateCourse(institution.id, { title })
      setTitle('')
      setCreating(false)
      await refresh()
      onEdit(c)
    } finally {
      setBusy(false)
    }
  }

  if (!courses) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Courses</h2>
        <Btn size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus size={15} /> New course
        </Btn>
      </div>

      {creating && (
        <div className="mb-4 flex gap-2 rounded-2xl border border-edge bg-surface-raised p-3">
          <input
            autoFocus
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Course title"
          />
          <Btn size="sm" onClick={create} loading={busy} disabled={!title.trim()}>Create</Btn>
        </div>
      )}

      {courses.length === 0 && !creating ? (
        <EmptyState icon={<Layers size={28} />} title="No courses yet" body="Create your first course, add lessons, then publish it to the catalog." />
      ) : (
        <div className="space-y-2">
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => onEdit(c)}
              className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-3.5 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xl">{c.cover_emoji || '📘'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{c.title}</span>
                <span className="text-[12px] text-ink-faint">{c.level}</span>
              </span>
              {c.published ? <Pill tone="green"><Eye size={11} /> Published</Pill> : <Pill tone="amber"><EyeOff size={11} /> Draft</Pill>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AnalyticsTab({ institutionId }: { institutionId: string }) {
  const [data, setData] = useState<InstitutionAnalytics | null>(null)
  useEffect(() => { api.learnInstitutionAnalytics(institutionId).then(setData).catch(() => {}) }, [institutionId])
  if (!data) return <Spinner />

  const stats = [
    { label: 'Courses', value: data.courses, icon: <Layers size={16} /> },
    { label: 'Enrollments', value: data.enrollments, icon: <Users size={16} /> },
    { label: 'Completions', value: data.completions, icon: <CheckCircle2 size={16} /> },
    { label: 'Completion rate', value: `${data.completion_rate}%`, icon: <BarChart3 size={16} /> },
  ]

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-edge bg-surface-raised p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">{s.icon}</div>
            <div className="text-[24px] font-bold leading-none text-ink">{s.value}</div>
            <div className="mt-1 text-[12px] text-ink-faint">{s.label}</div>
          </div>
        ))}
      </div>

      <h3 className="mb-3 text-[14px] font-semibold text-ink">Per-course performance</h3>
      {data.per_course.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge px-4 py-8 text-center text-[13px] text-ink-faint">No data yet — publish a course and enroll learners.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-edge">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Course</th>
                <th className="px-3 py-2.5 text-right font-semibold">Enrolled</th>
                <th className="px-3 py-2.5 text-right font-semibold">Completed</th>
                <th className="px-4 py-2.5 text-right font-semibold">Avg. score</th>
              </tr>
            </thead>
            <tbody>
              {data.per_course.map((c) => (
                <tr key={c.id} className="border-t border-edge">
                  <td className="px-4 py-2.5 text-ink">
                    {c.title} {!c.published && <span className="text-ink-faint">(draft)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-muted">{c.enrollments}</td>
                  <td className="px-3 py-2.5 text-right text-ink-muted">{c.completions}</td>
                  <td className="px-4 py-2.5 text-right text-ink-muted">{c.avg_score != null ? `${c.avg_score}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const EMOJIS = ['📘', '📗', '📙', '🎓', '💡', '🧠', '⚗️', '💻', '🎨', '📊', '🔬', '🌍', '🏛️', '⚖️', '🩺', '🎵']

function CourseEditor({ course: initial, onBack, navigate }: { course: Course; onBack: () => void; navigate: (r: LearnRoute) => void }) {
  const [course, setCourse] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const patch = (p: Partial<Course>) => setCourse((c) => ({ ...c, ...p }))

  const save = async (extra?: Partial<Course>) => {
    setSaving(true)
    setError(null)
    const body = { ...course, ...extra }
    try {
      const updated = await api.learnUpdateCourse(course.id, {
        title: body.title,
        summary: body.summary,
        description: body.description,
        cover_emoji: body.cover_emoji,
        level: body.level,
        published: body.published,
        enrollment: body.enrollment,
      })
      setCourse(updated)
      setSavedAt(Date.now())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = () => save({ published: !course.published })

  const del = async () => {
    if (!confirm(`Delete "${course.title}"? This removes its lessons and enrollments.`)) return
    await api.learnDeleteCourse(course.id)
    onBack()
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink">
        <ArrowLeft size={15} /> All courses
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {course.published ? <Pill tone="green"><Eye size={11} /> Published</Pill> : <Pill tone="amber"><EyeOff size={11} /> Draft</Pill>}
          {savedAt && !saving && <span className="text-[12px] text-emerald-500">Saved</span>}
        </div>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="danger" onClick={del}><Trash2 size={14} /></Btn>
          <Btn size="sm" variant={course.published ? 'outline' : 'primary'} onClick={togglePublish} loading={saving}>
            {course.published ? <><EyeOff size={14} /> Unpublish</> : <><Eye size={14} /> Publish to catalog</>}
          </Btn>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-edge bg-surface-raised p-5 md:p-6">
        <div className="flex gap-3">
          <div>
            <span className="mb-1 block text-[12.5px] font-semibold text-ink-muted">Icon</span>
            <select
              value={course.cover_emoji || '📘'}
              onChange={(e) => patch({ cover_emoji: e.target.value })}
              className="h-[46px] w-16 rounded-xl border border-edge bg-surface-raised text-center text-2xl"
            >
              {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <Field label="Title">
              <input className={inputClass} value={course.title} onChange={(e) => patch({ title: e.target.value })} />
            </Field>
          </div>
        </div>
        <Field label="Short summary" hint="One line shown on catalog cards.">
          <input className={inputClass} value={course.summary || ''} onChange={(e) => patch({ summary: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Level">
            <select className={inputClass} value={course.level || 'All levels'} onChange={(e) => patch({ level: e.target.value })}>
              {['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Enrollment">
            <select className={inputClass} value={course.enrollment || 'open'} onChange={(e) => patch({ enrollment: e.target.value as 'open' | 'approval' })}>
              <option value="open">Open — anyone can join</option>
              <option value="approval">Requires approval</option>
            </select>
          </Field>
        </div>
        <Field label="Full description" hint="Markdown supported. Shown on the course page.">
          <textarea className={`${inputClass} min-h-[120px] resize-y`} value={course.description || ''} onChange={(e) => patch({ description: e.target.value })} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex items-center gap-3">
          <Btn onClick={() => save()} loading={saving}>Save details</Btn>
          <button onClick={() => navigate({ name: 'course', id: course.id })} className="text-[13px] font-medium text-primary hover:underline">
            Preview course page →
          </button>
        </div>
      </div>

      <LessonsManager courseId={course.id} />
    </div>
  )
}

function LessonsManager({ courseId }: { courseId: string }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => api.learnManageLessons(courseId).then(setLessons).catch(() => setLessons([]))
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courseId])

  const add = async () => {
    if (!newTitle.trim()) return
    setBusy(true)
    try {
      const l = await api.learnCreateLesson(courseId, { title: newTitle })
      setNewTitle('')
      await refresh()
      setOpenId(l.id)
    } finally {
      setBusy(false)
    }
  }

  if (!lessons) return <div className="mt-6"><Spinner /></div>

  return (
    <div className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Layers size={16} /> Lessons · {lessons.length}
      </h2>

      <div className="space-y-2">
        {lessons.map((l, i) =>
          openId === l.id ? (
            <LessonEditor
              key={l.id}
              lesson={l}
              index={i}
              onClose={() => setOpenId(null)}
              onChanged={refresh}
            />
          ) : (
            <button
              key={l.id}
              onClick={() => setOpenId(l.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-3 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[12px] font-semibold text-ink-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{l.title}</span>
              {l.content ? <Pill tone="green">Ready</Pill> : <Pill tone="amber">Empty</Pill>}
            </button>
          ),
        )}
      </div>

      <div className="mt-3 flex gap-2 rounded-2xl border border-dashed border-edge p-3">
        <input
          className={inputClass}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New lesson title…"
        />
        <Btn size="sm" onClick={add} loading={busy} disabled={!newTitle.trim()}>
          <Plus size={15} /> Add
        </Btn>
      </div>
    </div>
  )
}

function LessonEditor({
  lesson: initial,
  index,
  onClose,
  onChanged,
}: {
  lesson: Lesson
  index: number
  onClose: () => void
  onChanged: () => void
}) {
  const [lesson, setLesson] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (p: Partial<Lesson>) => setLesson((l) => ({ ...l, ...p }))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.learnUpdateLesson(lesson.id, { title: lesson.title, content: lesson.content, material: lesson.material })
      onChanged()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const aiDraft = async () => {
    setDrafting(true)
    setError(null)
    try {
      // Persist the latest material first so the server drafts from it.
      await api.learnUpdateLesson(lesson.id, { material: lesson.material })
      const updated = await api.learnAiDraftLesson(lesson.id, lesson.material)
      setLesson(updated)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDrafting(false)
    }
  }

  const del = async () => {
    if (!confirm('Delete this lesson?')) return
    await api.learnDeleteLesson(lesson.id)
    onChanged()
    onClose()
  }

  return (
    <div className="rounded-2xl border border-primary bg-surface-raised p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">{index + 1}</span>
        <input
          className="flex-1 rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-[14px] font-semibold text-ink outline-none focus:border-primary"
          value={lesson.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <Field label="Source material" hint="Paste notes, an outline, or raw text — Bermi turns it into a polished lesson.">
        <textarea
          className={`${inputClass} min-h-[90px] resize-y`}
          value={lesson.material || ''}
          onChange={(e) => patch({ material: e.target.value })}
          placeholder="Paste your teaching material here…"
        />
      </Field>

      <div className="my-3">
        <Btn size="sm" variant="outline" onClick={aiDraft} loading={drafting} disabled={!lesson.material?.trim()}>
          <Wand2 size={14} /> {lesson.content ? 'Redraft with AI' : 'Draft lesson with AI'}
        </Btn>
      </div>

      <Field label="Lesson content" hint="What learners read. Markdown supported.">
        <textarea
          className={`${inputClass} min-h-[160px] resize-y font-mono text-[13px]`}
          value={lesson.content || ''}
          onChange={(e) => patch({ content: e.target.value })}
          placeholder="Write the lesson, or generate it from your material above."
        />
      </Field>

      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-4 flex items-center justify-between">
        <Btn size="sm" variant="danger" onClick={del}><Trash2 size={14} /></Btn>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={save} loading={saving}>
            <Sparkles size={14} /> Save lesson
          </Btn>
        </div>
      </div>
    </div>
  )
}
