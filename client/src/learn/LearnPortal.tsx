import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  GraduationCap,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import * as api from '../lib/api'
import type { AuthUser, Course, Institution } from '../lib/types'
import { BermiMark } from '../components/Logo'
import {
  Btn,
  EmptyState,
  Pill,
  Spinner,
  parseLearnRoute,
  routeToPath,
  type LearnRoute,
} from './ui'
import { CoursePage } from './CoursePage'
import { LessonStudy } from './LessonStudy'
import { MyLearning } from './MyLearning'
import { InstitutionStudio } from './InstitutionStudio'
import { CertificateView } from './CertificateView'

// A self-contained portal that lives under /learn with its own landing page and
// navigation, separate from the chat workspace. Covers all three sides:
//   1) institutions author & publish courses  2) the public browses & learns
//   3) AI evaluates learners and issues certificates.
export function LearnPortal({ user, onExit }: { user: AuthUser; onExit: () => void }) {
  const [route, setRoute] = useState<LearnRoute>(() => parseLearnRoute(window.location.pathname))

  const navigate = useCallback((r: LearnRoute) => {
    window.history.pushState(null, '', routeToPath(r))
    setRoute(r)
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const onPop = () => setRoute(parseLearnRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PortalHeader user={user} route={route} navigate={navigate} onExit={onExit} />
      <div className="flex-1">
        {route.name === 'landing' && <Landing navigate={navigate} />}
        {route.name === 'institution' && <InstitutionPage slug={route.slug} navigate={navigate} />}
        {route.name === 'course' && <CoursePage courseId={route.id} navigate={navigate} />}
        {route.name === 'study' && (
          <LessonStudy courseId={route.courseId} lessonId={route.lessonId} navigate={navigate} />
        )}
        {route.name === 'mylearning' && <MyLearning navigate={navigate} />}
        {route.name === 'studio' && <InstitutionStudio navigate={navigate} />}
        {route.name === 'certificate' && <CertificateView code={route.code} navigate={navigate} />}
      </div>
      <PortalFooter />
    </div>
  )
}

function PortalHeader({
  user,
  route,
  navigate,
  onExit,
}: {
  user: AuthUser
  route: LearnRoute
  navigate: (r: LearnRoute) => void
  onExit: () => void
}) {
  const nav = [
    { name: 'landing' as const, label: 'Explore', icon: <BookOpen size={15} /> },
    { name: 'mylearning' as const, label: 'My learning', icon: <GraduationCap size={15} /> },
    { name: 'studio' as const, label: 'For organizations', icon: <Building2 size={15} /> },
  ]
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <button onClick={() => navigate({ name: 'landing' })} className="flex items-center gap-2">
          <BermiMark size={24} className="text-primary" />
          <span className="text-[16px] font-bold text-ink">Bermi Learn</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <button
              key={n.name}
              onClick={() => navigate({ name: n.name })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                route.name === n.name ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="hidden rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken sm:inline-flex"
          >
            ← Bermi Chat
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white" title={user.name}>
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-edge px-3 py-1.5 md:hidden">
        {nav.map((n) => (
          <button
            key={n.name}
            onClick={() => navigate({ name: n.name })}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${
              route.name === n.name ? 'bg-primary-soft text-primary' : 'text-ink-muted'
            }`}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

function PortalFooter() {
  return (
    <footer className="border-t border-edge px-4 py-6 text-center text-[12px] text-ink-faint">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <BermiMark size={13} className="text-primary" /> Bermi Learn
        </div>
        <p>An AI learning-management portal. Certificates reflect course completion, not accredited degrees.</p>
      </div>
    </footer>
  )
}

// ---------- Landing + catalog ----------

function Landing({ navigate }: { navigate: (r: LearnRoute) => void }) {
  const [catalog, setCatalog] = useState<{ institutions: Institution[]; courses: Course[] } | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.learnCatalog().then(setCatalog).catch(() => setCatalog({ institutions: [], courses: [] }))
  }, [])

  const courses = useMemo(() => {
    if (!catalog) return []
    const q = query.trim().toLowerCase()
    if (!q) return catalog.courses
    return catalog.courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.institution?.name || '').toLowerCase().includes(q),
    )
  }, [catalog, query])

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-edge bg-gradient-to-b from-primary-soft/50 to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center md:py-20">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-raised px-3 py-1 text-[12px] font-medium text-ink-muted">
            <Sparkles size={13} className="text-primary" /> AI-powered learning management
          </div>
          <h1 className="mx-auto max-w-2xl text-[30px] font-bold leading-tight text-ink md:text-[44px]">
            Learn from organizations. Get evaluated by AI. Earn your certificate.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-muted md:text-[16px]">
            Browse courses published by institutions, study with an AI tutor, prove what you've learned, and
            walk away with a certificate of completion.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Btn onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>
              <BookOpen size={17} /> Explore courses
            </Btn>
            <Btn variant="outline" onClick={() => navigate({ name: 'studio' })}>
              <Building2 size={16} /> Teach on Bermi
            </Btn>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: <BookOpen size={18} />, title: 'Enroll & study', body: 'Self-paced lessons with an AI tutor grounded in the material.' },
              { icon: <Award size={18} />, title: 'Get evaluated', body: 'AI quizzes score you and track mastery lesson by lesson.' },
              { icon: <GraduationCap size={18} />, title: 'Earn a certificate', body: 'Finish every lesson to receive a verifiable certificate.' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-edge bg-surface-raised p-5 text-left">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">{f.icon}</div>
                <h3 className="text-[14px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-[12.5px] text-ink-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {!catalog ? (
          <Spinner label="Loading catalog…" />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[22px] font-bold text-ink">Course catalog</h2>
                <p className="text-[13.5px] text-ink-muted">
                  {catalog.courses.length} {catalog.courses.length === 1 ? 'course' : 'courses'} from{' '}
                  {catalog.institutions.length} {catalog.institutions.length === 1 ? 'organization' : 'organizations'}
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search courses…"
                  className="w-full rounded-xl border border-edge bg-surface-raised py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
                />
              </div>
            </div>

            {courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={30} />}
                title={query ? 'No courses match your search' : 'No courses published yet'}
                body={query ? 'Try a different search term.' : 'Be the first — publish a course from the “For organizations” tab.'}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c) => (
                  <CourseCard key={c.id} course={c} onOpen={() => navigate({ name: 'course', id: c.id })} />
                ))}
              </div>
            )}

            {catalog.institutions.length > 0 && (
              <div className="mt-14">
                <h2 className="mb-1 text-[22px] font-bold text-ink">Organizations</h2>
                <p className="mb-5 text-[13.5px] text-ink-muted">Institutions teaching on Bermi Learn.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.institutions.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => navigate({ name: 'institution', slug: i.slug })}
                      className="flex items-center gap-3 rounded-2xl border border-edge bg-surface-raised p-4 text-left transition-colors hover:border-primary"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                        <Building2 size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[14.5px] font-semibold text-ink">{i.name}</h3>
                        <p className="truncate text-[12.5px] text-ink-faint">{i.about || 'View courses'}</p>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-ink-faint" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-edge bg-surface-raised p-5 text-left transition-all hover:border-primary hover:shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-3xl">{course.cover_emoji || '📘'}</div>
        <Pill tone="muted">{course.level || 'All levels'}</Pill>
      </div>
      <h3 className="text-[16px] font-semibold leading-snug text-ink group-hover:text-primary">{course.title}</h3>
      {course.summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-muted">{course.summary}</p>}
      {course.institution && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
          <Building2 size={12} /> {course.institution.name}
        </p>
      )}
    </button>
  )
}

// ---------- Institution public page ----------

function InstitutionPage({ slug, navigate }: { slug: string; navigate: (r: LearnRoute) => void }) {
  const [data, setData] = useState<{ institution: Institution; courses: Course[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    api.learnInstitutionBySlug(slug).then(setData).catch((e) => setError((e as Error).message))
  }, [slug])

  if (error) return <div className="mx-auto max-w-4xl px-4 py-10 text-center text-[14px] text-ink-muted">{error}</div>
  if (!data) return <Spinner label="Loading organization…" />

  const { institution, courses } = data
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'landing' })}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Catalog
      </button>

      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
          <Building2 size={30} />
        </div>
        <div>
          <h1 className="text-[26px] font-bold text-ink">{institution.name}</h1>
          {institution.about && <p className="mt-1.5 max-w-2xl text-[14px] text-ink-muted">{institution.about}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-ink-faint">
            <span className="inline-flex items-center gap-1.5"><BookOpen size={13} /> {courses.length} courses</span>
            {institution.website && (
              <a href={institution.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Users size={13} /> Website
              </a>
            )}
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState icon={<BookOpen size={28} />} title="No published courses yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} onOpen={() => navigate({ name: 'course', id: c.id })} />
          ))}
        </div>
      )}
    </div>
  )
}
