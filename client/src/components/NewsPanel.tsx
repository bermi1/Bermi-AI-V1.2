import { useEffect, useState } from 'react'
import { ExternalLink, Globe2, Newspaper, RefreshCw } from 'lucide-react'
import * as api from '../lib/api'
import type { NewsFocus, NewsItem, NewsRegion } from '../lib/types'

const REGIONS: { id: NewsRegion | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tanzania', label: 'Tanzania' },
  { id: 'africa', label: 'Africa' },
  { id: 'global', label: 'Global' },
]

const FOCUSES: { id: NewsFocus | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'youth_opportunities', label: 'Youth opportunities & scholarships' },
  { id: 'national_news', label: 'National news' },
  { id: 'opportunities_events', label: 'Opportunities & events' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// Youth opportunities, scholarships, and news curated from 30 sources across
// Tanzania, Africa, and globally — refreshed on a schedule server-side (see
// server/src/news.js); this panel only ever reads the cache, never fetches
// the sites live itself.
export function NewsPanel() {
  const [region, setRegion] = useState<NewsRegion | 'all'>('all')
  const [focus, setFocus] = useState<NewsFocus | 'all'>('all')
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(null)
    setError(null)
    api
      .newsFeed({
        region: region === 'all' ? undefined : region,
        focus: focus === 'all' ? undefined : focus,
      })
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message))
  }, [region, focus])

  const empty = items != null && items.length === 0

  return (
    <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Newspaper size={17} className="text-primary" />
          <h2 className="text-[16px] font-semibold tracking-tight">News & opportunities</h2>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRegion(r.id)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
              region === r.id ? 'bg-primary text-white' : 'bg-surface-sunken text-ink-muted hover:bg-surface'
            }`}
          >
            {r.id === 'all' && <Globe2 size={11} />}
            {r.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <select
          value={focus}
          onChange={(e) => setFocus(e.target.value as NewsFocus | 'all')}
          className="w-full max-w-xs rounded-lg border border-edge bg-surface px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-primary sm:w-auto"
        >
          {FOCUSES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-[13px] text-rose-500">{error}</p>}

      {!error && items == null && (
        <div className="flex items-center gap-2 py-8 text-[13px] text-ink-faint">
          <RefreshCw size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {empty && (
        <p className="rounded-2xl border border-dashed border-edge px-4 py-8 text-center text-[13px] text-ink-faint">
          Nothing cached for this filter yet — the feed refreshes on a schedule, check back soon.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <a
              key={`${item.link}-${i}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-edge bg-surface px-3.5 py-3 transition-colors hover:border-primary hover:bg-primary-soft/30"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-ink-faint">
                <span className="truncate">{item.source}</span>
                {item.publishedAt && <span className="shrink-0">· {timeAgo(item.publishedAt)}</span>}
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold leading-snug text-ink group-hover:text-primary">{item.title}</h3>
                <ExternalLink size={13} className="mt-0.5 shrink-0 text-ink-faint group-hover:text-primary" />
              </div>
              {item.summary && <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-muted">{item.summary}</p>}
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
