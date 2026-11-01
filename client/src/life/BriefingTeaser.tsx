import { useEffect, useState } from 'react'
import { ChevronRight, Newspaper } from 'lucide-react'
import { lifeApi, type BriefingPrefsData, type FeedItem } from './api'
import { ageLabel } from './Discover'
import { Section } from './ui'

/**
 * Home teaser: the top few stories from the person's own briefing. It only
 * appears once they have set one up, and stays quiet if nothing loads —
 * the Home screen never waits on, or breaks because of, the news.
 */
export function BriefingTeaser({ go }: { go: (to: string) => void }) {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const prefs = (await lifeApi.items<BriefingPrefsData>('briefing_prefs'))[0]
        if (!prefs?.data.onboarded) return
        const b = await lifeApi.briefing()
        if (!live || !b.sections) return
        const hidden = new Set(prefs.data.hidden)
        const lead = [...b.sections.breaking, ...b.sections.forYou].filter((v, i, a) => !hidden.has(v.id) && a.findIndex((x) => x.id === v.id) === i).slice(0, 3)
        setItems(lead)
      } catch {
        /* the teaser is optional */
      }
    })()
    return () => {
      live = false
    }
  }, [])
  if (!items?.length) return null
  return (
    <Section
      title="In your briefing"
      action={
        <button className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-primary hover:bg-primary-soft" onClick={() => go('/my/discover')}>
          Open <ChevronRight size={15} aria-hidden />
        </button>
      }
    >
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="flex gap-3">
            <Newspaper size={16} className="mt-1 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium leading-snug hover:underline">{it.title}</a>
              <p className="mt-0.5 truncate text-[12px] text-ink-muted">{it.source}{ageLabel(it.ageH, it.publishedAt) ? ` · ${ageLabel(it.ageH, it.publishedAt)}` : ''}{it.why[0] ? ` · ${it.why[0]}` : ''}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
