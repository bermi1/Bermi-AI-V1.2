import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, ChevronDown, Clock, ExternalLink, EyeOff, Info, MapPin, Newspaper, RefreshCw, SlidersHorizontal, Sparkles, VolumeX, X } from 'lucide-react'
import { lifeApi, type BriefingCatalog, type BriefingDigest, type BriefingPrefsData, type BriefingView, type FeedItem, type FeedKind, type FeedSavedData } from './api'
import { newIdemKey, useAct, useItems, useSingleton, useToday, errText } from './hooks'
import { btn, Chip, EmptyState, ErrorState, field, Hero, HeroTabs, Section, Sheet, Skeleton, Spinner } from './ui'

type Tab = 'foryou' | 'breaking' | 'chances' | 'learn' | 'saved'

const KIND_LABEL: Record<FeedKind, string> = { headline: 'News', opportunity: 'Opportunity', read: 'Read', research: 'Research', book: 'Book', mindset: 'Mindset' }
const GROUP_ORDER = ['Money', 'Build', 'Tech', 'Health', 'Learn', 'World']

export function ageLabel(h: number | null, iso: string | null) {
  if (h == null) return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  if (h < 24 * 7) return `${Math.round(h / 24)}d ago`
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
}

export function Discover() {
  const today = useToday()
  const act = useAct()
  const prefs = useSingleton<BriefingPrefsData>('briefing_prefs')
  const saved = useItems<FeedSavedData>('feed_saved')
  const [tab, setTab] = useState<Tab>('foryou')
  const [topic, setTopic] = useState<string | null>(null)
  const [tune, setTune] = useState(false)
  const [brief, setBrief] = useState<BriefingView | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hiddenNow, setHiddenNow] = useState<Set<string>>(new Set())
  const seq = useRef(0)
  const retries = useRef(0)

  const load = useCallback(async (force = false) => {
    const id = ++seq.current
    force ? setRefreshing(true) : setLoading(true)
    try {
      const b = await lifeApi.briefing(force)
      if (id !== seq.current) return
      setBrief(b)
      setError(null)
    } catch (e) {
      if (id === seq.current) setError(e as Error)
    } finally {
      if (id === seq.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  // Load once the saved settings are known (and again whenever they change).
  const prefsStamp = prefs.item?.updated_at ?? (prefs.loading ? 'loading' : 'none')
  useEffect(() => {
    if (prefs.loading) return
    retries.current = 0
    void load()
  }, [prefsStamp, prefs.loading, load])

  // First request after a cold start can answer before slow sources have
  // been read; quietly look again a couple of times so the feed fills in.
  useEffect(() => {
    if (!brief?.meta?.warming || retries.current >= 2) return
    const t = setTimeout(() => {
      retries.current++
      void load()
    }, 7000)
    return () => clearTimeout(t)
  }, [brief, load])

  // A brand-new person is invited to tell Bermi who they are.
  const firstRun = brief?.empty === true
  useEffect(() => {
    if (firstRun && !prefs.data?.onboarded) setTune(true)
  }, [firstRun, prefs.data?.onboarded])

  const savedByUrl = useMemo(() => new Map(saved.items.map((i) => [i.data.url, i])), [saved.items])
  const hidden = useMemo(() => new Set([...(prefs.data?.hidden ?? []), ...hiddenNow]), [prefs.data?.hidden, hiddenNow])

  const toggleSave = (it: FeedItem) =>
    act(async () => {
      const ex = savedByUrl.get(it.url)
      if (ex) await lifeApi.remove(ex.id)
      else await lifeApi.create<FeedSavedData>('feed_saved', { url: it.url, title: it.title, source: it.source, kind: it.kind, summary: it.summary, publishedAt: it.publishedAt ?? '', deadline: it.deadline ?? '' })
      saved.reload(true)
    }, savedByUrl.has(it.url) ? 'Removed from saved' : 'Saved for later')

  const hide = (it: FeedItem) => {
    setHiddenNow((s) => new Set(s).add(it.id))
    void act(() => prefs.save({ hidden: [it.id, ...(prefs.data?.hidden ?? [])].slice(0, 300) }))
  }
  const muteSource = (it: FeedItem) => {
    if (!it.sourceId) return
    setHiddenNow((s) => new Set(s).add(it.id))
    void act(() => prefs.save({ mutedSources: [...new Set([it.sourceId as string, ...(prefs.data?.mutedSources ?? [])])].slice(0, 60) }), `You’ll see less from ${it.source}`)
  }

  const sec = brief?.sections
  const topicFilter = (list: FeedItem[]) => (topic ? list.filter((i) => i.topic === topic) : list)
  const visible = (list: FeedItem[] | undefined) => topicFilter((list ?? []).filter((i) => !hidden.has(i.id)))

  const plan = brief?.plan
  const where = plan?.country?.name
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const total = sec ? sec.forYou.length : 0

  return (
    <div>
      <Hero
        kicker={
          <span className="inline-flex items-center gap-1.5">
            {dateLine}
            {where && (
              <>
                <span aria-hidden>·</span>
                <MapPin size={13} aria-hidden /> {where}
              </>
            )}
          </span>
        }
        title="Your briefing"
        actions={
          <>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40" onClick={() => void load(true)} disabled={refreshing || loading} aria-label="Refresh the briefing" title="Refresh">
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => setTune(true)} aria-label="Tune your briefing" title="Tune your briefing">
              <SlidersHorizontal size={17} />
            </button>
          </>
        }
      >
        <HeroTabs
          label="Briefing sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'foryou', label: 'For you' },
            { id: 'breaking', label: 'Breaking', title: 'Breaking and local headlines' },
            { id: 'chances', label: 'Chances', title: 'Scholarships, grants, jobs and other opportunities' },
            { id: 'learn', label: 'Learn', title: 'Articles, research, books and mindset' },
            { id: 'saved', label: `Saved${saved.items.length ? ` ${saved.items.length}` : ''}` },
          ]}
        />
        {plan && plan.topics.length > 0 && tab !== 'saved' && (
          <div role="radiogroup" aria-label="Filter by topic" className="scroll-x -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0">
            <HeroChip active={topic === null} onClick={() => setTopic(null)}>All</HeroChip>
            {plan.topics.map((t) => (
              <HeroChip key={t.id} active={topic === t.id} onClick={() => setTopic(topic === t.id ? null : t.id)}>
                {t.label}
              </HeroChip>
            ))}
          </div>
        )}
      </Hero>

      {loading && !brief ? (
        <div aria-busy="true" aria-live="polite" className="mt-6 space-y-3">
          <p className="flex items-center gap-2 text-[13px] text-ink-muted"><Spinner /> Gathering news and opportunities for you…</p>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : error && !brief ? (
        <ErrorState error={error} onRetry={() => void load()} />
      ) : brief?.empty ? (
        <EmptyState
          icon={<Newspaper size={30} />}
          title="Tell Bermi what you care about"
          body="Pick who you are, what you follow and where you are. Bermi then searches trusted sites and the wider web for headlines, opportunities, articles and books made for you."
          action={<button className={btn.primary} onClick={() => setTune(true)}>Set up my briefing</button>}
        />
      ) : sec ? (
        <>
          {brief.meta?.offline && (
            <p role="status" className="mt-4 flex gap-2 rounded-2xl bg-surface-sunken p-3.5 text-[13px] text-ink-muted">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> We couldn’t reach the news sources just now. Nothing is made up — try refreshing in a minute.
            </p>
          )}
          {brief.meta?.warming && !brief.meta.offline && (
            <p role="status" className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-muted"><Spinner /> Still reading sources — more is arriving…</p>
          )}

          {tab === 'foryou' && (
            <>
              <Digest today={today} disabled={total < 3} />
              <Feed items={visible(sec.forYou)} empty={emptyHint(plan?.topics.length ?? 0, !!topic)} savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              <Official items={brief.official ?? []} where={where} />
            </>
          )}

          {tab === 'breaking' && (
            <>
              <Section title="Breaking now">
                <Feed bare items={visible(sec.breaking)} empty="No breaking stories on your topics right now. Bermi only calls something breaking when it is under 3 hours old and confirmed by a primary newsroom or several outlets." savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              </Section>
              <Section title={where ? `Around ${where}` : 'Top headlines'}>
                <Feed bare items={visible(sec.local)} empty={where ? `No fresh headlines for ${where} yet.` : 'Add your country in Tune your briefing to see local headlines.'} savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              </Section>
            </>
          )}

          {tab === 'chances' && (
            <>
              <Feed items={visible(sec.opportunities)} empty="No open opportunities matched your interests right now. Add a field of study or ambition in Tune your briefing to widen the search." savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              <Official items={brief.official ?? []} where={where} />
            </>
          )}

          {tab === 'learn' && (
            <>
              <Group title="Articles & ideas" items={visible(sec.reads)} savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              <Group title="Research" items={visible(sec.research)} savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              <Group title="Books to read" items={visible(sec.books)} savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              <Group title="Mindset & reflection" items={visible(sec.mindset)} savedByUrl={savedByUrl} onSave={toggleSave} onHide={hide} onMute={muteSource} />
              {!visible(sec.reads).length && !visible(sec.research).length && !visible(sec.books).length && !visible(sec.mindset).length && (
                <EmptyState icon={<Newspaper size={28} />} title="Nothing to read yet" body="Follow a few more topics and check back — new articles, papers and books appear as sources update." action={<button className={btn.soft} onClick={() => setTune(true)}>Tune your briefing</button>} />
              )}
            </>
          )}

          {tab === 'saved' && <Saved items={saved.items} onChange={() => saved.reload(true)} act={act} />}

          <Transparency brief={brief} onTune={() => setTune(true)} />
        </>
      ) : null}

      <TuneSheet
        open={tune}
        onClose={() => setTune(false)}
        prefs={prefs.data}
        onSave={async (p) => {
          const ok = await act(() => prefs.save({ ...p, onboarded: true }), 'Briefing updated')
          if (ok) {
            setTune(false)
            setTopic(null)
          }
        }}
        onResetHidden={() => {
          setHiddenNow(new Set())
          void act(() => prefs.save({ hidden: [] }), 'Hidden stories are back')
        }}
      />
      {saved.error && tab === 'saved' && <p className="mt-3 text-[12.5px] text-danger">{errText(saved.error)}</p>}
      <span className="sr-only" aria-live="polite">{refreshing ? 'Refreshing' : ''}</span>
    </div>
  )
}

const emptyHint = (topics: number, filtered: boolean) =>
  filtered ? 'Nothing on this topic right now. Try “All”.' : topics ? 'No fresh matches yet. Sources update through the day — pull to refresh in a little while.' : 'Pick topics in Tune your briefing.'

function HeroChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`min-h-[32px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${active ? 'bg-white text-[#0B1020]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ feed

interface FeedProps {
  items: FeedItem[]
  savedByUrl: Map<string, unknown>
  onSave: (it: FeedItem) => void
  onHide: (it: FeedItem) => void
  onMute: (it: FeedItem) => void
}

function Feed({ items, empty, bare, ...rest }: FeedProps & { empty: string; bare?: boolean }) {
  if (!items.length) return <p className={`${bare ? '' : 'mt-6 '}rounded-2xl bg-surface-sunken p-4 text-center text-[13px] text-ink-muted`}>{empty}</p>
  return (
    <ul className={`${bare ? '' : 'mt-4 '}grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2`}>
      {items.map((it) => (
        <li key={it.id} className="min-w-0">
          <Card item={it} saved={rest.savedByUrl.has(it.url)} onSave={() => rest.onSave(it)} onHide={() => rest.onHide(it)} onMute={() => rest.onMute(it)} />
        </li>
      ))}
    </ul>
  )
}

function Group({ title, items, ...rest }: FeedProps & { title: string }) {
  if (!items.length) return null
  return (
    <Section title={title}>
      <Feed bare items={items.slice(0, 8)} empty="" {...rest} />
    </Section>
  )
}

function Card({ item, saved, onSave, onHide, onMute }: { item: FeedItem; saved: boolean; onSave: () => void; onHide: () => void; onMute: () => void }) {
  const [imgOk, setImgOk] = useState(true)
  const book = item.kind === 'book'
  const age = ageLabel(item.ageH, item.publishedAt)
  const closes = item.deadline ? daysUntil(item.deadline) : null
  return (
    <article className="tile flex gap-3 p-3.5 sm:p-4">
      {item.image && imgOk && (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
          className={`shrink-0 rounded-xl bg-surface-sunken object-cover ${book ? 'h-[92px] w-[62px]' : 'h-[72px] w-[72px]'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
          <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">{KIND_LABEL[item.kind]}</span>
          <span className="max-w-[55%] truncate font-medium">{item.source}</span>
          {age && (
            <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden /> {age}</span>
          )}
          {item.cluster > 1 && <span title={item.also.join(', ')}>· {item.cluster} outlets</span>}
        </p>
        <h3 className="mt-1 text-[14.5px] font-semibold leading-snug">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:underline">
            {item.title}
            <span className="sr-only"> (opens {item.source} in a new tab)</span>
          </a>
        </h3>
        {item.summary && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{item.summary}</p>}
        {closes != null && (
          <p className={`mt-1.5 text-[12px] font-semibold ${closes <= 7 ? 'text-danger' : 'text-ink'}`}>
            {closes === 0 ? 'Closes today' : `Closes in ${closes} day${closes === 1 ? '' : 's'}`} · {item.deadline}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11.5px] text-ink-faint" title={item.why.join(' · ')}>{item.why[0] ? `Why: ${item.why.join(' · ')}` : ''}</p>
          <div className="flex shrink-0 items-center">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className={btn.icon + ' !h-9 !w-9'} aria-label={`Open ${item.source}`}>
              <ExternalLink size={16} />
            </a>
            <button className={btn.icon + ' !h-9 !w-9'} onClick={onSave} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save for later'}>
              {saved ? <BookmarkCheck size={17} className="text-primary" /> : <Bookmark size={17} />}
            </button>
            <button className={btn.icon + ' !h-9 !w-9'} onClick={onHide} aria-label="Hide this story">
              <EyeOff size={16} />
            </button>
            {item.sourceId && (
              <button className={btn.icon + ' !h-9 !w-9'} onClick={onMute} aria-label={`Show less from ${item.source}`} title={`Show less from ${item.source}`}>
                <VolumeX size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

const daysUntil = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date()
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86_400_000)
  return diff >= 0 ? diff : null
}

function Official({ items, where }: { items: { id: string; name: string; url: string; topics: string[] }[]; where?: string }) {
  if (!items.length) return null
  return (
    <Section title={where ? `Official sources — ${where}` : 'Official sources'}>
      <p className="mb-3 text-[12.5px] text-ink-muted">Direct links to the institutions behind your interests. Bermi doesn’t copy their pages — it points you to the source.</p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
        {items.map((o) => (
          <li key={o.id}>
            <a href={o.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-surface-sunken px-3.5 py-2.5 transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold">{o.name}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">{o.topics.join(' · ')}</span>
              </span>
              <ExternalLink size={15} className="shrink-0 text-ink-muted" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ------------------------------------------------------------------ digest

function Digest({ today, disabled }: { today: string; disabled: boolean }) {
  const key = `bermi-brief-digest-${today}`
  const [digest, setDigest] = useState<BriefingDigest | null>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as BriefingDigest) : null
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)
  const act = useAct()
  const idem = useRef(newIdemKey())

  const run = async () => {
    setBusy(true)
    const r = await act(() => lifeApi.briefingDigest(idem.current))
    setBusy(false)
    if (r) {
      idem.current = newIdemKey()
      setDigest(r.digest)
      try {
        localStorage.setItem(key, JSON.stringify(r.digest))
      } catch {
        /* private mode — it just won't be remembered */
      }
    }
  }

  if (!digest)
    return (
      <div className="tile mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Brief me on what matters today</p>
          <p className="text-[12.5px] text-ink-muted">A short summary tied to your goals, using only the headlines below. 2 credits.</p>
        </div>
        <button className={btn.primary} onClick={run} disabled={busy || disabled}>
          {busy ? <Spinner /> : <Sparkles size={15} />} {busy ? 'Reading…' : 'Brief me'}
        </button>
      </div>
    )
  return (
    <section className="tile mt-4 p-4 sm:p-5" aria-label="Today’s brief">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles size={16} className="text-primary" /> Today’s brief</h2>
        <button className={btn.icon + ' !h-8 !w-8'} aria-label="Dismiss today’s brief" onClick={() => { setDigest(null); try { localStorage.removeItem(key) } catch { /* ignore */ } }}><X size={16} /></button>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed">{digest.summary}</p>
      {digest.why && <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{digest.why}</p>}
      {digest.actions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {digest.actions.map((a) => (
            <li key={a} className="flex gap-2 text-[13.5px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />{a}</li>
          ))}
        </ul>
      )}
      {digest.sources.length > 0 && (
        <p className="mt-3 text-[11.5px] text-ink-faint">
          Based on:{' '}
          {digest.sources.map((s, i) => (
            <span key={s.url}>{i > 0 && ' · '}<a className="underline underline-offset-2" href={s.url} target="_blank" rel="noopener noreferrer">{s.source || s.title.slice(0, 30)}</a></span>
          ))}
        </p>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ saved

function Saved({ items, onChange, act }: { items: { id: string; data: FeedSavedData }[]; onChange: () => void; act: ReturnType<typeof useAct> }) {
  if (!items.length)
    return <EmptyState icon={<Bookmark size={28} />} title="Nothing saved yet" body="Tap the bookmark on any story, opportunity or book to keep it here — even after it leaves the feed." />
  const sorted = [...items].sort((a, b) => Number(a.data.read) - Number(b.data.read) || b.data.savedAt.localeCompare(a.data.savedAt))
  return (
    <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
      {sorted.map(({ id, data }) => {
        const closes = data.deadline ? daysUntil(data.deadline) : null
        return (
          <li key={id} className={`tile min-w-0 p-3.5 sm:p-4 ${data.read ? 'opacity-70' : ''}`}>
            <p className="text-[11.5px] text-ink-muted"><span className="font-semibold text-primary">{KIND_LABEL[data.kind]}</span> · {data.source}</p>
            <h3 className="mt-1 text-[14.5px] font-semibold leading-snug">
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{data.title}</a>
            </h3>
            {closes != null && <p className="mt-1 text-[12px] font-semibold">Closes in {closes} day{closes === 1 ? '' : 's'} · {data.deadline}</p>}
            <div className="mt-2 flex gap-2">
              <button className={btn.soft + ' !min-h-[34px] !px-3 !text-[12.5px]'} onClick={() => void act(async () => { await lifeApi.update<FeedSavedData>(id, { read: !data.read }); onChange() })}>
                {data.read ? 'Mark unread' : 'Mark read'}
              </button>
              <button className={btn.ghost + ' !min-h-[34px] !px-3 !text-[12.5px]'} onClick={() => void act(async () => { await lifeApi.remove(id); onChange() }, 'Removed')}>Remove</button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ------------------------------------------------------------------ transparency

function Transparency({ brief, onTune }: { brief: BriefingView; onTune: () => void }) {
  const [open, setOpen] = useState(false)
  const m = brief.meta
  const plan = brief.plan
  return (
    <section className="mt-2 rounded-3xl border border-edge p-4 text-[13px]">
      <button className="flex w-full items-center justify-between gap-3 text-left font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2"><Info size={16} aria-hidden /> How this briefing is built</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
          <p>
            Bermi follows <strong className="text-ink">{plan.topics.map((t) => t.label).join(', ') || 'nothing yet'}</strong>
            {plan.customs.length > 0 && <> and <strong className="text-ink">{plan.customs.join(', ')}</strong></>}
            {plan.country ? <>, with a focus on <strong className="text-ink">{plan.country.name}</strong></> : null}. Stories are ranked by how well they match, how fresh they are, how local they are and how trustworthy the source is. Nothing is shown unless it matches something you follow.
          </p>
          {m && (
            <p>
              Read <strong className="text-ink">{m.sourcesAnswered}</strong> sites and searches from a registry of <strong className="text-ink">{m.registrySize}+</strong> trusted sources, plus live searches on Google News, PubMed, arXiv, Open Library and remote-job boards. {m.sources.failed > 0 ? `${m.sources.failed} source${m.sources.failed === 1 ? ' was' : 's were'} unreachable and skipped. ` : ''}Duplicate stories are merged.
            </p>
          )}
          {plan.searches.length > 0 && (
            <div>
              <p className="font-medium text-ink">Searches run for you</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {plan.searches.slice(0, 10).map((s) => <span key={s} className="rounded-full bg-surface-sunken px-2.5 py-1 text-[12px]">{s}</span>)}
              </p>
            </div>
          )}
          <p>Only search words (like “Tanzania treasury bonds”) go to public search services — never your name, email or notes. Bermi shows headlines, short snippets and links; the full article stays on the publisher’s site.</p>
          <button className={btn.soft} onClick={onTune}>Tune your briefing</button>
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ tune

function TuneSheet({ open, onClose, prefs, onSave, onResetHidden }: { open: boolean; onClose: () => void; prefs: BriefingPrefsData | null; onSave: (p: Partial<BriefingPrefsData>) => Promise<void>; onResetHidden: () => void }) {
  const [cat, setCat] = useState<BriefingCatalog | null>(null)
  const [catErr, setCatErr] = useState<string | null>(null)
  const [personas, setPersonas] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [custom, setCustom] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [country, setCountry] = useState('')
  const [lang, setLang] = useState<'en' | 'sw' | 'both'>('en')
  const [ambition, setAmbition] = useState('')
  const [mutedTopics, setMutedTopics] = useState<string[]>([])
  const [mutedSources, setMutedSources] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPersonas(prefs?.personas ?? [])
    setTopics(Object.keys(prefs?.topics ?? {}))
    setCustom(prefs?.custom ?? [])
    setCountry(prefs?.country ?? '')
    setLang(prefs?.lang ?? 'en')
    setAmbition(prefs?.ambition ?? '')
    setMutedTopics(prefs?.mutedTopics ?? [])
    setMutedSources(prefs?.mutedSources ?? [])
    if (!cat)
      lifeApi.briefingCatalog().then(setCat).catch((e) => setCatErr(errText(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const addCustom = () => {
    const v = draft.trim().slice(0, 60)
    if (v && !custom.some((c) => c.toLowerCase() === v.toLowerCase()) && custom.length < 8) setCustom([...custom, v])
    setDraft('')
  }
  const grouped = useMemo(() => GROUP_ORDER.map((g) => ({ g, items: (cat?.topics ?? []).filter((t) => t.group === g) })).filter((x) => x.items.length), [cat])
  const nothing = !personas.length && !topics.length && !custom.length && !ambition.trim()

  const save = async () => {
    setBusy(true)
    const keepWeights = prefs?.topics ?? {}
    await onSave({
      personas,
      topics: Object.fromEntries(topics.map((t) => [t, keepWeights[t] ?? 1])),
      custom,
      country,
      lang,
      ambition: ambition.trim(),
      mutedTopics,
      mutedSources,
    })
    setBusy(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Tune your briefing" wide>
      <div className="space-y-6 pb-2">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Tell Bermi who you are and where you want to go. It searches trusted sites and the wider web for the news, opportunities, articles and books that fit — and shows why each one is there. You can change this any time.
        </p>
        {catErr && <p role="alert" className="text-[13px] text-danger">{catErr}</p>}
        {!cat && !catErr && <Skeleton className="h-40" />}
        {cat && (
          <>
            <fieldset>
              <legend className="mb-2 text-[13.5px] font-semibold">I am a…</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Who you are">
                {cat.personas.map((p) => (
                  <Pill key={p.id} on={personas.includes(p.id)} onClick={() => toggle(personas, setPersonas, p.id)}>{p.label}</Pill>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[13.5px] font-semibold">I want to follow</legend>
              <div className="space-y-3">
                {grouped.map(({ g, items }) => (
                  <div key={g}>
                    <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.1em] text-ink-faint">{g}</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={g}>
                      {items.map((t) => (
                        <Pill key={t.id} on={topics.includes(t.id)} onClick={() => toggle(topics, setTopics, t.id)}>{t.label}</Pill>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div>
          <label htmlFor="brief-custom" className="mb-1.5 block text-[13.5px] font-semibold">Anything else you care about?</label>
          <div className="flex gap-2">
            <input
              id="brief-custom"
              className={field}
              value={draft}
              maxLength={60}
              placeholder="e.g. beekeeping, cardiology, Premier League…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            />
            <button type="button" className={btn.soft} onClick={addCustom} disabled={!draft.trim()}>Add</button>
          </div>
          {custom.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {custom.map((c) => (
                <li key={c}>
                  <button type="button" className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-primary-soft px-3 text-[13px] font-medium text-primary" onClick={() => setCustom(custom.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
                    {c} <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[12px] text-ink-faint">Bermi searches the web directly for these, so any interest works.</p>
        </div>

        <div>
          <label htmlFor="brief-ambition" className="mb-1.5 block text-[13.5px] font-semibold">Where do you want to get to?</label>
          <textarea id="brief-ambition" className={field + ' min-h-[76px] resize-y'} maxLength={240} value={ambition} onChange={(e) => setAmbition(e.target.value)} placeholder="e.g. Become a surgeon and fund my studies; build a bond portfolio for my family" />
          <p className="mt-1 text-[12px] text-ink-faint">Your ambition shapes the opportunities Bermi looks for — scholarships, internships, grants.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="brief-country" className="mb-1.5 block text-[13.5px] font-semibold">Where are you?</label>
            <select id="brief-country" className={field} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Auto (from my profile region)</option>
              {(cat?.countries ?? []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-[13.5px] font-semibold" id="brief-lang">Language</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="brief-lang">
              <Chip active={lang === 'en'} onClick={() => setLang('en')}>English</Chip>
              <Chip active={lang === 'sw'} onClick={() => setLang('sw')}>Kiswahili</Chip>
              <Chip active={lang === 'both'} onClick={() => setLang('both')}>Both</Chip>
            </div>
          </div>
        </div>

        {(mutedTopics.length > 0 || mutedSources.length > 0 || (prefs?.hidden.length ?? 0) > 0) && (
          <div className="rounded-2xl bg-surface-sunken p-3.5 text-[13px]">
            <p className="font-semibold">Hidden from your feed</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {mutedTopics.map((t) => <li key={t}><button type="button" className={btn.ghost + ' !min-h-[32px] !px-3 !text-[12.5px]'} onClick={() => setMutedTopics(mutedTopics.filter((x) => x !== t))}>Unmute topic: {cat?.topics.find((x) => x.id === t)?.label ?? t}</button></li>)}
              {mutedSources.map((s) => <li key={s}><button type="button" className={btn.ghost + ' !min-h-[32px] !px-3 !text-[12.5px]'} onClick={() => setMutedSources(mutedSources.filter((x) => x !== s))}>Unmute source: {s}</button></li>)}
              {(prefs?.hidden.length ?? 0) > 0 && <li><button type="button" className={btn.ghost + ' !min-h-[32px] !px-3 !text-[12.5px]'} onClick={onResetHidden}>Bring back {prefs?.hidden.length} hidden stories</button></li>}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-ink-faint">{cat ? `Reads from ${cat.registry.withFeeds} live feeds + web search.` : ''}</p>
          <button className={btn.primary} onClick={save} disabled={busy || nothing}>
            {busy ? <Spinner /> : null} Build my briefing
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${on ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-muted hover:text-ink'}`}
    >
      {children}
    </button>
  )
}
