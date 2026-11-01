import { useMemo, useRef, useState } from 'react'
import { Headphones, Pause, Play, Sparkles } from 'lucide-react'
import { lifeApi, type AudioAsset } from './api'
import { newIdemKey } from './hooks'
import { useBeats } from './beatsPlayer'
import { EmptyState, Spinner } from './ui'

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
  const beats = useBeats()
  const list = useMemo(() => audio.filter((a) => cat === 'all' || a.category === cat), [audio, cat])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of audio) m.set(a.category ?? '', (m.get(a.category ?? '') ?? 0) + 1)
    return m
  }, [audio])
  const nowId = beats.active ? beats.queue[beats.index]?.id : null

  const playFrom = (id: string) => {
    const i = list.findIndex((a) => a.id === id)
    const rotated = [...list.slice(i), ...list.slice(0, i)]
    beats.start(rotated, { title: CATEGORIES.find((c) => c.id === cat)?.full ?? 'Beats', note: null, scene: beats.scene, ambient: beats.ambient })
  }

  if (!audio.length)
    return <EmptyState icon={<Headphones size={26} />} title="No audio yet" body="Audio appears here once the Bermi team publishes tracks with a licence we can show." />

  return (
    <div>
      <BeatDJ audio={audio} />
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

      <ul className="divide-y divide-edge">
        {list.map((a) => (
          <li key={a.id}>
            <button onClick={() => playFrom(a.id)} aria-pressed={nowId === a.id} className="flex min-h-[54px] w-full items-center gap-3 py-2 text-left">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${nowId === a.id ? 'bg-primary text-on-primary' : 'bg-primary-soft text-primary'}`}>{nowId === a.id && beats.playing ? <Pause size={16} /> : nowId === a.id ? <Play size={16} /> : <Headphones size={17} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{a.title}</span><span className="block truncate text-[12px] text-ink-muted">{[a.author, a.minutes ? `${a.minutes >= 60 ? `${Math.floor(a.minutes / 60)}h${a.minutes % 60 ? ` ${a.minutes % 60}m` : ''}` : `${a.minutes}m`}` : null, beats.broken.has(a.id) ? 'unavailable' : null].filter(Boolean).join(' · ') || 'YouTube'}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">Streamed from YouTube in its own player — Bermi doesn’t host or copy these tracks. It keeps playing while you move around Bermi (a locked phone screen may pause it). Whether music helps you concentrate is personal; keep the volume comfortable.</p>
    </div>
  )
}

const EXAMPLES = ['I need to study hard — play the best beat and balance the sound', 'Gym time, get me pumped', 'I feel like giving up. Keep me going', 'Something warm and emotional, quiet']

/** Type what you need; Bermi picks the beats and balances the sound. */
function BeatDJ({ audio }: { audio: AudioAsset[] }) {
  const beats = useBeats()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const idem = useRef(newIdemKey())
  const go = async (t = text) => {
    const q = t.trim()
    if (q.length < 2 || busy) return
    setBusy(true); setMsg(null)
    try {
      const pick = await lifeApi.pickAudio(q, idem.current)
      idem.current = newIdemKey()
      const tracks = pick.trackIds.map((id) => audio.find((a) => a.id === id)).filter((x): x is AudioAsset => !!x)
      if (!tracks.length) { setMsg({ ok: false, text: 'I couldn’t find tracks for that. Try “study”, “gym”, “focus” or “emotional”.' }); return }
      beats.start(tracks, { title: pick.title, note: pick.reason, beatVolume: pick.beatVolume, scene: pick.scene, ambient: pick.ambient || 0.2 })
      setMsg({ ok: true, text: pick.reason })
      setText('')
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally { setBusy(false) }
  }
  return (
    <div className="mb-4 rounded-2xl bg-primary-soft p-3.5">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void go() }}>
        <label htmlFor="dj" className="sr-only">Tell Bermi what you need</label>
        <input id="dj" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="What do you need? e.g. study hard, gym, calm…" className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-primary" />
        <button disabled={busy || text.trim().length < 2} className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-primary px-4 text-[13.5px] font-semibold text-on-primary disabled:opacity-40">{busy ? <Spinner size={15} /> : <Sparkles size={15} />} Play</button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => void go(x)} className="rounded-full bg-surface-raised px-3 py-1.5 text-left text-[12px] text-ink-muted hover:text-ink">{x}</button>)}
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2.5 text-[12.5px] leading-snug ${msg.ok ? 'text-ink-muted' : 'text-ink'}`}>{msg.ok ? '▶ ' : ''}{msg.text}</p>}
    </div>
  )
}
