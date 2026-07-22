import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  Compass,
  GraduationCap,
  Library,
  Menu,
  MessageSquare,
  Search,
  Sparkles,
  Wand2,
  X,
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

// A self-contained B2B portal that lives under /learn with its own sidebar
// shell, separate from the chat workspace. Businesses & institutions build a
// digital library, enroll their clients/teams, let AI evaluate learners, and
// issue certificates — while the learning itself happens inside Bermi AI.
export function LearnPortal({ user, onExit }: { user: AuthUser; onExit: () => void }) {
  const [route, setRoute] = useState<LearnRoute>(() => parseLearnRoute(window.location.pathname))
  const [navOpen, setNavOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const navigate = useCallback((r: LearnRoute) => {
    window.history.pushState(null, '', routeToPath(r))
    setRoute(r)
    setNavOpen(false)
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, 0))
  }, [])

  useEffect(() => {
    const onPop = () => setRoute(parseLearnRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <PortalSidebar
        user={user}
        route={route}
        navigate={navigate}
        onExit={onExit}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar onMenu={() => setNavOpen(true)} route={route} navigate={navigate} />
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {route.name === 'landing' && <Landing navigate={navigate} />}
          {route.name === 'institution' && <InstitutionLibrary slug={route.slug} navigate={navigate} />}
          {route.name === 'course' && <CoursePage courseId={route.id} navigate={navigate} />}
          {route.name === 'study' && (
            <LessonStudy courseId={route.courseId} lessonId={route.lessonId} navigate={navigate} />
          )}
          {route.name === 'mylearning' && <MyLearning navigate={navigate} />}
          {route.name === 'studio' && <InstitutionStudio navigate={navigate} />}
          {route.name === 'certificate' && <CertificateView code={route.code} navigate={navigate} />}
        </div>
      </div>
    </div>
  )
}

// ---------- Sidebar ----------

function PortalSidebar({
  user,
  route,
  navigate,
  onExit,
  open,
  onClose,
}: {
  user: AuthUser
  route: LearnRoute
  navigate: (r: LearnRoute) => void
  onExit: () => void
  open: boolean
  onClose: () => void
}) {
  const [myOrgs, setMyOrgs] = useState<Institution[]>([])
  useEffect(() => {
    api.learnMyInstitutions().then(setMyOrgs).catch(() => setMyOrgs([]))
  }, [])

  const NavItem = ({
    active,
    icon,
    label,
    onClick,
  }: {
    active?: boolean
    icon: React.ReactNode
    label: string
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
        active ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-edge bg-surface-raised transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => navigate({ name: 'landing' })} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white">
              <BermiMark size={18} />
            </div>
            <div className="text-left leading-none">
              <div className="text-[15px] font-bold text-ink">Bermi Learn</div>
              <div className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">LMS portal</div>
            </div>
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken md:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          <div className="space-y-0.5">
            <SectionLabel>Organization</SectionLabel>
            <NavItem active={route.name === 'studio'} icon={<Building2 size={17} />} label="Dashboard" onClick={() => navigate({ name: 'studio' })} />
            {myOrgs.map((o) => (
              <NavItem
                key={o.id}
                active={route.name === 'institution' && route.slug === o.slug}
                icon={<Library size={15} />}
                label={o.name}
                onClick={() => navigate({ name: 'institution', slug: o.slug })}
              />
            ))}
          </div>

          <div className="space-y-0.5">
            <SectionLabel>Catalog</SectionLabel>
            <NavItem active={route.name === 'landing' || route.name === 'course' || (route.name === 'institution' && !myOrgs.some((o) => o.slug === route.slug))} icon={<Compass size={17} />} label="Browse programs" onClick={() => navigate({ name: 'landing' })} />
            <NavItem active={route.name === 'mylearning'} icon={<GraduationCap size={17} />} label="Enrollments" onClick={() => navigate({ name: 'mylearning' })} />
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-edge p-3">
          <button
            onClick={onExit}
            className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <MessageSquare size={16} /> Back to Bermi Chat
          </button>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-ink">{user.name}</div>
              <div className="truncate text-[11px] text-ink-faint">{user.email}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{children}</div>
}

function MobileBar({
  onMenu,
  route,
  navigate,
}: {
  onMenu: () => void
  route: LearnRoute
  navigate: (r: LearnRoute) => void
}) {
  const title =
    route.name === 'mylearning' ? 'Enrollments' : route.name === 'studio' ? 'Organization' : 'Bermi Learn'
  return (
    <header className="flex items-center gap-2 border-b border-edge bg-surface-raised px-3 py-2.5 md:hidden">
      <button onClick={onMenu} className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken">
        <Menu size={18} />
      </button>
      <button onClick={() => navigate({ name: 'landing' })} className="flex items-center gap-1.5">
        <BermiMark size={18} className="text-primary" />
        <span className="text-[14px] font-bold text-ink">{title}</span>
      </button>
    </header>
  )
}

// ---------- Landing (B2B / organization-first) ----------

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
      <section className="border-b border-edge bg-gradient-to-b from-primary-soft/40 to-transparent px-5 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-raised px-3 py-1 text-[12px] font-medium text-ink-muted">
            <Sparkles size={13} className="text-primary" /> Bermi Learn · for businesses & institutions
          </div>
          <h1 className="mx-auto max-w-2xl text-[28px] font-bold leading-tight text-ink md:text-[40px]">
            The learning platform for your organization.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-muted">
            Publish your courses and digital library, enroll your clients and teams, let AI evaluate them, and
            issue certificates — while they learn hands-on inside Bermi AI.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Btn onClick={() => navigate({ name: 'studio' })}>
              <Building2 size={17} /> Set up your organization
            </Btn>
            <Btn variant="outline" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>
              <Compass size={16} /> Browse the catalog
            </Btn>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: <Library size={18} />, title: 'Build your library', body: 'Organize classes and lectures into a branded digital library the public can enroll in.' },
              { icon: <BarChart3 size={18} />, title: 'Evaluate with AI', body: 'AI quizzes score every learner and roll up into completion and performance analytics.' },
              { icon: <GraduationCap size={18} />, title: 'Certify learners', body: 'Issue verifiable certificates of completion under your organization’s name.' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-edge bg-surface-raised p-5 text-left">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">{f.icon}</div>
                <h3 className="text-[14px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-[12.5px] text-ink-muted">{f.body}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-lg text-[12.5px] text-ink-faint">
            <Wand2 size={12} className="mr-1 inline" /> Learners study your material hands-on inside Bermi AI’s Study
            Mode — this portal is where your organization builds, manages and certifies it all.
          </p>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="mx-auto max-w-5xl px-5 py-10 md:px-10 md:py-14">
        {!catalog ? (
          <Spinner label="Loading catalog…" />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[22px] font-bold text-ink">Course catalog</h2>
                <p className="text-[13.5px] text-ink-muted">
                  {catalog.courses.length} {catalog.courses.length === 1 ? 'program' : 'programs'} from{' '}
                  {catalog.institutions.length} {catalog.institutions.length === 1 ? 'organization' : 'organizations'}
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search programs…"
                  className="w-full rounded-xl border border-edge bg-surface-raised py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
                />
              </div>
            </div>

            {courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={30} />}
                title={query ? 'No programs match your search' : 'No programs published yet'}
                body={query ? 'Try a different search term.' : 'Set up your organization to publish your first program.'}
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
                <p className="mb-5 text-[13.5px] text-ink-muted">Businesses and institutions teaching on Bermi Learn.</p>
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
                        <p className="truncate text-[12.5px] text-ink-faint">{i.about || 'View library'}</p>
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

// ---------- Institution public page — a digital library ----------

const SHELF_ORDER = ['Beginner', 'Intermediate', 'Advanced', 'All levels']

function InstitutionLibrary({ slug, navigate }: { slug: string; navigate: (r: LearnRoute) => void }) {
  const [data, setData] = useState<{ institution: Institution; courses: Course[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setData(null)
    setError(null)
    setQuery('')
    api.learnInstitutionBySlug(slug).then(setData).catch((e) => setError((e as Error).message))
  }, [slug])

  const shelves = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const filtered = q
      ? data.courses.filter((c) => c.title.toLowerCase().includes(q) || (c.summary || '').toLowerCase().includes(q))
      : data.courses
    const byLevel = new Map<string, Course[]>()
    for (const c of filtered) {
      const key = SHELF_ORDER.includes(c.level) ? c.level : 'All levels'
      if (!byLevel.has(key)) byLevel.set(key, [])
      byLevel.get(key)!.push(c)
    }
    return SHELF_ORDER.filter((l) => byLevel.has(l)).map((l) => ({ level: l, courses: byLevel.get(l)! }))
  }, [data, query])

  if (error) return <div className="mx-auto max-w-5xl px-5 py-10 text-center text-[14px] text-ink-muted">{error}</div>
  if (!data) return <Spinner label="Opening library…" />

  const { institution, courses } = data

  return (
    <div>
      {/* Library header */}
      <div className="border-b border-edge bg-gradient-to-b from-primary-soft/30 to-transparent px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => navigate({ name: 'landing' })}
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
          >
            <ChevronLeft size={15} /> Catalog
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
                <Building2 size={26} />
              </div>
              <div>
                <h1 className="text-[24px] font-bold text-ink md:text-[28px]">{institution.name}</h1>
                {institution.about && <p className="mt-1 max-w-2xl text-[14px] text-ink-muted">{institution.about}</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Pill tone="primary"><Library size={12} /> Digital library</Pill>
                  <Pill tone="muted"><BookOpen size={12} /> {courses.length} {courses.length === 1 ? 'class' : 'classes'}</Pill>
                  {institution.website && (
                    <a href={institution.website} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium text-primary hover:underline">
                      Website ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this library…"
                className="w-full rounded-xl border border-edge bg-surface-raised py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Shelves grouped by level — reads like classes/lectures on a shelf */}
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-10">
        {shelves.length === 0 ? (
          <EmptyState icon={<Library size={28} />} title={query ? 'No classes match your search' : 'No published classes yet'} />
        ) : (
          <div className="space-y-10">
            {shelves.map((shelf) => (
              <section key={shelf.level}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-ink">{shelf.level}</h2>
                  <span className="text-[12.5px] text-ink-faint">· {shelf.courses.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shelf.courses.map((c) => (
                    <CourseCard key={c.id} course={c} onOpen={() => navigate({ name: 'course', id: c.id })} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Kept for compatibility with any external imports.
export function InstitutionPage(props: { slug: string; navigate: (r: LearnRoute) => void }) {
  return <InstitutionLibrary {...props} />
}
