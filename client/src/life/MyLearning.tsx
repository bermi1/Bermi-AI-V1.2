import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, BookOpen, Check, ChevronRight, ExternalLink, FileText, GraduationCap, Headphones, Layers, Lightbulb, Plus, RotateCcw, Sparkles, Target, Trash2, Upload, Volume2, VolumeX } from 'lucide-react'
import * as legacy from '../lib/api'
import type { Enrollment } from '../lib/types'
import {
  lifeApi, LifeError, type AudioAsset, type Book, type Concept, type Kit, type NoteData, type ProfileData, type ProposedAction, type ReadingData, type SavedData, type SkillData, type Item,
} from './api'
import { useAct, useItems, useSingleton, useToday, newIdemKey } from './hooks'
import { SCENES, setVolume, soundscapeSupported, startScene, stopScene, type SceneId } from './soundscape'
import { btn, Chip, EmptyState, ErrorState, field, fmtDateShort, fmtTime, PageHeader, Ring, Section, Sheet, Skeleton, Spinner, useAsync, notifyLifeChanged } from './ui'

type Tab = 'today' | 'notes' | 'library' | 'listen' | 'skills'
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'notes', label: 'Notes & study kits' }, { id: 'library', label: 'Library' }, { id: 'listen', label: 'Listen & focus' }, { id: 'skills', label: 'Skills' },
]

export function MyLearning({ go }: { go: (to: string) => void }) {
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('bermi-learn-tab') as Tab) || 'today')
  useEffect(() => { try { sessionStorage.setItem('bermi-learn-tab', tab) } catch { /* ignore */ } }, [tab])
  return (
    <div>
      <PageHeader title="My Learning" subtitle="Study smarter, read a little every day." />
      <div role="tablist" aria-label="Learning sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`lt-${t.id}`} aria-selected={tab === t.id} aria-controls="lt-panel" onClick={() => setTab(t.id)} className={`min-h-[40px] shrink-0 rounded-full px-4 text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${tab === t.id ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="lt-panel" aria-labelledby={`lt-${tab}`} className="pt-2">
        {tab === 'today' && <Today go={go} />}
        {tab === 'notes' && <Notes />}
        {tab === 'library' && <Library />}
        {tab === 'listen' && <Listen />}
        {tab === 'skills' && <Skills />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- today

function Today({ go }: { go: (to: string) => void }) {
  const today = useToday()
  const content = useAsync(() => lifeApi.content(today), [today])
  const saved = useItems<SavedData>('saved')
  const act = useAct()
  const d = content.data?.daily
  const isSaved = d ? saved.items.find((s) => s.data.ref === d.id) : undefined
  const [reflect, setReflect] = useState('')

  const addReflection = async () => {
    if (!d || !reflect.trim()) return
    await act(async () => {
      const reading = (await lifeApi.items<ReadingData>('reading')).find((r) => r.data.bookId === d.bookId)
      const entry = { date: today, text: reflect.trim() }
      if (reading) await lifeApi.update<ReadingData>(reading.id, { reflections: [...reading.data.reflections, entry] })
      else await lifeApi.create<ReadingData>('reading', { bookId: d.bookId, status: 'want', progress: 0, reflections: [entry] })
      setReflect('')
    }, 'Reflection saved to your library')
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        <Section title="Today’s idea">
          {content.loading && !content.data ? <Skeleton className="h-48" /> : content.error && !content.data ? <ErrorState error={content.error} onRetry={() => content.reload()} compact /> : !d ? (
            <EmptyState icon={<Lightbulb size={26} />} title="No idea published for today" body="Daily ideas come from a reviewed library. Check back soon, or browse the Library tab." />
          ) : (
            <article>
              <p className="text-[12.5px] text-ink-muted">From <em>{d.book?.title ?? 'a book'}</em>{d.book ? ` by ${d.book.author}` : ''}</p>
              <h3 className="mt-1 text-[22px] font-semibold leading-snug tracking-tight">{d.concept}</h3>
              <p className="mt-3 text-[15px] leading-relaxed">{d.explanation}</p>
              {d.example && <p className="mt-3 text-[14px] leading-relaxed text-ink-muted"><span className="font-semibold text-ink">For example: </span>{d.example}</p>}
              {d.takeaways.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px]">{d.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
              )}
              <div className="mt-4 rounded-2xl bg-primary-soft p-3.5 text-[14px]"><span className="font-semibold text-primary">Try today: </span>{d.action}</div>
              <p className="mt-4 text-[14px] font-medium">{d.reflection}</p>
              <div className="mt-2 flex gap-2">
                <input value={reflect} onChange={(e) => setReflect(e.target.value)} maxLength={1000} aria-label="Your reflection" placeholder="Your thoughts (private)" className={field} />
                <button className={btn.soft} disabled={!reflect.trim()} onClick={addReflection}>Save</button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className={btn.ghost} aria-pressed={!!isSaved} onClick={() => act(async () => {
                  if (isSaved) await lifeApi.remove(isSaved.id)
                  else await lifeApi.create<SavedData>('saved', { ref: d.id, label: d.concept, type: 'concept' })
                  saved.reload(true)
                })}>{isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {isSaved ? 'Saved' : 'Save idea'}</button>
              </div>
              <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">{d.source || 'A short explanation written in Bermi’s own words.'} It is a summary of an idea, not a quotation, and can’t replace reading the book. {d.book && <>Book details and licence in the Library tab.</>}</p>
            </article>
          )}
        </Section>
      </div>
      <div>
        <Courses go={go} />
        <Planner />
      </div>
    </div>
  )
}

function Courses({ go }: { go: (to: string) => void }) {
  const q = useAsync(() => legacy.learnMyEnrollments(), [])
  const list: Enrollment[] = (q.data ?? []).filter((e) => e.course)
  return (
    <Section title="Your courses" action={<button className={btn.ghost} onClick={() => go('/portal')}>Browse</button>}>
      {q.loading && !q.data ? <Skeleton className="h-20" /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={() => q.reload()} compact /> : list.length === 0 ? (
        <EmptyState icon={<GraduationCap size={24} />} title="No courses yet" body="Join a course in the Learning portal and your progress shows up here." />
      ) : (
        <ul className="divide-y divide-edge">
          {list.slice(0, 6).map((e) => {
            const done = Object.values(e.progress ?? {}).filter((p) => p.done).length
            return (
              <li key={e.id}>
                <button onClick={() => go(`/portal/c/${e.course_id}`)} className="flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{e.course!.title}</span><span className="block text-[12.5px] text-ink-muted">{e.status === 'completed' ? 'Completed' : `${done} lesson${done === 1 ? '' : 's'} done`}</span></span>
                  <ChevronRight size={16} className="text-ink-faint" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function Planner() {
  const today = useToday()
  const profile = useSingleton<ProfileData>('profile')
  const act = useAct()
  const [subject, setSubject] = useState('')
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<{ actions: ProposedAction[]; message: string | null; plannedMinutes: number } | null>(null)
  const p = profile.data
  const hrs = hours || String(p?.studyHoursPerWeek || 6)
  const run = async () => {
    setBusy(true)
    const r = await act(() => lifeApi.planSessions({ subject, hoursPerWeek: Number(hrs), from: today, windowStart: p?.studyWindowStart ?? '16:00', windowEnd: p?.studyWindowEnd ?? '20:00' }))
    setBusy(false)
    if (r) setPlan(r)
  }
  const apply = async () => {
    if (!plan) return
    const r = await act(() => lifeApi.apply(plan.actions))
    if (r) { notifyLifeChanged(); setPlan(null); setSubject('') }
  }
  return (
    <Section title="Study planner">
      <p className="mb-3 text-[13.5px] text-ink-muted">Finds free time in your week — around your lectures and tasks — and drafts study sessions. Nothing is added until you confirm.</p>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run() }}>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} aria-label="Subject" placeholder="What are you studying?" className={field} />
        <div className="flex items-end gap-2">
          <div className="flex-1"><label htmlFor="pl-h" className="mb-1 block text-[12.5px] text-ink-muted">Hours this week</label><input id="pl-h" type="number" min={1} max={40} value={hours} placeholder={hrs} onChange={(e) => setHours(e.target.value)} className={field} /></div>
          <button className={btn.primary} disabled={!subject.trim() || busy}>{busy ? <Spinner /> : <Target size={15} />} Draft plan</button>
        </div>
        <p className="text-[12px] text-ink-faint">Uses your study window {fmtTime(p?.studyWindowStart ?? '16:00')}–{fmtTime(p?.studyWindowEnd ?? '20:00')}. No AI credits.</p>
      </form>
      {plan && (
        <div className="mt-4" aria-live="polite">
          {plan.message && <p className="mb-2 rounded-xl bg-primary-soft p-3 text-[13px]">{plan.message}</p>}
          {plan.actions.length === 0 ? <p className="text-[13.5px] text-ink-muted">No free slots fit in the next 7 days.</p> : (
            <>
              <ul className="divide-y divide-edge rounded-2xl border border-edge">
                {plan.actions.map((a) => { const x = a.data as { title: string; date: string; time: string; durationMin: number }; return <li key={a.id} className="flex justify-between gap-3 px-3.5 py-2.5 text-[13.5px]"><span className="truncate">{x.title}</span><span className="shrink-0 tabular-nums text-ink-muted">{fmtDateShort(x.date)} · {fmtTime(x.time)} · {x.durationMin}m</span></li> })}
              </ul>
              <div className="mt-3 flex gap-2"><button className={`${btn.primary} flex-1`} onClick={apply}><Check size={16} /> Add {plan.actions.length} sessions</button><button className={btn.ghost} onClick={() => setPlan(null)}>Discard</button></div>
            </>
          )}
        </div>
      )}
    </Section>
  )
}

// ------------------------------------------------------------- notes + study kits

function Notes() {
  const { items, loading, error, reload } = useItems<NoteData>('note')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const sel = items.find((n) => n.id === open) ?? null
  return (
    <Section title="Your notes" action={<button className={btn.primary} onClick={() => setCreating(true)}><Plus size={15} /> New note</button>}>
      {error && !items.length ? <ErrorState error={error} onRetry={() => reload()} /> : loading && !items.length ? <Skeleton className="h-24" /> : items.length === 0 ? (
        <EmptyState icon={<FileText size={26} />} title="Turn notes into study material" body="Paste lecture notes, or upload a document, then ask Bermi for a summary, flashcards and a quiz built only from your own text." action={<button className={btn.primary} onClick={() => setCreating(true)}>Add your first note</button>} />
      ) : (
        <ul className="divide-y divide-edge">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => setOpen(n.id)} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left">
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{n.data.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{n.data.course || 'No course'} · {n.data.body.length.toLocaleString()} characters{n.data.kit ? ' · study kit ready' : ''}</span></span>
                <ChevronRight size={16} className="text-ink-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <NewNote open={creating} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); reload(true); setOpen(id) }} />
      <NoteSheet note={sel} onClose={() => setOpen(null)} onChanged={() => reload(true)} />
    </Section>
  )
}

function NewNote({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const act = useAct()
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setTitle(''); setCourse(''); setBody('') } }, [open])
  const upload = async (f: File) => {
    setExtracting(true)
    const a = await act(() => legacy.extractFile(f))
    setExtracting(false)
    if (a) { setBody(a.text.slice(0, 40000)); if (!title) setTitle(a.name.replace(/\.[^.]+$/, '')) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="New note" wide>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const n = await act(() => lifeApi.create<NoteData>('note', { title: title.trim(), course: course.trim(), body, date: null, kit: null }), 'Note saved'); setBusy(false); if (n) onSaved(n.id) }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="n-t" className="mb-1.5 block text-[13px] font-medium">Title</label><input id="n-t" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={field} maxLength={160} /></div>
          <div><label htmlFor="n-c" className="mb-1.5 block text-[13px] font-medium">Course (optional)</label><input id="n-c" value={course} onChange={(e) => setCourse(e.target.value)} className={field} maxLength={120} /></div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><label htmlFor="n-b" className="text-[13px] font-medium">Notes</label>
            <button type="button" className="inline-flex min-h-[36px] items-center gap-1.5 text-[13px] font-medium text-primary" onClick={() => fileRef.current?.click()} disabled={extracting}>{extracting ? <Spinner size={14} /> : <Upload size={14} />} Upload a document</button>
            <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          </div>
          <textarea id="n-b" value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={40000} className={`${field} resize-y`} placeholder="Paste or type your notes. Uploads are converted to text here so you can check them before saving." />
          <p className="mt-1 text-[12px] text-ink-faint">{body.length.toLocaleString()} / 40,000 characters. Long documents are cut at the limit — you’ll see exactly what was kept.</p>
        </div>
        <button className={`${btn.primary} w-full`} disabled={!title.trim() || busy}>{busy ? <Spinner /> : <Check size={16} />} Save note</button>
      </form>
    </Sheet>
  )
}

function NoteSheet({ note, onClose, onChanged }: { note: Item<NoteData> | null; onClose: () => void; onChanged: () => void }) {
  const act = useAct()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ message: string; refunded?: boolean } | null>(null)
  const [kit, setKit] = useState<Kit | null>(null)
  const idem = useRef(newIdemKey())
  const costs = useAsync(() => (note ? lifeApi.credits().catch(() => null) : Promise.resolve(null)), [note?.id])
  useEffect(() => { setBody(note?.data.body ?? ''); setKit(note?.data.kit ?? null); setErr(null); idem.current = newIdemKey() }, [note?.id])
  if (!note) return <Sheet open={false} onClose={onClose} title="" children={null} />
  const cost = costs.data?.costs.study_materials
  const dirty = body !== note.data.body
  const make = async () => {
    setBusy(true); setErr(null)
    try {
      if (dirty) await lifeApi.update<NoteData>(note.id, { body })
      const r = await lifeApi.studyKit(note.id, idem.current)
      setKit(r.item.data.kit); onChanged(); costs.reload(true)
    } catch (e) {
      const le = e as LifeError
      setErr({ message: le.message, refunded: le.refunded })
      idem.current = newIdemKey()
    } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title={note.data.title} wide>
      <div className="space-y-5">
        <div>
          <label htmlFor="nb" className="sr-only">Note text</label>
          <textarea id="nb" value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={40000} className={`${field} resize-y`} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btn.ghost} disabled={!dirty} onClick={() => act(async () => { await lifeApi.update<NoteData>(note.id, { body }); onChanged() }, 'Saved')}>Save changes</button>
            <button className={btn.primary} disabled={busy || body.trim().length < 200} onClick={make}>{busy ? <Spinner /> : <Sparkles size={15} />} {kit ? 'Remake study kit' : 'Create study kit'}</button>
            <button className={`${btn.icon} ml-auto`} aria-label="Delete note" onClick={() => window.confirm('Delete this note and its study kit?') && act(async () => { await lifeApi.remove(note.id); onChanged(); onClose() }, 'Deleted')}><Trash2 size={16} /></button>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-faint">{body.trim().length < 200 ? 'Add at least a few sentences to build a kit.' : `Uses ${cost ?? 'a few'} AI credit${cost === 1 ? '' : 's'} (not money). Built only from your text; if the AI fails you aren’t charged.`}</p>
          {err && <p role="alert" className="mt-2 rounded-xl bg-surface-sunken p-3 text-[13px]">{err.message}{err.refunded ? ' You weren’t charged.' : ''}</p>}
        </div>
        {kit && <KitView kit={kit} />}
      </div>
    </Sheet>
  )
}

function KitView({ kit }: { kit: Kit }) {
  const [mode, setMode] = useState<'summary' | 'cards' | 'quiz'>('summary')
  return (
    <div>
      <div role="tablist" aria-label="Study kit" className="flex gap-2">
        {([['summary', 'Summary'], ['cards', `Flashcards (${kit.flashcards.length})`], ['quiz', `Quiz (${kit.quiz.length})`]] as const).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-medium ${mode === id ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'bg-surface-sunken text-ink-muted'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-4">
        {mode === 'summary' && (
          <div>
            <p className="text-[14.5px] leading-relaxed">{kit.summary}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px]">{kit.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
          </div>
        )}
        {mode === 'cards' && <Cards cards={kit.flashcards} />}
        {mode === 'quiz' && <Quiz quiz={kit.quiz} />}
        <p className="mt-4 text-[11.5px] text-ink-faint">AI-generated from your notes — check anything important against your source.</p>
      </div>
    </div>
  )
}

function Cards({ cards }: { cards: Kit['flashcards'] }) {
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  if (!cards.length) return <p className="text-[13.5px] text-ink-muted">No flashcards were produced — your notes may be too short.</p>
  const c = cards[i]
  const go = (n: number) => { setFlip(false); setI((i + n + cards.length) % cards.length) }
  return (
    <div>
      <button onClick={() => setFlip((f) => !f)} aria-label={flip ? 'Show question' : 'Show answer'} className="grid min-h-[170px] w-full place-items-center rounded-3xl border border-edge bg-surface-sunken p-6 text-center text-[17px] leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <span><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{flip ? 'Answer' : 'Question'}</span>{flip ? c.a : c.q}</span>
      </button>
      <div className="mt-3 flex items-center justify-between"><button className={btn.ghost} onClick={() => go(-1)}>Previous</button><span className="text-[13px] text-ink-muted" aria-live="polite">{i + 1} / {cards.length}</span><button className={btn.ghost} onClick={() => go(1)}>Next</button></div>
    </div>
  )
}

function Quiz({ quiz }: { quiz: Kit['quiz'] }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  if (!quiz.length) return <p className="text-[13.5px] text-ink-muted">No quiz questions were produced — your notes may be too short.</p>
  if (done) return (
    <div className="text-center"><Ring value={(score / quiz.length) * 100} size={96} stroke={8} label={`Score ${score} of ${quiz.length}`}>{score}/{quiz.length}</Ring>
      <p className="mt-3 text-[15px] font-medium">{score === quiz.length ? 'Perfect — nicely done.' : score >= quiz.length / 2 ? 'Good work. Review the ones you missed.' : 'A useful start. Re-read your notes and try again.'}</p>
      <button className={`${btn.soft} mt-3`} onClick={() => { setI(0); setPicked(null); setScore(0); setDone(false) }}><RotateCcw size={15} /> Try again</button></div>
  )
  const q = quiz[i]
  return (
    <div>
      <p className="text-[12.5px] text-ink-muted">Question {i + 1} of {quiz.length}</p>
      <p className="mt-1 text-[16px] font-medium">{q.q}</p>
      <div role="radiogroup" aria-label="Answers" className="mt-3 space-y-2">
        {q.options.map((o, k) => {
          const state = picked == null ? '' : k === q.answer ? 'border-primary bg-primary-soft' : k === picked ? 'border-edge-strong opacity-70' : 'opacity-60'
          return (
            <button key={k} role="radio" aria-checked={picked === k} disabled={picked != null} onClick={() => { setPicked(k); if (k === q.answer) setScore((s) => s + 1) }} className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-edge px-3.5 py-2 text-left text-[14px] ${state}`}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-[12px] font-semibold">{'ABCD'[k]}</span><span className="flex-1">{o}</span>
              {picked != null && k === q.answer && <Check size={16} className="text-primary" aria-label="Correct answer" />}
            </button>
          )
        })}
      </div>
      {picked != null && (
        <div aria-live="polite" className="mt-3">
          <p className="text-[13.5px]"><strong>{picked === q.answer ? 'Correct. ' : 'Not quite. '}</strong>{q.explain}</p>
          <button className={`${btn.primary} mt-3`} onClick={() => { if (i + 1 >= quiz.length) setDone(true); else { setI(i + 1); setPicked(null) } }}>{i + 1 >= quiz.length ? 'See score' : 'Next question'}</button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------- library

function Library() {
  const today = useToday()
  const content = useAsync(() => lifeApi.content(today), [today])
  const reading = useItems<ReadingData>('reading')
  const [open, setOpen] = useState<Book | null>(null)
  const books = content.data?.books ?? []
  const byBook = useMemo(() => new Map(reading.items.map((r) => [r.data.bookId, r])), [reading.items])
  return (
    <Section title="Reading library">
      {content.error && !content.data ? <ErrorState error={content.error} onRetry={() => content.reload()} /> : content.loading && !content.data ? <Skeleton className="h-40" /> : books.length === 0 ? (
        <EmptyState icon={<BookOpen size={26} />} title="The library is empty" body="Books appear here once they’re published by the Bermi team." />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-10 md:grid-cols-2">
          {books.map((b) => {
            const r = byBook.get(b.id)
            return (
              <li key={b.id} className="border-b border-edge">
                <button onClick={() => setOpen(b)} className="flex min-h-[72px] w-full items-center gap-3 py-3 text-left">
                  <Ring value={r?.data.progress ?? 0} size={44} stroke={5} label={`${b.title}: ${r?.data.progress ?? 0}% read`}>{r ? '' : <BookOpen size={16} />}</Ring>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{b.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{b.author} · {b.year}{r ? ` · ${r.data.status === 'done' ? 'finished' : r.data.status === 'reading' ? `${r.data.progress}%` : 'want to read'}` : ''}</span></span>
                  <ChevronRight size={16} className="text-ink-faint" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <BookSheet book={open} reading={open ? byBook.get(open.id) ?? null : null} concepts={content.data?.concepts.filter((c) => c.bookId === open?.id) ?? []} onClose={() => setOpen(null)} onChanged={() => reading.reload(true)} />
    </Section>
  )
}

function BookSheet({ book, reading, concepts, onClose, onChanged }: { book: Book | null; reading: Item<ReadingData> | null; concepts: { id: string; title: string }[]; onClose: () => void; onChanged: () => void }) {
  const act = useAct()
  const [notes, setNotes] = useState('')
  const [concept, setConcept] = useState<Concept | null>(null)
  useEffect(() => { setNotes(reading?.data.notes ?? ''); setConcept(null) }, [book?.id, reading?.id])
  if (!book) return <Sheet open={false} onClose={onClose} title="" children={null} />
  const save = (patch: Partial<ReadingData>) => act(async () => {
    if (reading) await lifeApi.update<ReadingData>(reading.id, patch)
    else await lifeApi.create<ReadingData>('reading', { bookId: book.id, status: 'want', progress: 0, ...patch })
    onChanged()
  })
  const status = reading?.data.status ?? null
  return (
    <Sheet open onClose={onClose} title={book.title} wide>
      <div className="space-y-5">
        <div>
          <p className="text-[13.5px] text-ink-muted">{book.author} · {book.year} · {book.publisher}</p>
          <p className="mt-2 text-[14.5px] leading-relaxed">{book.blurb}</p>
          <p className="mt-2 text-[12px] text-ink-faint">{book.license}{book.sourceUrl && <> · <a href={book.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-2">Find the book <ExternalLink size={11} /></a></>}</p>
        </div>
        <fieldset><legend className="mb-1.5 text-[13px] font-medium">Status</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">{([['want', 'Want to read'], ['reading', 'Reading'], ['done', 'Finished']] as const).map(([v, l]) => <Chip key={v} active={status === v} onClick={() => save({ status: v, ...(v === 'done' ? { progress: 100 } : {}) })}>{l}</Chip>)}</div>
        </fieldset>
        {status && status !== 'want' && (
          <div><label htmlFor="bp" className="mb-1.5 flex justify-between text-[13px] font-medium"><span>Progress</span><span className="tabular-nums text-ink-muted">{reading?.data.progress ?? 0}%</span></label>
            <input id="bp" type="range" min={0} max={100} step={5} value={reading?.data.progress ?? 0} onChange={(e) => save({ progress: Number(e.target.value), status: Number(e.target.value) >= 100 ? 'done' : 'reading' })} className="w-full accent-[var(--primary)]" /></div>
        )}
        <div><label htmlFor="bn" className="mb-1.5 block text-[13px] font-medium">Your notes</label>
          <textarea id="bn" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} className={`${field} resize-y`} />
          <button className={`${btn.soft} mt-2`} disabled={notes === (reading?.data.notes ?? '')} onClick={() => save({ notes })}>Save notes</button></div>
        {concepts.length > 0 && (
          <div><p className="mb-1.5 text-[13px] font-medium">Ideas from this book</p>
            <ul className="divide-y divide-edge">{concepts.map((c) => <li key={c.id}><button className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-[14px]" onClick={() => act(async () => setConcept(await lifeApi.concept(c.id)))}>{c.title}<ChevronRight size={15} className="text-ink-faint" aria-hidden /></button></li>)}</ul>
            {concept && <div className="mt-3 rounded-2xl bg-surface-sunken p-4"><p className="font-semibold">{concept.concept}</p><p className="mt-1.5 text-[14px] leading-relaxed">{concept.explanation}</p><p className="mt-2 text-[14px] text-ink-muted"><span className="font-semibold text-ink">Try: </span>{concept.action}</p></div>}
          </div>
        )}
        {reading && reading.data.reflections.length > 0 && (
          <div><p className="mb-1.5 text-[13px] font-medium">Your reflections</p><ul className="space-y-2">{[...reading.data.reflections].reverse().slice(0, 8).map((r, i) => <li key={i} className="text-[13.5px]"><span className="mr-2 text-[12px] text-ink-muted">{fmtDateShort(r.date)}</span>{r.text}</li>)}</ul></div>
        )}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------- listen & focus

function Listen() {
  const today = useToday()
  const content = useAsync(() => lifeApi.content(today), [today])
  const audio = content.data?.audio ?? []
  const [now, setNow] = useState<AudioAsset | null>(null)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-2">
      <Section title="Audio learning">
        {content.loading && !content.data ? <Skeleton className="h-24" /> : content.error && !content.data ? <ErrorState error={content.error} onRetry={() => content.reload()} compact /> : audio.length === 0 ? (
          <EmptyState icon={<Headphones size={26} />} title="No audio lessons yet" body="Audio only appears here once the Bermi team has uploaded content with a licence we can show. Nothing is auto-generated or borrowed." />
        ) : (
          <>
            <ul className="divide-y divide-edge">
              {audio.map((a) => (
                <li key={a.id}><button onClick={() => setNow(a)} aria-pressed={now?.id === a.id} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Headphones size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{a.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{[a.author, a.minutes ? `${a.minutes} min` : null].filter(Boolean).join(' · ')}</span></span></button></li>
              ))}
            </ul>
            {now && (
              <div className="mt-3 rounded-2xl bg-surface-sunken p-3.5">
                <p className="mb-2 text-[13.5px] font-medium">{now.title}</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio key={now.id} controls autoPlay src={now.url} preload="none" className="w-full" />
                <p className="mt-2 text-[11.5px] text-ink-faint">{now.attribution || now.license}</p>
              </div>
            )}
          </>
        )}
      </Section>
      <Section title="Focus sounds"><Focus /></Section>
    </div>
  )
}

function Focus() {
  const [scene, setScene] = useState<SceneId | null>(null)
  const [vol, setVol] = useState(0.35)
  const [mins, setMins] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { stopScene(); clearTimeout(timer.current) }, [])
  if (!soundscapeSupported()) return <p className="text-[13.5px] text-ink-muted">This browser can’t play generated sound. Try a recent Chrome, Safari or Firefox.</p>
  const play = (id: SceneId) => {
    clearTimeout(timer.current)
    if (scene === id) { stopScene(); setScene(null); return }
    startScene(id, vol); setScene(id)
    if (mins) timer.current = setTimeout(() => { stopScene(); setScene(null) }, mins * 60_000)
  }
  return (
    <div>
      <p className="mb-3 text-[13.5px] text-ink-muted">Soft background sound made on your device — no download. Some people find a steady sound helps them concentrate; others prefer quiet.</p>
      <ul className="space-y-2">
        {SCENES.map((s) => (
          <li key={s.id}><button onClick={() => play(s.id)} aria-pressed={scene === s.id} className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-3.5 text-left ${scene === s.id ? 'border-primary bg-primary-soft' : 'border-edge'}`}>
            {scene === s.id ? <Volume2 size={18} className="text-primary" /> : <VolumeX size={18} className="text-ink-faint" />}<span className="flex-1"><span className="block text-[14.5px] font-medium">{s.name}</span><span className="block text-[12.5px] text-ink-muted">{s.hint}</span></span><span className="text-[12.5px] font-medium">{scene === s.id ? 'Stop' : 'Play'}</span></button></li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="vol" className="mb-1 block text-[12.5px] text-ink-muted">Volume</label><input id="vol" type="range" min={0.05} max={0.8} step={0.05} value={vol} onChange={(e) => { const v = Number(e.target.value); setVol(v); setVolume(v) }} className="w-full accent-[var(--primary)]" /></div>
        <div><p className="mb-1 text-[12.5px] text-ink-muted">Stop after</p><div role="radiogroup" className="flex gap-1.5">{[[0, 'Never'], [25, '25m'], [45, '45m'], [60, '60m']].map(([m, l]) => <Chip key={m} active={mins === m} onClick={() => setMins(m as number)}>{l}</Chip>)}</div></div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- skills

function Skills() {
  const { items, loading, error, reload } = useItems<SkillData>('skill')
  const act = useAct()
  const [name, setName] = useState('')
  const set = (s: Item<SkillData>, patch: Partial<SkillData>) => act(async () => { await lifeApi.update<SkillData>(s.id, patch); reload(true) })
  return (
    <Section title="Skills I’m building">
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); act(async () => { await lifeApi.create<SkillData>('skill', { name: name.trim(), level: 1, target: 3 }); setName(''); reload(true) }, 'Skill added') }}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="New skill" placeholder="e.g. Public speaking" className={field} /><button className={btn.primary} disabled={!name.trim()}><Plus size={15} /> Add</button>
      </form>
      {error && !items.length ? <ErrorState error={error} onRetry={() => reload()} compact /> : loading && !items.length ? <Skeleton className="h-20" /> : items.length === 0 ? (
        <EmptyState icon={<Layers size={24} />} title="No skills yet" body="Name a skill, rate where you are (1–5) and where you’d like to be. You decide when you’ve levelled up." />
      ) : (
        <ul className="divide-y divide-edge">
          {items.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex items-center justify-between gap-2"><p className="truncate text-[14.5px] font-medium">{s.data.name}</p><button className={`${btn.icon} !h-8 !w-8 opacity-60 hover:opacity-100`} aria-label={`Remove ${s.data.name}`} onClick={() => window.confirm(`Remove “${s.data.name}”?`) && act(async () => { await lifeApi.remove(s.id); reload(true) })}><Trash2 size={14} /></button></div>
              <div className="mt-2 grid grid-cols-2 gap-4">
                {([['level', 'Now'], ['target', 'Aiming for']] as const).map(([k, l]) => (
                  <div key={k}><p className="mb-1 text-[12px] text-ink-muted">{l}: {s.data[k]} / 5</p>
                    <div role="radiogroup" aria-label={`${s.data.name} ${l}`} className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={s.data[k] === n} aria-label={`${n}`} onClick={() => set(s, { [k]: n })} className={`h-9 flex-1 rounded-lg text-[12.5px] font-medium ${n <= s.data[k] ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-muted'}`}>{n}</button>)}</div></div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
