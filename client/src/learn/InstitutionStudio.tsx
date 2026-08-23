import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Home,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Video,
  Wand2,
  X,
} from 'lucide-react'
import * as api from '../lib/api'
import type {
  Course,
  Institution,
  InstitutionAnalytics,
  InstitutionLearner,
  Lesson,
  OfferingKind,
  OrgType,
} from '../lib/types'
import { Btn, EmptyState, ErrorNote, Field, inputClass, Pill, Spinner, type LearnRoute } from './ui'

// Org types tailor language and AI defaults only — every type can still
// publish any offering kind below.
const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: 'education', label: 'School / educational institution' },
  { value: 'business', label: 'Business / company' },
  { value: 'nonprofit', label: 'NGO / nonprofit' },
  { value: 'government', label: 'Government / public body' },
  { value: 'community', label: 'Community group / association' },
  { value: 'media', label: 'Media outlet' },
  { value: 'other', label: 'Other' },
]

// What this organization can publish — not every org has a curriculum to
// teach, but every org has something to reach the public or its members
// with.
const OFFERING_KINDS: { value: OfferingKind; label: string; hint: string }[] = [
  { value: 'course', label: 'Course', hint: 'Taught step by step, with a mastery check before advancing.' },
  { value: 'program', label: 'Program', hint: 'A structured process to guide someone through — an application, onboarding, initiative.' },
  { value: 'event', label: 'Event', hint: 'Something to register/RSVP for — a briefing, workshop, AGM, webinar.' },
  { value: 'resource', label: 'Resource', hint: 'A report, guide, or policy explainer the public should get and understand.' },
]
const KIND_STEP_LABEL: Record<OfferingKind, string> = {
  course: 'Lessons',
  program: 'Steps',
  event: 'Agenda',
  resource: 'Sections',
}
const KIND_STEP_SINGULAR: Record<OfferingKind, string> = {
  course: 'Lesson',
  program: 'Step',
  event: 'Agenda item',
  resource: 'Section',
}

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

          {active && <StudioBody institution={active} navigate={navigate} onInstitutionUpdated={refresh} />}

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
  const [orgType, setOrgType] = useState<OrgType>('education')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.learnCreateInstitution({ name, about, website, org_type: orgType })
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
        Any organization can use this — a school publishing courses, a bank or NGO walking people through a
        program, a company or public body running an event, or anyone with a resource the public should have.
        Bermi AI teaches, guides, informs, or delivers it — whichever fits — and evaluates engagement for you.
      </p>
      <div className="space-y-4">
        <Field label="What kind of organization is this?" hint="Tailors the language and AI defaults — every type can still publish any kind of offering.">
          <select className={inputClass} value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
            {ORG_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Organization name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Institute of Design" />
        </Field>
        <Field label="About" hint="Shown on your public page.">
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What your organization does and who it's for." />
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

const TABS = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'courses', label: 'Courses', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'learners', label: 'Learners', icon: Users },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const
type Tab = (typeof TABS)[number]['id']

function StudioBody({
  institution,
  navigate,
  onInstitutionUpdated,
}: {
  institution: Institution
  navigate: (r: LearnRoute) => void
  onInstitutionUpdated: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  if (editingCourse)
    return <CourseEditor course={editingCourse} onBack={() => setEditingCourse(null)} navigate={navigate} />

  return (
    <>
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface-sunken p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
              tab === t.id ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab institutionId={institution.id} onViewCourses={() => setTab('courses')} />}
      {tab === 'courses' && <CoursesTab institution={institution} onEdit={setEditingCourse} />}
      {tab === 'analytics' && <AnalyticsTab institutionId={institution.id} />}
      {tab === 'learners' && <LearnersTab institutionId={institution.id} />}
      {tab === 'settings' && <SettingsTab institution={institution} onUpdated={onInstitutionUpdated} />}
    </>
  )
}

// ---------- Overview ----------

function OverviewTab({ institutionId, onViewCourses }: { institutionId: string; onViewCourses: () => void }) {
  const [data, setData] = useState<InstitutionAnalytics | null>(null)
  useEffect(() => { api.learnInstitutionAnalytics(institutionId).then(setData).catch(() => {}) }, [institutionId])
  if (!data) return <Spinner />

  const stats = [
    { label: 'Courses', value: data.courses, icon: <Layers size={16} /> },
    { label: 'Enrollments', value: data.enrollments, icon: <Users size={16} /> },
    { label: 'Completion rate', value: `${data.completion_rate}%`, icon: <CheckCircle2 size={16} /> },
    { label: 'Avg. understanding', value: data.avg_understanding != null ? `${data.avg_understanding}%` : '—', icon: <Target size={16} /> },
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

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              <BarChart3 size={15} className="text-primary" /> Top courses
            </h3>
            <button onClick={onViewCourses} className="text-[12.5px] font-medium text-primary hover:underline">
              Manage all →
            </button>
          </div>
          {data.top_courses.length === 0 ? (
            <EmptyState icon={<Layers size={24} />} title="No courses yet" />
          ) : (
            <div className="space-y-2">
              {data.top_courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-edge bg-surface-raised px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{c.title}</span>
                  <span className="shrink-0 text-[12px] text-ink-faint">{c.enrollments} enrolled · {c.completions} done</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <Activity size={15} className="text-primary" /> Recent activity
          </h3>
          {data.recent_activity.length === 0 ? (
            <EmptyState icon={<Activity size={24} />} title="Nothing yet" body="Enrollments and completions will show up here." />
          ) : (
            <div className="space-y-2">
              {data.recent_activity.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-[13px]">
                  {a.type === 'completed' ? (
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                  ) : (
                    <UserCheck size={14} className="shrink-0 text-primary" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-ink-muted">
                    <span className="font-medium text-ink">{a.learner}</span>{' '}
                    {a.type === 'completed' ? 'completed' : 'enrolled in'} <span className="text-ink">{a.course}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(a.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ---------- Learners directory (cross-course) ----------

function LearnersTab({ institutionId }: { institutionId: string }) {
  const [learners, setLearners] = useState<InstitutionLearner[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => {
      api.learnInstitutionLearners(institutionId, query || undefined).then(setLearners).catch(() => setLearners([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [institutionId, query])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search learners…"
            className="w-full rounded-xl border border-edge bg-surface-raised py-2 pl-8 pr-3 text-[13.5px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
        <a
          href={api.learnLearnersExportUrl(institutionId)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-edge-strong px-3 py-2 text-[13px] font-semibold text-ink hover:bg-surface-sunken"
        >
          <Download size={14} /> Export CSV
        </a>
      </div>

      {!learners ? (
        <Spinner />
      ) : learners.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title={query ? 'No learners match your search' : 'No learners yet'} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-edge">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Learner</th>
                <th className="px-3 py-2.5 text-right font-semibold">Courses</th>
                <th className="px-3 py-2.5 text-right font-semibold">Completed</th>
                <th className="px-3 py-2.5 text-right font-semibold">Understanding</th>
                <th className="px-4 py-2.5 text-right font-semibold">AI-dependency</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.user_id} className="border-t border-edge bg-surface-raised">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{l.name}</div>
                    <div className="text-[11.5px] text-ink-faint">{l.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-muted">{l.total_courses}</td>
                  <td className="px-3 py-2.5 text-right text-ink-muted">{l.completed}</td>
                  <td className="px-3 py-2.5 text-right">
                    {l.avg_understanding != null ? (
                      <span className={l.avg_understanding >= 70 ? 'text-emerald-600 dark:text-emerald-400' : l.avg_understanding >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
                        {l.avg_understanding}%
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-muted">{l.avg_dependency != null ? `${l.avg_dependency}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Settings ----------

function SettingsTab({ institution, onUpdated }: { institution: Institution; onUpdated: () => void }) {
  const [name, setName] = useState(institution.name)
  const [about, setAbout] = useState(institution.about || '')
  const [website, setWebsite] = useState(institution.website || '')
  const [logoUrl, setLogoUrl] = useState(institution.logo_url || '')
  const [orgType, setOrgType] = useState<OrgType>(institution.org_type || 'education')
  const [published, setPublished] = useState(institution.published)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.learnUpdateInstitution(institution.id, { name, about, website, logo_url: logoUrl, published, org_type: orgType })
      setSavedAt(Date.now())
      onUpdated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-3xl border border-edge bg-surface-raised p-5 md:p-6">
      <Field label="What kind of organization is this?">
        <select className={inputClass} value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
          {ORG_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Organization name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="About" hint="Shown on your public digital library page.">
        <textarea className={`${inputClass} min-h-[80px] resize-y`} value={about} onChange={(e) => setAbout(e.target.value)} />
      </Field>
      <Field label="Website">
        <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
      </Field>
      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <ImageIcon size={13} /> Logo URL
          </span>
        }
        hint="A hosted image URL — shown on your public library page."
      >
        <input className={inputClass} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
      </Field>

      <label className="flex items-center justify-between rounded-xl border border-edge px-4 py-3">
        <span>
          <span className="block text-[13.5px] font-medium text-ink">Public digital library</span>
          <span className="block text-[12px] text-ink-faint">When off, your library page and catalog courses are hidden from the public.</span>
        </span>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-5 w-5 accent-primary" />
      </label>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-3">
        <Btn onClick={save} loading={busy} disabled={!name.trim()}>Save changes</Btn>
        {savedAt && !busy && <span className="text-[12px] text-emerald-500">Saved</span>}
      </div>
    </div>
  )
}

function CoursesTab({ institution, onEdit }: { institution: Institution; onEdit: (c: Course) => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<OfferingKind>('course')
  const [busy, setBusy] = useState(false)

  const refresh = () => api.learnInstitutionCourses(institution.id).then(setCourses).catch(() => setCourses([]))
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [institution.id])

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const c = await api.learnCreateCourse(institution.id, { title, kind })
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
        <h2 className="text-[15px] font-semibold text-ink">Offerings</h2>
        <div className="flex gap-2">
          <Btn size="sm" variant="outline" onClick={() => setGenerating(true)}>
            <Sparkles size={15} /> Generate with AI
          </Btn>
          <Btn size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus size={15} /> New
          </Btn>
        </div>
      </div>

      {generating && (
        <InstitutionQuickCourseModal
          institutionId={institution.id}
          onClose={() => setGenerating(false)}
          onCreated={async (c) => {
            setGenerating(false)
            await refresh()
            onEdit(c)
          }}
        />
      )}

      {creating && (
        <div className="mb-4 space-y-2 rounded-2xl border border-edge bg-surface-raised p-3">
          <div className="flex flex-wrap gap-1.5">
            {OFFERING_KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
                  kind === k.value ? 'border-primary bg-primary-soft text-primary' : 'border-edge text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder={`${OFFERING_KINDS.find((k) => k.value === kind)?.label} title`}
            />
            <Btn size="sm" onClick={create} loading={busy} disabled={!title.trim()}>Create</Btn>
          </div>
        </div>
      )}

      {courses.length === 0 && !creating ? (
        <EmptyState icon={<Layers size={28} />} title="Nothing published yet" body="Create a course, program, event, or resource, fill it in, then publish it to the catalog." />
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
                <span className="text-[12px] text-ink-faint">{c.kind && c.kind !== 'course' ? OFFERING_KINDS.find((k) => k.value === c.kind)?.label : c.level}</span>
              </span>
              {c.kind && c.kind !== 'course' && <Pill tone="primary">{OFFERING_KINDS.find((k) => k.value === c.kind)?.label}</Pill>}
              {c.published ? <Pill tone="green"><Eye size={11} /> Published</Pill> : <Pill tone="amber"><EyeOff size={11} /> Draft</Pill>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const QUICK_LEVELS = ['All levels', 'Beginner', 'Intermediate', 'Advanced']

const KIND_TOPIC_LABEL: Record<OfferingKind, string> = {
  course: 'What should this course teach?',
  program: 'What is this program for?',
  event: 'What is this event?',
  resource: 'What does this resource cover?',
}
const KIND_TOPIC_HINT: Record<OfferingKind, string> = {
  course: 'A topic or subject — as specific as you like.',
  program: 'e.g. a loan application walkthrough, volunteer onboarding, a member benefits process.',
  event: 'e.g. an AGM, a public briefing, a workshop, a fundraiser.',
  resource: 'e.g. an annual report explainer, a policy FAQ, a how-to guide.',
}
const KIND_OUTCOME_LABEL: Record<OfferingKind, string> = {
  course: 'What should learners be able to do after finishing?',
  program: 'What will someone have done or understood by the end?',
  event: 'What does an attendee get out of it?',
  resource: 'What will a reader know or be able to do after reading it?',
}

// Institution-side "build a full offering with AI": staff describe what it's
// for in one form, and Bermi drafts the whole thing — a course's full lesson
// content and quiz-ready evaluation, a program's steps, an event's agenda,
// or a resource's sections. Left as a draft so the organization can review
// before publishing.
function InstitutionQuickCourseModal({
  institutionId,
  onClose,
  onCreated,
}: {
  institutionId: string
  onClose: () => void
  onCreated: (course: Course) => void
}) {
  const [kind, setKind] = useState<OfferingKind>('course')
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [level, setLevel] = useState('All levels')
  const [category, setCategory] = useState('')
  const [objectives, setObjectives] = useState('')
  const [material, setMaterial] = useState('')
  const [avoid, setAvoid] = useState('')
  const [eventAt, setEventAt] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!topic.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.learnInstitutionQuickCreateCourse(institutionId, {
        topic,
        audience,
        level,
        category,
        kind,
        objectives,
        material,
        avoid,
        event_at: eventAt || undefined,
        event_location: eventLocation || undefined,
      })
      onCreated(res.course)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-edge bg-surface-raised p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Sparkles size={16} className="text-primary" /> Generate with AI
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-surface-sunken">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5">
          <Field label="What are you publishing?">
            <div className="grid grid-cols-2 gap-1.5">
              {OFFERING_KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={`rounded-xl border px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                    kind === k.value ? 'border-primary bg-primary-soft text-primary' : 'border-edge text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  <span className="block font-semibold">{k.label}</span>
                  <span className="block text-[11px] font-normal opacity-80">{k.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={KIND_TOPIC_LABEL[kind]} hint={KIND_TOPIC_HINT[kind]}>
            <textarea
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={kind === 'course' ? 'e.g. Introduction to bookkeeping for small businesses' : 'Describe it in a sentence or two'}
              className="min-h-[70px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
            />
          </Field>

          {kind === 'event' && (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Date & time" hint="Leave blank if not yet decided.">
                <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Location" hint="An address, or a video-call link.">
                <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="e.g. Head office, or https://…" className={inputClass} />
              </Field>
            </div>
          )}

          <Field label={KIND_OUTCOME_LABEL[kind]} hint="Optional — Bermi can infer this.">
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="One outcome per line (optional)"
              className="min-h-[70px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
            />
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label={kind === 'course' ? 'Audience / starting level' : 'Who is this for?'}>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={kind === 'course' ? 'e.g. new hires, no prior experience' : 'e.g. existing customers, the general public'}
                className={inputClass}
              />
            </Field>
            <Field label="Category">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Finance, Compliance"
                className={inputClass}
              />
            </Field>
          </div>

          {kind === 'course' && (
            <Field label="Level">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_LEVELS.map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setLevel(lv)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
                      level === lv ? 'border-primary bg-primary-soft text-primary' : 'border-edge text-ink-muted hover:bg-surface-sunken'
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Source material to ground it in" hint="Paste notes, a document, or reference text. Optional.">
            <textarea
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Optional"
              className="min-h-[70px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
            />
          </Field>

          <Field label="Anything to skip or avoid?">
            <textarea
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="Optional"
              className="min-h-[50px] w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-[12px] text-rose-500">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !topic.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} {busy ? 'Generating…' : `Generate full ${kind}`}
          </button>
        </div>
        <p className="mt-3 text-[11.5px] text-ink-faint">
          Bermi writes it out in full now — saved as a draft so you can review (and add videos or attachments) before
          publishing to the catalog.
        </p>
      </div>
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

      <h3 className="mb-3 text-[14px] font-semibold text-ink">Courses & learners</h3>
      {data.per_course.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge px-4 py-8 text-center text-[13px] text-ink-faint">No data yet — publish a course and enroll learners.</p>
      ) : (
        <div className="space-y-3">
          {data.per_course.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-edge bg-surface-raised">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
                <div className="text-[14px] font-semibold text-ink">
                  {c.title} {!c.published && <span className="text-ink-faint">(draft)</span>}
                </div>
                <div className="flex items-center gap-3 text-[12px] text-ink-muted">
                  <span>{c.enrollments} enrolled</span>
                  <span>{c.completions} completed</span>
                  <span>avg {c.avg_score != null ? `${c.avg_score}%` : '—'}</span>
                </div>
              </div>
              {c.learners && c.learners.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13px]">
                    <thead className="bg-surface-sunken text-ink-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">Learner</th>
                        <th className="px-3 py-2 text-left font-semibold">Progress</th>
                        <th className="px-3 py-2 text-right font-semibold" title="How well they understand — from quiz scores">Understanding</th>
                        <th className="px-4 py-2 text-right font-semibold" title="How much they lean on the AI vs. work independently">AI-dependency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.learners.map((l, i) => (
                        <tr key={i} className="border-t border-edge">
                          <td className="px-4 py-2 text-ink">{l.name} <span className="text-ink-faint">· {l.status}</span></td>
                          <td className="px-3 py-2 text-ink-muted">
                            {l.lessons_total ? `${l.lessons_done}/${l.lessons_total} lessons` : `${l.lessons_done} lessons`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {l.understanding != null ? (
                              <span className={l.understanding >= 70 ? 'text-emerald-600 dark:text-emerald-400' : l.understanding >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>{l.understanding}%</span>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-muted">{l.dependency != null ? `${l.dependency}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-4 text-[12.5px] text-ink-faint">No learners enrolled yet.</p>
              )}
            </div>
          ))}
          <p className="text-[11.5px] text-ink-faint">
            Understanding comes from quiz performance. AI-dependency populates as learners study in Bermi AI against this course's objectives.
          </p>
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

  const kind: OfferingKind = course.kind || 'course'
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
        category: body.category,
        published: body.published,
        enrollment: body.enrollment,
        kind: body.kind,
        event_at: body.event_at,
        event_location: body.event_location,
        objectives: body.objectives,
        evaluation: body.evaluation,
        tracking: body.tracking,
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
          <Pill tone="primary">{OFFERING_KINDS.find((k) => k.value === kind)?.label}</Pill>
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

        <Field label="Kind">
          <div className="flex flex-wrap gap-1.5">
            {OFFERING_KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => patch({ kind: k.value })}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
                  kind === k.value ? 'border-primary bg-primary-soft text-primary' : 'border-edge text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        {kind === 'event' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date & time">
              <input
                type="datetime-local"
                className={inputClass}
                value={toLocalDateTimeInput(course.event_at)}
                onChange={(e) => patch({ event_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </Field>
            <Field label="Location" hint="An address, or a video-call link.">
              <input className={inputClass} value={course.event_location || ''} onChange={(e) => patch({ event_location: e.target.value })} placeholder="e.g. Head office, or https://…" />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {kind === 'course' && (
            <Field label="Level">
              <select className={inputClass} value={course.level || 'All levels'} onChange={(e) => patch({ level: e.target.value })}>
                {['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
          )}
          <Field label="Category" hint="Groups items on your library shelf (e.g. Finance, Compliance).">
            <input className={inputClass} value={course.category || ''} onChange={(e) => patch({ category: e.target.value })} placeholder="e.g. Finance" />
          </Field>
          <Field label={kind === 'event' ? 'Registration' : 'Enrollment'}>
            <select className={inputClass} value={course.enrollment || 'open'} onChange={(e) => patch({ enrollment: e.target.value as 'open' | 'approval' })}>
              <option value="open">Open — anyone can join</option>
              <option value="approval">Requires approval</option>
            </select>
          </Field>
        </div>
        <Field label="Full description" hint={`Markdown supported. Shown on the ${kind} page.`}>
          <textarea className={`${inputClass} min-h-[120px] resize-y`} value={course.description || ''} onChange={(e) => patch({ description: e.target.value })} />
        </Field>

        <div className="rounded-2xl border border-edge bg-surface-sunken/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Target size={15} className="text-primary" /> {kind === 'course' ? 'Teaching & evaluation plan' : kind === 'event' ? 'What to tell attendees' : 'Guidance plan'}
            <span className="font-normal text-ink-faint">— guides how Bermi AI presents this and judges engagement</span>
          </div>
          <div className="space-y-3">
            <Field
              label={kind === 'course' ? 'Learning objectives' : kind === 'event' ? 'What attendees get out of it' : 'Outcomes'}
              hint="What should someone be able to do or understand afterward? One per line."
            >
              <textarea className={`${inputClass} min-h-[80px] resize-y`} value={course.objectives || ''} onChange={(e) => patch({ objectives: e.target.value })} placeholder={kind === 'course' ? 'Explain the water cycle\nIdentify the stages of photosynthesis' : 'One outcome per line'} />
            </Field>
            {kind !== 'event' && (
              <Field
                label={kind === 'course' ? 'Areas to test & evaluation bases' : 'How to judge real engagement'}
                hint={kind === 'course' ? 'What to assess and how mastery is judged (e.g. quiz score thresholds, must-know concepts).' : 'What tells you someone genuinely engaged with each step — a plain confirmation is enough, no quiz needed.'}
              >
                <textarea className={`${inputClass} min-h-[80px] resize-y`} value={course.evaluation || ''} onChange={(e) => patch({ evaluation: e.target.value })} placeholder={kind === 'course' ? 'Test recall of key terms and applied problem-solving.\nMastery = 70%+ on end-of-level quizzes.' : 'What "understood" or "done" looks like for each step.'} />
              </Field>
            )}
            <Field label="What to track" hint="Signals the organization wants on each person (e.g. understanding, how independently they engage).">
              <textarea className={`${inputClass} min-h-[64px] resize-y`} value={course.tracking || ''} onChange={(e) => patch({ tracking: e.target.value })} placeholder={'Understanding per objective, how independently they engage vs. leaning on the AI.'} />
            </Field>
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex items-center gap-3">
          <Btn onClick={() => save()} loading={saving}>Save details</Btn>
          <button onClick={() => navigate({ name: 'course', id: course.id })} className="text-[13px] font-medium text-primary hover:underline">
            Preview page →
          </button>
        </div>
      </div>

      <LessonsManager courseId={course.id} kind={kind} />
    </div>
  )
}

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LessonsManager({ courseId, kind }: { courseId: string; kind: OfferingKind }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const stepLabel = KIND_STEP_LABEL[kind]
  const stepSingular = KIND_STEP_SINGULAR[kind]

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
        <Layers size={16} /> {stepLabel} · {lessons.length}
      </h2>

      <div className="space-y-2">
        {lessons.map((l, i) =>
          openId === l.id ? (
            <LessonEditor
              key={l.id}
              lesson={l}
              index={i}
              stepSingular={stepSingular}
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
          placeholder={`New ${stepSingular.toLowerCase()} title…`}
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
  stepSingular = 'Lesson',
  onClose,
  onChanged,
}: {
  lesson: Lesson
  index: number
  stepSingular?: string
  onClose: () => void
  onChanged: () => void
}) {
  const [lesson, setLesson] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const patch = (p: Partial<Lesson>) => setLesson((l) => ({ ...l, ...p }))

  const uploadMaterial = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const att = await api.extractFile(file)
      const header = `# ${att.name}`
      patch({
        material: (lesson.material ? lesson.material.trim() + '\n\n' : '') + `${header}\n${att.text}`,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.learnUpdateLesson(lesson.id, {
        title: lesson.title,
        content: lesson.content,
        material: lesson.material,
        video_url: lesson.video_url,
        attachment_url: lesson.attachment_url,
      })
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

      <Field label="Source material" hint={`Paste text, or upload a PPT, PDF, Word doc or image — Bermi reads it and turns it into a polished ${stepSingular.toLowerCase()}.`}>
        <textarea
          className={`${inputClass} min-h-[90px] resize-y`}
          value={lesson.material || ''}
          onChange={(e) => patch({ material: e.target.value })}
          placeholder="Paste your material, or upload a file below…"
        />
      </Field>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pptx,.pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) uploadMaterial(f)
        }}
      />

      <div className="my-3 flex flex-wrap items-center gap-2">
        <Btn size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
          <Upload size={14} /> Upload PPT / PDF / doc
        </Btn>
        <Btn size="sm" variant="outline" onClick={aiDraft} loading={drafting} disabled={!lesson.material?.trim()}>
          <Wand2 size={14} /> {lesson.content ? 'Redraft with AI' : `Draft ${stepSingular.toLowerCase()} with AI`}
        </Btn>
        {uploading && (
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
            <Loader2 size={12} className="animate-spin" /> Reading file…
          </span>
        )}
      </div>

      <Field label={`${stepSingular} content`} hint="What the AI presents/teaches from. Markdown supported.">
        <textarea
          className={`${inputClass} min-h-[160px] resize-y font-mono text-[13px]`}
          value={lesson.content || ''}
          onChange={(e) => patch({ content: e.target.value })}
          placeholder={`Write it, or generate it from your material above.`}
        />
      </Field>

      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <Video size={13} /> Video (optional)
          </span>
        }
        hint="A YouTube link or direct video file URL. Users can ask Bermi AI to play it right in chat, with captions when available, and to summarize it."
      >
        <input
          className={inputClass}
          value={lesson.video_url || ''}
          onChange={(e) => patch({ video_url: e.target.value })}
          placeholder="https://youtube.com/watch?v=... or a direct .mp4 link"
        />
      </Field>

      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <Download size={13} /> Downloadable attachment (optional)
          </span>
        }
        hint="A hosted file link (PDF, report, form) Bermi AI can hand the user in chat."
      >
        <input
          className={inputClass}
          value={lesson.attachment_url || ''}
          onChange={(e) => patch({ attachment_url: e.target.value })}
          placeholder="https://…/document.pdf"
        />
      </Field>

      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-4 flex items-center justify-between">
        <Btn size="sm" variant="danger" onClick={del}><Trash2 size={14} /></Btn>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={save} loading={saving}>
            <Sparkles size={14} /> Save {stepSingular.toLowerCase()}
          </Btn>
        </div>
      </div>
    </div>
  )
}
