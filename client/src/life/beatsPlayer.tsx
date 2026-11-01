import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import type { AudioAsset } from './api'
import { setVolume as setAmbientVolume, startScene, stopScene, SCENES, type SceneId } from './soundscape'
import { youtubeId } from './Player'
import { Spinner } from './ui'

// Beats keep playing while you move around Bermi. One YouTube player lives at
// the top of the app (always visible — YouTube requires that — as a small card
// that grows into a full panel), and a generated ambient layer can sit under it.
// Starting an audiobook pauses the beats, and vice versa.
//
// Limit: a phone that locks its screen or backgrounds the browser may pause
// YouTube's player; moving between screens inside Bermi never does.

export interface BeatsStart {
  title?: string
  note?: string | null
  beatVolume?: number
  scene?: SceneId | null
  ambient?: number
}

interface Ctx {
  queue: AudioAsset[]
  index: number
  playing: boolean
  loading: boolean
  title: string
  note: string | null
  beatVolume: number
  scene: SceneId | null
  ambient: number
  expanded: boolean
  broken: Set<string>
  active: boolean
  start: (tracks: AudioAsset[], opts?: BeatsStart) => void
  playAt: (id: string, list?: AudioAsset[]) => void
  toggle: () => void
  next: () => void
  prev: () => void
  setBeatVolume: (v: number) => void
  setScene: (s: SceneId | null) => void
  setAmbient: (v: number) => void
  setExpanded: (v: boolean) => void
  stop: () => void
}
const BeatsCtx = createContext<Ctx | null>(null)
export const useBeats = () => {
  const c = useContext(BeatsCtx)
  if (!c) throw new Error('useBeats outside BeatsProvider')
  return c
}
export const useOptionalBeats = () => useContext(BeatsCtx)

const YT = 'https://www.youtube-nocookie.com'
export const AUDIO_EVENT = 'bermi:audio-start'

export function BeatsProvider({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const ready = useRef(false)
  const [queue, setQueue] = useState<AudioAsset[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('Beats')
  const [note, setNote] = useState<string | null>(null)
  const [beatVolume, setBeatVolumeState] = useState(70)
  const [scene, setSceneState] = useState<SceneId | null>(null)
  const [ambient, setAmbientState] = useState(0.2)
  const [expanded, setExpanded] = useState(false)
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [firstId, setFirstId] = useState<string | null>(null)
  const embedded = useRef<string | null>(null) // the video id the iframe was created with
  const st = useRef({ queue, index, beatVolume, scene, ambient, broken })
  st.current = { queue, index, beatVolume, scene, ambient, broken }

  const send = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YT)
  }, [])

  const loadIndex = useCallback((i: number) => {
    const t = st.current.queue[i]
    const id = t ? youtubeId(t.url) : null
    if (!id) return
    setIndex(i)
    setLoading(true)
    if (ready.current) { send('loadVideoById', [id]); send('setVolume', [st.current.beatVolume]) }
  }, [send])

  const step = useCallback((dir: 1 | -1) => {
    const { queue: q, index: i, broken: b } = st.current
    if (!q.length) return
    for (let k = 1; k <= q.length; k++) {
      const n = (i + dir * k + q.length * k) % q.length
      if (!b.has(q[n].id)) return loadIndex(n)
    }
  }, [loadIndex])

  // Player events.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      let d: { event?: string; info?: unknown }
      try { d = JSON.parse(e.data) } catch { return }
      if (d.event === 'onReady' || d.event === 'initialDelivery') {
        if (!ready.current) {
          ready.current = true
          send('setVolume', [st.current.beatVolume])
          const cur = st.current.queue[st.current.index]
          const id = cur ? youtubeId(cur.url) : null
          if (id && id !== embedded.current) send('loadVideoById', [id])
        }
      }
      if (d.event === 'onStateChange' && typeof d.info === 'number') {
        if (d.info === 0) step(1)
        setPlaying(d.info === 1 || d.info === 3)
        if (d.info === 1) { setLoading(false); ready.current = true }
        if (d.info === 3) setLoading(true)
      }
      if (d.event === 'onError') {
        const cur = st.current.queue[st.current.index]
        if (cur) setBroken((b) => new Set(b).add(cur.id))
        setTimeout(() => step(1), 50)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [send, step])

  // Ambient layer follows play state.
  useEffect(() => {
    if (playing && scene) startScene(scene, ambient)
    else stopScene()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene])
  useEffect(() => { setAmbientVolume(ambient) }, [ambient])
  useEffect(() => () => stopScene(), [])

  // Only one thing plays at a time.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail === 'book') { send('pauseVideo'); setPlaying(false) }
    }
    window.addEventListener(AUDIO_EVENT, onOther)
    return () => window.removeEventListener(AUDIO_EVENT, onOther)
  }, [send])

  // Space reserved for the card so page content and the audiobook bar clear it.
  useEffect(() => {
    document.documentElement.style.setProperty('--beats-h', queue.length && !expanded ? '168px' : '0px')
    return () => { document.documentElement.style.removeProperty('--beats-h') }
  }, [queue.length, expanded])

  const start = useCallback((tracks: AudioAsset[], opts: BeatsStart = {}) => {
    const playable = tracks.filter((t) => youtubeId(t.url))
    if (!playable.length) return
    window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: 'beats' }))
    st.current = { ...st.current, queue: playable, index: 0, broken: new Set() }
    setBroken(new Set())
    setQueue(playable)
    setTitle(opts.title ?? 'Beats')
    setNote(opts.note ?? null)
    if (opts.beatVolume != null) { setBeatVolumeState(opts.beatVolume); st.current.beatVolume = opts.beatVolume }
    if (opts.scene !== undefined) setSceneState(opts.scene)
    if (opts.ambient != null) setAmbientState(opts.ambient)
    const id = youtubeId(playable[0].url)!
    setIndex(0)
    setLoading(true)
    if (ready.current && frame.current) { send('loadVideoById', [id]); send('setVolume', [st.current.beatVolume]) }
    else if (firstId === null) { embedded.current = id; setFirstId(id) }
  }, [send, firstId])

  const playAt = useCallback((id: string, list?: AudioAsset[]) => {
    const q = list ?? st.current.queue
    const i = q.findIndex((t) => t.id === id)
    if (i < 0) return
    if (list && list !== st.current.queue) { start(list, { title: 'Beats' }); setTimeout(() => loadIndex(i), 0); return }
    window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: 'beats' }))
    loadIndex(i)
  }, [loadIndex, start])

  const toggle = useCallback(() => {
    if (playing) send('pauseVideo')
    else { window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: 'beats' })); send('playVideo') }
  }, [playing, send])
  const setBeatVolume = useCallback((v: number) => { setBeatVolumeState(v); send('setVolume', [v]) }, [send])
  const setScene = useCallback((s: SceneId | null) => setSceneState(s), [])
  const stop = useCallback(() => {
    send('stopVideo')
    stopScene()
    ready.current = false
    embedded.current = null
    setQueue([]); setPlaying(false); setExpanded(false); setFirstId(null); setSceneState(null)
  }, [send])

  const value = useMemo<Ctx>(() => ({
    queue, index, playing, loading, title, note, beatVolume, scene, ambient, expanded, broken, active: queue.length > 0,
    start, playAt, toggle, next: () => step(1), prev: () => step(-1), setBeatVolume, setScene, setAmbient: setAmbientState, setExpanded, stop,
  }), [queue, index, playing, loading, title, note, beatVolume, scene, ambient, expanded, broken, start, playAt, toggle, step, setBeatVolume, setScene, stop])

  const cur = queue[index]
  return (
    <BeatsCtx.Provider value={value}>
      {children}
      {queue.length > 0 && firstId !== null && (
        <BeatsWidget frame={frame} firstId={firstId} cur={cur} />
      )}
    </BeatsCtx.Provider>
  )
}

function BeatsWidget({ frame, firstId, cur }: { frame: React.RefObject<HTMLIFrameElement>; firstId: string; cur: AudioAsset | undefined }) {
  const b = useBeats()
  const [initial] = useState(firstId) // the iframe's src never changes; tracks switch through the player API
  useEffect(() => {
    if (!b.expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') b.setExpanded(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [b.expanded, b])
  const big = b.expanded
  return (
    <>
      {big && <button aria-label="Close beats panel" onClick={() => b.setExpanded(false)} className="fixed inset-0 z-[44] cursor-default bg-black/40 md:bg-transparent" />}
      <section
        aria-label={`Beats player: ${b.title}`}
        className={`dock fixed z-[45] overflow-hidden text-white transition-[width,border-radius] duration-300 ${big
          ? 'inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[2rem] pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-[430px] md:rounded-[2rem]'
          : 'bottom-[calc(80px+env(safe-area-inset-bottom))] left-3 w-[200px] rounded-[1.4rem] md:bottom-5 md:left-auto md:right-6 md:w-[230px]'}`}
      >
        {big && (
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
            <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Beats</p><p className="truncate text-[16px] font-semibold">{b.title}</p></div>
            <div className="flex gap-1.5">
              <button onClick={() => b.setExpanded(false)} aria-label="Minimise" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronDown size={19} /></button>
              <button onClick={b.stop} aria-label="Stop and close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={18} /></button>
            </div>
          </div>
        )}

        {/* The one and only player. It stays in the same place in the tree, so it never restarts. */}
        <div className={big ? 'px-4 pt-2' : ''}>
          <div className={`relative aspect-video w-full overflow-hidden bg-black ${big ? 'rounded-2xl' : ''}`}>
            <iframe
              ref={frame}
              title="YouTube beats player"
              className="absolute inset-0 h-full w-full"
              src={`${YT}/embed/${initial}?autoplay=1&playsinline=1&rel=0&controls=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT)}
            />
            {!big && (
              <button onClick={() => b.setExpanded(true)} aria-label="Open beats player" className="absolute inset-0 grid place-items-end bg-gradient-to-t from-black/50 to-transparent p-2 text-left">
                <span className="w-full truncate text-[11.5px] font-medium">{cur?.title ?? b.title}</span>
              </button>
            )}
          </div>
        </div>

        {big ? (
          <div className="px-5 pt-4">
            <p className="text-[15px] font-semibold leading-snug">{cur?.title}</p>
            <p className="mt-0.5 text-[12.5px] text-white/60">{[cur?.author, b.queue.length > 1 ? `Track ${b.index + 1} of ${b.queue.length}` : null].filter(Boolean).join(' · ')}</p>
            {b.note && <p className="mt-2 rounded-xl bg-white/10 p-3 text-[12.5px] leading-snug text-white/80">{b.note}</p>}
            {[...b.broken].length > 0 && <p className="mt-2 text-[12px] text-amber-200">{b.broken.size} track{b.broken.size > 1 ? 's' : ''} couldn’t play and {b.broken.size > 1 ? 'were' : 'was'} skipped.</p>}

            <div className="mt-4 flex items-center justify-center gap-5">
              <button onClick={b.prev} aria-label="Previous track" className="grid h-12 w-12 place-items-center rounded-full text-white/85 hover:bg-white/10"><SkipBack size={22} /></button>
              <button onClick={b.toggle} aria-label={b.playing ? 'Pause' : 'Play'} className="grid h-[64px] w-[64px] place-items-center rounded-full bg-white text-[#0B1020] shadow-[0_14px_36px_-10px_rgba(255,255,255,0.5)] active:scale-95">
                {b.loading && !b.playing ? <Spinner size={24} /> : b.playing ? <Pause size={27} /> : <Play size={27} className="translate-x-0.5" />}
              </button>
              <button onClick={b.next} aria-label="Next track" className="grid h-12 w-12 place-items-center rounded-full text-white/85 hover:bg-white/10"><SkipForward size={22} /></button>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl bg-white/[0.06] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Balance</p>
              <label className="block text-[13px]"><span className="mb-1 flex justify-between text-white/80"><span className="inline-flex items-center gap-1.5"><Volume2 size={14} /> Beat</span><span className="tabular-nums text-white/55">{b.beatVolume}%</span></span>
                <input type="range" className="seek" min={0} max={100} value={b.beatVolume} onChange={(e) => b.setBeatVolume(Number(e.target.value))} style={{ ['--p' as string]: `${b.beatVolume}%` }} /></label>
              <div>
                <p className="mb-1.5 text-[13px] text-white/80">Ambient layer</p>
                <div role="radiogroup" aria-label="Ambient sound" className="flex gap-1.5">
                  {[{ id: null, name: 'Off' }, ...SCENES].map((s) => (
                    <button key={s.id ?? 'off'} role="radio" aria-checked={b.scene === s.id} onClick={() => b.setScene(s.id as SceneId | null)} className={`min-h-[34px] flex-1 rounded-full px-2 text-[12px] font-medium ${b.scene === s.id ? 'bg-white text-[#0B1020]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>{s.name.replace('Deep hush', 'Hush').replace('Light rain', 'Rain').replace('Soft air', 'Air')}</button>
                  ))}
                </div>
                {b.scene && <label className="mt-2 block"><span className="sr-only">Ambient volume</span><input type="range" className="seek" min={0.05} max={0.6} step={0.01} value={b.ambient} onChange={(e) => b.setAmbient(Number(e.target.value))} style={{ ['--p' as string]: `${(b.ambient / 0.6) * 100}%` }} /></label>}
              </div>
            </div>

            {b.queue.length > 1 && (
              <ul className="mt-4 divide-y divide-white/10" aria-label="Up next">
                {b.queue.map((t, i) => (
                  <li key={t.id}>
                    <button onClick={() => b.playAt(t.id)} aria-current={i === b.index} disabled={b.broken.has(t.id)} className={`flex min-h-[46px] w-full items-center gap-3 py-2 text-left text-[13.5px] ${i === b.index ? 'text-white' : 'text-white/65 hover:text-white'} disabled:opacity-40`}>
                      <span className="w-5 text-center text-[12px] tabular-nums text-white/45">{i === b.index && b.playing ? '▶' : i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {b.broken.has(t.id) && <span className="text-[11px] text-amber-200">unavailable</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] leading-snug text-white/40">Streamed from YouTube in its own player — Bermi doesn’t host or copy these tracks. Keeps playing as you move around Bermi; a locked phone screen may pause it.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1.5">
            <button onClick={b.prev} aria-label="Previous track" className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"><SkipBack size={16} /></button>
            <button onClick={b.toggle} aria-label={b.playing ? 'Pause' : 'Play'} className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#0B1020]">{b.loading && !b.playing ? <Spinner size={15} /> : b.playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}</button>
            <button onClick={b.next} aria-label="Next track" className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"><SkipForward size={16} /></button>
            <button onClick={b.stop} aria-label="Stop and close" className="grid h-8 w-8 place-items-center rounded-full text-white/55 hover:bg-white/10"><X size={14} /></button>
          </div>
        )}
      </section>
    </>
  )
}
