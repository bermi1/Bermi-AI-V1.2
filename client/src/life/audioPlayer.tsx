import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ExternalLink, ListMusic, Moon, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, X } from 'lucide-react'
import { lifeApi, type AudioTrack, type Audiobook } from './api'
import { useAct } from './hooks'
import { Spinner } from './ui'

// The audiobook player: one audio element for the whole app, so listening
// continues while you move between screens. A mini player sits above the nav;
// tapping it opens the full player (chapters, speed, sleep timer, ±15/30 s).
// Progress is remembered per book on this device.

const KEY = 'bermi-ab-progress'
const SPEEDS = [0.8, 1, 1.25, 1.5, 1.75, 2]
const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}
export const coverUrl = (archiveId: string) => `https://archive.org/services/img/${encodeURIComponent(archiveId)}`

type Saved = Record<string, { i: number; t: number; at: number }>
const readSaved = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const writeSaved = (id: string, i: number, t: number) => {
  try { const all = readSaved(); all[id] = { i, t: Math.floor(t), at: Date.now() }; localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* private mode */ }
}

interface Ctx {
  book: Audiobook | null
  tracks: AudioTrack[]
  index: number
  time: number
  duration: number
  playing: boolean
  loading: boolean
  error: string | null
  rate: number
  sleepLeft: number | 'chapter' | null
  expanded: boolean
  play: (b: Audiobook) => void
  toggle: () => void
  seek: (t: number) => void
  skip: (d: number) => void
  goTo: (i: number) => void
  setRate: (r: number) => void
  setSleep: (m: number | 'chapter' | null) => void
  setExpanded: (v: boolean) => void
  stop: () => void
  saved: (id: string) => { i: number; t: number } | null
}
const AudioCtx = createContext<Ctx | null>(null)
export const useAudiobook = () => {
  const c = useContext(AudioCtx)
  if (!c) throw new Error('useAudiobook outside AudioProvider')
  return c
}
export const useOptionalAudiobook = () => useContext(AudioCtx)

export function AudioProvider({ children }: { children: ReactNode }) {
  const el = useRef<HTMLAudioElement | null>(null)
  const act = useAct()
  const [book, setBook] = useState<Audiobook | null>(null)
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [index, setIndex] = useState(0)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rate, setRateState] = useState(1)
  const [sleepEnd, setSleepEnd] = useState<number | 'chapter' | null>(null)
  const [tick, setTick] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const pendingSeek = useRef(0)
  const lastSave = useRef(0)
  const stateRef = useRef({ book, tracks, index, rate, sleepEnd })
  stateRef.current = { book, tracks, index, rate, sleepEnd }

  const load = useCallback((i: number, at = 0, autoplay = true) => {
    const a = el.current
    const { tracks: ts } = stateRef.current
    if (!a || !ts[i]) return
    setIndex(i)
    setTime(at)
    setDuration(ts[i].seconds || 0)
    pendingSeek.current = at
    a.src = ts[i].url
    a.playbackRate = stateRef.current.rate
    a.load()
    if (autoplay) a.play().catch(() => setPlaying(false))
  }, [])

  // One element for the app's lifetime.
  useEffect(() => {
    const a = new Audio()
    a.preload = 'metadata'
    el.current = a
    const save = () => { const s = stateRef.current; if (s.book) writeSaved(s.book.id, s.index, a.currentTime) }
    a.addEventListener('loadedmetadata', () => {
      if (pendingSeek.current > 0 && pendingSeek.current < a.duration) a.currentTime = pendingSeek.current
      pendingSeek.current = 0
      setDuration(a.duration || 0)
      setLoading(false)
    })
    a.addEventListener('durationchange', () => Number.isFinite(a.duration) && setDuration(a.duration))
    a.addEventListener('timeupdate', () => {
      setTime(a.currentTime)
      if (Date.now() - lastSave.current > 5000) { lastSave.current = Date.now(); save() }
    })
    a.addEventListener('play', () => { setPlaying(true); setError(null); window.dispatchEvent(new CustomEvent('bermi:audio-start', { detail: 'book' })) })
    a.addEventListener('pause', () => { setPlaying(false); save() })
    a.addEventListener('waiting', () => setLoading(true))
    a.addEventListener('playing', () => setLoading(false))
    a.addEventListener('error', () => { setLoading(false); setPlaying(false); setError('This chapter could not be played. Check your connection, or open the recording on the Internet Archive.') })
    a.addEventListener('ended', () => {
      const s = stateRef.current
      if (s.sleepEnd === 'chapter') { setSleepEnd(null); return }
      if (s.index + 1 < s.tracks.length) load(s.index + 1)
      else { setPlaying(false); if (s.book) writeSaved(s.book.id, 0, 0) }
    })
    const onOther = (e: Event) => { if ((e as CustomEvent).detail === 'beats') a.pause() }
    window.addEventListener('bermi:audio-start', onOther)
    window.addEventListener('pagehide', save)
    return () => { window.removeEventListener('pagehide', save); window.removeEventListener('bermi:audio-start', onOther); a.pause(); a.src = '' }
  }, [load])

  // Sleep timer.
  useEffect(() => {
    if (typeof sleepEnd !== 'number') return
    const t = setInterval(() => {
      setTick((n) => n + 1)
      if (Date.now() >= sleepEnd) { el.current?.pause(); setSleepEnd(null) }
    }, 1000)
    return () => clearInterval(t)
  }, [sleepEnd])
  const sleepLeft: Ctx['sleepLeft'] = sleepEnd === 'chapter' ? 'chapter' : typeof sleepEnd === 'number' ? Math.max(0, Math.round((sleepEnd - Date.now()) / 1000)) : null
  void tick

  const play = useCallback((b: Audiobook) => {
    const a = el.current
    if (!a) return
    if (stateRef.current.book?.id === b.id && stateRef.current.tracks.length) {
      setExpanded(true)
      if (a.paused) a.play().catch(() => setPlaying(false))
      return
    }
    a.pause()
    setBook(b); setTracks([]); setError(null); setLoading(true); setPlaying(false); setExpanded(true); setTime(0); setDuration(0)
    void act(async () => {
      const ts = await lifeApi.audiobookTracks(b.id)
      stateRef.current = { ...stateRef.current, book: b, tracks: ts }
      setTracks(ts)
      const s = readSaved()[b.id]
      const i = s && ts[s.i] ? s.i : 0
      load(i, s && ts[s.i] ? s.t : 0)
      return true
    }).then((r) => { if (r === undefined) { setLoading(false); setError('The chapter list could not be loaded just now. Try again, or open the recording on the Internet Archive.') } })
  }, [act, load])

  const toggle = useCallback(() => { const a = el.current; if (!a) return; if (a.paused) a.play().catch(() => setPlaying(false)); else a.pause() }, [])
  const seek = useCallback((t: number) => { const a = el.current; if (a && Number.isFinite(t)) { a.currentTime = Math.max(0, Math.min(t, a.duration || t)); setTime(a.currentTime) } }, [])
  const skip = useCallback((d: number) => { const a = el.current; if (a) seek(a.currentTime + d) }, [seek])
  const goTo = useCallback((i: number) => { if (i >= 0 && i < stateRef.current.tracks.length) load(i) }, [load])
  const setRate = useCallback((r: number) => { setRateState(r); if (el.current) el.current.playbackRate = r }, [])
  const setSleep = useCallback((m: number | 'chapter' | null) => setSleepEnd(m === null ? null : m === 'chapter' ? 'chapter' : Date.now() + m * 60_000), [])
  const stop = useCallback(() => { const a = el.current; if (a) { a.pause(); a.removeAttribute('src'); a.load() } setBook(null); setTracks([]); setPlaying(false); setExpanded(false); setSleepEnd(null) }, [])
  const saved = useCallback((id: string) => { const s = readSaved()[id]; return s ? { i: s.i, t: s.t } : null }, [])

  // Lock-screen / headset controls.
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!ms || !book) return
    const cur = tracks[index]
    try {
      ms.metadata = new MediaMetadata({ title: cur?.title ?? book.title, artist: book.author, album: book.title, artwork: [{ src: coverUrl(book.archiveId), sizes: '180x180' }] })
      ms.setActionHandler('play', () => el.current?.play())
      ms.setActionHandler('pause', () => el.current?.pause())
      ms.setActionHandler('seekbackward', () => skip(-15))
      ms.setActionHandler('seekforward', () => skip(30))
      ms.setActionHandler('previoustrack', () => goTo(index - 1))
      ms.setActionHandler('nexttrack', () => goTo(index + 1))
    } catch { /* unsupported action */ }
  }, [book, tracks, index, skip, goTo])

  const value = useMemo<Ctx>(() => ({ book, tracks, index, time, duration, playing, loading, error, rate, sleepLeft, expanded, play, toggle, seek, skip, goTo, setRate, setSleep, setExpanded, stop, saved }), [book, tracks, index, time, duration, playing, loading, error, rate, sleepLeft, expanded, play, toggle, seek, skip, goTo, setRate, setSleep, stop, saved])
  return (
    <AudioCtx.Provider value={value}>
      {children}
      <MiniPlayer />
      <FullPlayer />
    </AudioCtx.Provider>
  )
}

function Cover({ book, className = '' }: { book: Audiobook; className?: string }) {
  const [ok, setOk] = useState(true)
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-white/25 to-white/5 ${className}`}>
      {ok && <img src={coverUrl(book.archiveId)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setOk(false)} />}
    </div>
  )
}

function MiniPlayer() {
  const a = useAudiobook()
  if (!a.book || a.expanded) return null
  const cur = a.tracks[a.index]
  const pct = a.duration ? (a.time / a.duration) * 100 : 0
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom)+var(--beats-h,0px))] z-40 flex justify-center px-4 md:bottom-[calc(20px+var(--beats-h,0px))] md:left-auto md:right-6 md:justify-end md:px-0">
      <div className="dock pointer-events-auto relative w-full max-w-[400px] overflow-hidden rounded-[1.4rem] md:w-[360px]">
        <button onClick={() => a.setExpanded(true)} aria-label={`Open player: ${a.book.title}`} className="flex w-full items-center gap-3 p-2.5 pr-[116px] text-left text-white">
          <Cover book={a.book} className="h-11 w-11 shrink-0 rounded-xl" />
          <span className="min-w-0"><span className="block truncate text-[13.5px] font-semibold">{a.book.title}</span><span className="block truncate text-[12px] text-white/60">{a.loading && !cur ? 'Loading…' : cur?.title ?? a.book.author}</span></span>
        </button>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <button onClick={() => a.skip(-15)} aria-label="Back 15 seconds" className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"><RotateCcw size={16} /></button>
          <button onClick={a.toggle} aria-label={a.playing ? 'Pause' : 'Play'} className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0B1020]">{a.loading ? <Spinner size={16} /> : a.playing ? <Pause size={17} /> : <Play size={17} className="translate-x-px" />}</button>
          <button onClick={a.stop} aria-label="Close player" className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={15} /></button>
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10"><span className="block h-full bg-white" style={{ width: `${pct}%` }} /></span>
      </div>
    </div>
  )
}

function FullPlayer() {
  const a = useAudiobook()
  const [chapters, setChapters] = useState(false)
  const [sleepMenu, setSleepMenu] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!a.expanded) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') a.setExpanded(false)
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); a.toggle() }
      if (e.key === 'ArrowLeft') a.skip(-15)
      if (e.key === 'ArrowRight') a.skip(30)
    }
    document.addEventListener('keydown', onKey)
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = o }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.expanded])
  if (!a.book || !a.expanded) return null
  const book = a.book
  const cur = a.tracks[a.index]
  const pct = a.duration ? (a.time / a.duration) * 100 : 0
  const total = a.tracks.reduce((n, t) => n + t.seconds, 0)
  const before = a.tracks.slice(0, a.index).reduce((n, t) => n + t.seconds, 0)
  const bookPct = total ? Math.min(100, ((before + a.time) / total) * 100) : null
  const sleepLabel = a.sleepLeft === 'chapter' ? 'End of chapter' : typeof a.sleepLeft === 'number' ? fmt(a.sleepLeft) : null

  return (
    <div role="dialog" aria-modal="true" aria-label={`Now playing: ${book.title}`} className="fixed inset-0 z-[65] flex flex-col overflow-hidden text-white" style={{ background: '#080B16' }}>
      <img src={coverUrl(book.archiveId)} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-150 object-cover opacity-45 blur-3xl" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/85" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button ref={closeRef} onClick={() => a.setExpanded(false)} aria-label="Minimise player" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"><ChevronDown size={22} /></button>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/65">Now playing</p>
          <button onClick={() => setChapters((v) => !v)} aria-pressed={chapters} aria-label="Chapters" className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur ${chapters ? 'bg-white text-[#0B1020]' : 'bg-white/10 hover:bg-white/20'}`}><ListMusic size={19} /></button>
        </div>

        {chapters ? (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Chapters">
            {a.tracks.map((t, i) => (
              <button key={t.name} role="listitem" onClick={() => { a.goTo(i); setChapters(false) }} aria-current={i === a.index} className={`flex min-h-[54px] w-full items-center gap-3 border-b border-white/10 py-2.5 text-left ${i === a.index ? 'text-white' : 'text-white/75 hover:text-white'}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] tabular-nums ${i === a.index ? 'bg-white text-[#0B1020]' : 'bg-white/10'}`}>{i === a.index && a.playing ? <Pause size={13} /> : i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{t.title}</span>
                {t.seconds > 0 && <span className="text-[12px] tabular-nums text-white/50">{fmt(t.seconds)}</span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-1 items-center justify-center">
              <div className="relative">
                <Cover book={book} className="h-[min(46vh,300px)] w-[min(46vh,300px)] rounded-[1.6rem] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]" />
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.6rem]" style={{ background: 'linear-gradient(130deg, rgb(255 255 255 / .2), transparent 40%)' }} />
              </div>
            </div>
            <div className="mt-6">
              <h2 className="font-serif text-[24px] font-semibold leading-tight">{book.title}</h2>
              <p className="mt-0.5 text-[14px] text-white/65">{book.author}{cur ? ` · ${cur.title}` : ''}</p>
              {a.tracks.length > 1 && <p className="mt-0.5 text-[12px] text-white/45">Chapter {a.index + 1} of {a.tracks.length}{bookPct != null ? ` · ${Math.round(bookPct)}% of the book` : ''}</p>}
            </div>
          </>
        )}

        {a.error && (
          <p role="alert" className="mt-3 rounded-2xl bg-red-500/20 px-4 py-2.5 text-[13px] text-red-100">
            {a.error}{' '}
            {book.sourceUrl && <a href={book.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold underline">Open on the Internet Archive <ExternalLink size={11} /></a>}
          </p>
        )}

        <div className="mt-5">
          <label htmlFor="ab-seek" className="sr-only">Seek within chapter</label>
          <input id="ab-seek" type="range" className="seek" min={0} max={Math.max(a.duration, 1)} step={1} value={Math.min(a.time, a.duration || 0)} onChange={(e) => a.seek(Number(e.target.value))} style={{ ['--p' as string]: `${pct}%` }} aria-valuetext={`${fmt(a.time)} of ${fmt(a.duration)}`} disabled={!a.duration} />
          <div className="mt-1 flex justify-between text-[12px] tabular-nums text-white/60"><span>{fmt(a.time)}</span><span>-{fmt(Math.max(a.duration - a.time, 0))}</span></div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => a.skip(-15)} aria-label="Back 15 seconds" className="grid h-12 w-12 place-items-center rounded-full text-white/85 hover:bg-white/10"><RotateCcw size={22} /></button>
          <button onClick={() => a.goTo(a.index - 1)} disabled={a.index === 0} aria-label="Previous chapter" className="grid h-12 w-12 place-items-center rounded-full text-white/85 hover:bg-white/10 disabled:opacity-30"><SkipBack size={23} /></button>
          <button onClick={a.toggle} aria-label={a.playing ? 'Pause' : 'Play'} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white text-[#0B1020] shadow-[0_16px_40px_-10px_rgba(255,255,255,0.5)] transition-transform active:scale-95">
            {a.loading && !a.playing ? <Spinner size={26} /> : a.playing ? <Pause size={30} /> : <Play size={30} className="translate-x-0.5" />}
          </button>
          <button onClick={() => a.goTo(a.index + 1)} disabled={a.index >= a.tracks.length - 1} aria-label="Next chapter" className="grid h-12 w-12 place-items-center rounded-full text-white/85 hover:bg-white/10 disabled:opacity-30"><SkipForward size={23} /></button>
          <button onClick={() => a.skip(30)} aria-label="Forward 30 seconds" className="grid h-12 w-12 place-items-center rounded-full text-white/85 hover:bg-white/10"><RotateCw size={22} /></button>
        </div>

        <div className="relative mt-4 flex items-center justify-between">
          <button onClick={() => a.setRate(SPEEDS[(SPEEDS.indexOf(a.rate) + 1) % SPEEDS.length])} aria-label={`Playback speed ${a.rate}x. Tap to change`} className="min-h-[40px] rounded-full bg-white/10 px-4 text-[13px] font-semibold tabular-nums hover:bg-white/20">{a.rate}×</button>
          <div className="relative">
            <button onClick={() => setSleepMenu((v) => !v)} aria-expanded={sleepMenu} aria-label="Sleep timer" className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-[13px] font-medium ${sleepLabel ? 'bg-white text-[#0B1020]' : 'bg-white/10 hover:bg-white/20'}`}><Moon size={14} /> {sleepLabel ?? 'Sleep'}</button>
            {sleepMenu && (
              <div role="menu" className="absolute bottom-12 right-0 z-10 w-44 overflow-hidden rounded-2xl bg-[#161B2E] p-1 shadow-2xl ring-1 ring-white/10">
                {([['Off', null], ['15 minutes', 15], ['30 minutes', 30], ['60 minutes', 60], ['End of chapter', 'chapter']] as const).map(([l, v]) => (
                  <button key={l} role="menuitem" onClick={() => { a.setSleep(v); setSleepMenu(false) }} className="flex min-h-[40px] w-full items-center rounded-xl px-3 text-left text-[13.5px] hover:bg-white/10">{l}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/35">LibriVox recording · public domain in the USA · streamed from the Internet Archive</p>
      </div>
    </div>
  )
}
