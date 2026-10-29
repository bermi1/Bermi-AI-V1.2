import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Headphones, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import type { AudioAsset } from './api'
import { EmptyState } from './ui'

// Plays the focus & mood library. Hosted audio uses a plain <audio> element;
// YouTube links play in YouTube's own embedded player (nothing is copied), and
// the next track starts when one ends. An unplayable video is reported honestly
// with a link to open it on YouTube.

export const CATEGORIES = [
  { id: 'all', label: 'All', full: 'All moods' },
  { id: 'emotional', label: 'Love', full: 'Emotional & love' },
  { id: 'motivation', label: 'Drive', full: 'Motivation' },
  { id: 'never-give-up', label: 'Grit', full: 'Never give up' },
  { id: 'study', label: 'Study', full: 'Study beats' },
  { id: 'deep-focus', label: 'Focus', full: 'Deep focus' },
]

export const youtubeId = (url: string): string | null => {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null)
  } catch {
    /* not a URL */
  }
  return null
}

export function AudioLibrary({ audio }: { audio: AudioAsset[] }) {
  const [cat, setCat] = useState('all')
  const [nowId, setNowId] = useState<string | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const [loop, setLoop] = useState(true)
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const frame = useRef<HTMLIFrameElement>(null)
  const [paused, setPaused] = useState(false)

  const list = useMemo(() => audio.filter((a) => cat === 'all' || a.category === cat), [audio, cat])
  const now = audio.find((a) => a.id === nowId) ?? null
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of audio) m.set(a.category ?? '', (m.get(a.category ?? '') ?? 0) + 1)
    return m
  }, [audio])

  const step = (dir: 1 | -1) => {
    const playable = list.filter((a) => !broken.has(a.id))
    if (!playable.length) return
    if (shuffle && dir === 1) {
      const pool = playable.filter((a) => a.id !== nowId)
      setNowId((pool.length ? pool : playable)[Math.floor(Math.random() * (pool.length || playable.length))].id)
      return
    }
    const i = playable.findIndex((a) => a.id === nowId)
    const next = i === -1 ? 0 : i + dir
    if (next >= playable.length || next < 0) {
      if (loop || dir === -1) setNowId(playable[(next + playable.length) % playable.length].id)
      return
    }
    setNowId(playable[next].id)
  }
  const stepRef = useRef(step)
  stepRef.current = step

  // YouTube posts player events to the page once we say we're listening.
  const yt = now ? youtubeId(now.url) : null
  useEffect(() => {
    setPaused(false)
    if (!yt) return
    const onMsg = (e: MessageEvent) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname) || typeof e.data !== 'string') return
      let d: { event?: string; info?: unknown }
      try { d = JSON.parse(e.data) } catch { return }
      if (d.event === 'onStateChange' && d.info === 0) stepRef.current(1)
      if (d.event === 'onStateChange' && typeof d.info === 'number') setPaused(d.info === 2)
      if (d.event === 'onError') setBroken((b) => new Set(b).add(now!.id))
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt, now?.id])

  const command = (fn: 'playVideo' | 'pauseVideo') => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: fn, args: [] }), '*')
  const isBroken = now ? broken.has(now.id) : false

  if (!audio.length)
    return <EmptyState icon={<Headphones size={26} />} title="No audio yet" body="Audio appears here once the Bermi team publishes tracks with a licence we can show." />

  return (
    <div>
      <div role="radiogroup" aria-label="Mood" className="mb-3 flex justify-between gap-1">
        {CATEGORIES.filter((c) => c.id === 'all' || counts.get(c.id)).map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={cat === c.id}
            aria-label={`${c.full}${c.id !== 'all' ? `, ${counts.get(c.id)} tracks` : ''}`}
            title={c.full}
            onClick={() => setCat(c.id)}
            className={`min-h-[34px] flex-1 whitespace-nowrap rounded-full px-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 sm:text-[12.5px] ${cat === c.id ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'bg-surface-sunken text-ink-muted hover:text-ink'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {now && (
        <div className="tile-accent mb-3 p-4">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-white/65">Now playing</p>
          <p className="mt-1 text-[16px] font-semibold leading-snug">{now.title}</p>
          <p className="text-[12.5px] text-white/70">{[now.author, now.minutes ? `${now.minutes} min` : null].filter(Boolean).join(' · ') || ' '}</p>
          {yt && !isBroken && (
            <div className="mt-3 overflow-hidden rounded-2xl bg-black">
              <iframe
                ref={frame}
                key={now.id}
                title={`Player: ${now.title}`}
                className="aspect-video w-full"
                src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')}
              />
            </div>
          )}
          {!yt && <audio key={now.id} controls autoPlay src={now.url} preload="none" className="mt-3 w-full" onEnded={() => step(1)} />}
          {isBroken && (
            <p role="alert" className="mt-3 rounded-xl bg-black/25 p-3 text-[13px]">
              This one can’t play inside Bermi (the uploader may have removed it or turned off embedding).{' '}
              <a href={now.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold underline">Open on YouTube <ExternalLink size={12} /></a>
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button onClick={() => step(-1)} aria-label="Previous track" className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25"><SkipBack size={18} /></button>
              {yt && !isBroken && (
                <button onClick={() => { command(paused ? 'playVideo' : 'pauseVideo'); setPaused(!paused) }} aria-label={paused ? 'Play' : 'Pause'} className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#0B1020]">{paused ? <Play size={18} /> : <Pause size={18} />}</button>
              )}
              <button onClick={() => step(1)} aria-label="Next track" className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25"><SkipForward size={18} /></button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShuffle((v) => !v)} aria-pressed={shuffle} aria-label="Shuffle" className={`grid h-10 w-10 place-items-center rounded-full ${shuffle ? 'bg-white text-[#0B1020]' : 'bg-white/15 hover:bg-white/25'}`}><Shuffle size={16} /></button>
              <button onClick={() => setLoop((v) => !v)} aria-pressed={loop} aria-label="Repeat the list" className={`grid h-10 w-10 place-items-center rounded-full ${loop ? 'bg-white text-[#0B1020]' : 'bg-white/15 hover:bg-white/25'}`}><Repeat size={16} /></button>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-white/60">{now.attribution || now.license}</p>
        </div>
      )}

      <ul className="divide-y divide-edge">
        {list.map((a) => (
          <li key={a.id}>
            <button onClick={() => setNowId(a.id)} aria-pressed={nowId === a.id} className="flex min-h-[54px] w-full items-center gap-3 py-2 text-left">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${nowId === a.id ? 'bg-primary text-on-primary' : 'bg-primary-soft text-primary'}`}>{nowId === a.id ? <Play size={16} /> : <Headphones size={17} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{a.title}</span><span className="block truncate text-[12px] text-ink-muted">{[a.author, a.minutes ? `${a.minutes >= 60 ? `${Math.floor(a.minutes / 60)}h${a.minutes % 60 ? ` ${a.minutes % 60}m` : ''}` : `${a.minutes}m`}` : null, broken.has(a.id) ? 'unavailable' : null].filter(Boolean).join(' · ') || 'YouTube'}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">Streamed from YouTube in its own player — Bermi doesn’t host or copy these tracks. Whether music helps you concentrate is personal; use what works for you and keep the volume comfortable.</p>
    </div>
  )
}
