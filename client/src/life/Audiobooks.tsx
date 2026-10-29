import { useMemo, useState } from 'react'
import { BookOpenCheck, Check, Clock, ExternalLink, Headphones, Play, Sparkles } from 'lucide-react'
import { lifeApi, type Audiobook, type SavedData } from './api'
import { useAct, useItems } from './hooks'
import { EmptyState } from './ui'

// A shelf of public-domain audiobooks (human-read LibriVox recordings played
// in the Internet Archive's own player). Covers are the images the Internet
// Archive item carries for each recording; a generated cover is the fallback.

const THEMES: Record<string, { label: string; short: string; a: string; b: string; ink: string; motif: 'rings' | 'rays' | 'waves' | 'dots' }> = {
  wealth: { label: 'Building wealth', short: 'Wealth', a: '#0E8F6B', b: '#0A3D3A', ink: '#FFE9A6', motif: 'rings' },
  motivation: { label: 'Motivation', short: 'Drive', a: '#F2682A', b: '#7A1D5C', ink: '#FFF1E6', motif: 'rays' },
  emotion: { label: 'Emotion control', short: 'Calm', a: '#3D6BFF', b: '#16206B', ink: '#E6EEFF', motif: 'waves' },
  laziness: { label: 'Art of laziness', short: 'Slow', a: '#12B5A6', b: '#5B3FA8', ink: '#F4F0FF', motif: 'dots' },
}
const theme = (c: string) => THEMES[c] ?? THEMES.motivation
const fmtLen = (m?: number) => (!m ? '' : m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`)

function Motif({ kind, ink }: { kind: 'rings' | 'rays' | 'waves' | 'dots'; ink: string }) {
  const common = { fill: 'none', stroke: ink, strokeOpacity: 0.22, strokeWidth: 2 } as const
  return (
    <svg viewBox="0 0 200 280" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      {kind === 'rings' && [30, 58, 86, 114].map((r) => <circle key={r} cx="150" cy="70" r={r} {...common} />)}
      {kind === 'rays' && Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI; return <line key={i} x1={150 + 20 * Math.cos(a)} y1={64 - 20 * Math.sin(a)} x2={150 + 150 * Math.cos(a)} y2={64 - 150 * Math.sin(a)} {...common} /> })}
      {kind === 'waves' && [40, 70, 100, 130].map((y) => <path key={y} d={`M-10 ${y} C 40 ${y - 30}, 90 ${y + 30}, 140 ${y} S 210 ${y - 20}, 230 ${y}`} {...common} />)}
      {kind === 'dots' && Array.from({ length: 30 }, (_, i) => <circle key={i} cx={20 + (i % 6) * 32} cy={24 + Math.floor(i / 6) * 28} r={i % 7 === 0 ? 5 : 2.5} fill={ink} fillOpacity={i % 7 === 0 ? 0.35 : 0.2} />)}
    </svg>
  )
}

/** The book's real cover: the cover image the Internet Archive item carries for
 * that recording. If it can't load, a generated cover stands in. */
function Cover({ book, size = 'md', done, active }: { book: Audiobook; size?: 'md' | 'lg'; done?: boolean; active?: boolean }) {
  const t = theme(book.category)
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading')
  const src = `https://archive.org/services/img/${encodeURIComponent(book.archiveId)}`
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[10px] shadow-[0_14px_28px_-12px_rgb(0_0_0/0.55)] transition-transform ${size === 'lg' ? 'h-[190px] w-[136px]' : 'h-[198px] w-[140px]'} ${active ? '-translate-y-1.5 ring-2 ring-white/80' : ''}`}
      style={{ background: `linear-gradient(155deg, ${t.a}, ${t.b})`, color: t.ink }}
    >
      {state !== 'ok' && <Motif kind={t.motif} ink={t.ink} />}
      {state === 'failed' && (
        <div className="relative flex h-full flex-col justify-between p-3.5 pl-5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">{t.short}</p>
          <p className="font-serif text-[17px] font-semibold leading-[1.12] tracking-tight [text-wrap:balance]">{book.title}</p>
        </div>
      )}
      {state !== 'failed' && (
        <>
          {/* Blurred copy fills the frame; the real cover sits on top, uncropped. */}
          <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl" />
          <img
            src={src}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setState('ok')}
            onError={() => setState('failed')}
            className="relative h-full w-full object-contain"
          />
        </>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(120deg, rgb(255 255 255 / .16), transparent 34%)' }} />
      {done && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-[#0B1020]" title="Finished"><Check size={14} aria-label="Finished" /></span>}
    </div>
  )
}

export function Audiobooks({ books }: { books: Audiobook[] }) {
  const [cat, setCat] = useState('all')
  const [nowId, setNowId] = useState<string | null>(null)
  const saved = useItems<SavedData>('saved')
  const act = useAct()
  const finished = useMemo(() => new Map(saved.items.filter((s) => s.data.type === 'audio').map((s) => [s.data.ref, s.id])), [saved.items])
  const list = books.filter((b) => cat === 'all' || b.category === cat)
  const now = books.find((b) => b.id === nowId) ?? null
  const cats = Object.keys(THEMES).filter((c) => books.some((b) => b.category === c))

  if (!books.length) return <EmptyState icon={<Headphones size={26} />} title="No audiobooks yet" body="Audiobooks appear here once the Bermi team publishes them with a licence we can show." />

  return (
    <div>
      <div role="radiogroup" aria-label="Topic" className="mb-4 flex justify-between gap-1">
        {[{ id: 'all', short: 'All', label: 'All topics' }, ...cats.map((c) => ({ id: c, short: THEMES[c].short, label: THEMES[c].label }))].map((c) => (
          <button key={c.id} role="radio" aria-checked={cat === c.id} aria-label={c.label} title={c.label} onClick={() => setCat(c.id)} className={`min-h-[34px] flex-1 rounded-full px-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 sm:text-[12.5px] ${cat === c.id ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'bg-surface-sunken text-ink-muted hover:text-ink'}`}>{c.short}</button>
        ))}
      </div>

      {/* The shelf */}
      <div className="scroll-x -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-5 pt-2 sm:-mx-5 sm:px-5" role="list" aria-label="Audiobooks">
        {list.map((b) => (
          <button key={b.id} role="listitem" onClick={() => setNowId(b.id)} aria-label={`${b.title} by ${b.author}${b.minutes ? `, ${fmtLen(b.minutes)}` : ''}${finished.has(b.id) ? ', finished' : ''}`} aria-pressed={nowId === b.id} className="snap-start rounded-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <Cover book={b} done={finished.has(b.id)} active={nowId === b.id} />
            <span className="mt-2 block w-[140px] text-left">
              <span className="line-clamp-2 text-[12.5px] font-medium leading-snug">{b.title}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-muted"><Clock size={11} aria-hidden />{fmtLen(b.minutes) || 'Audiobook'} · {b.author.split(' ').slice(-1)[0]}</span>
            </span>
          </button>
        ))}
      </div>

      {now ? (
        <div className="tile-accent p-4 sm:p-5">
          <div className="flex gap-4">
            <div className="hidden sm:block"><Cover book={now} size="lg" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-white/65">{theme(now.category).label}</p>
              <h3 className="mt-1 font-serif text-[22px] font-semibold leading-tight">{now.title}</h3>
              <p className="mt-0.5 text-[13px] text-white/75">{[now.author, now.year ? (now.year < 200 ? `c. ${now.year} CE` : now.year) : null, now.narrator ? `read by ${now.narrator}` : null, fmtLen(now.minutes)].filter(Boolean).join(' · ')}</p>
              {now.blurb && <p className="mt-2.5 text-[14px] leading-relaxed text-white/90">{now.blurb}</p>}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl bg-black/30">
            <iframe
              key={now.archiveId}
              title={`Audiobook player: ${now.title}`}
              src={`https://archive.org/embed/${encodeURIComponent(now.archiveId)}?playlist=1&list_height=150`}
              className="h-[270px] w-full"
              allow="autoplay; fullscreen"
              loading="lazy"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-semibold text-[#0B1020]"
              onClick={() => act(async () => {
                const id = finished.get(now.id)
                if (id) await lifeApi.remove(id)
                else await lifeApi.create<SavedData>('saved', { ref: now.id, label: now.title, type: 'audio' })
                saved.reload(true)
              }, finished.has(now.id) ? 'Moved back to your shelf' : 'Marked as finished')}
            >
              {finished.has(now.id) ? <BookOpenCheck size={15} /> : <Check size={15} />} {finished.has(now.id) ? 'Finished' : 'Mark as finished'}
            </button>
            {now.sourceUrl && <a href={now.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/15 px-4 text-[13px] font-medium text-white hover:bg-white/25">Open on the Internet Archive <ExternalLink size={12} /></a>}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-white/60">{now.license} Audio plays from archive.org’s player. Older books reflect the views and language of their time.</p>
        </div>
      ) : (
        <div className="tile flex items-center gap-3 p-4 text-[13.5px] text-ink-muted">
          <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
          <p>Pick a book from the shelf to start listening. Free, human-read, public-domain recordings — <Play size={11} className="inline" aria-hidden /> play, pause and skip chapters in the player.</p>
        </div>
      )}
      <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">Recorded by LibriVox volunteers and released into the public domain in the USA; copyright may differ in your country. Summaries above are Bermi’s own words.</p>
    </div>
  )
}
