import { Router } from 'express'
import { getNewsFeed, getSourceStatus, NEWS_SOURCES } from '../news.js'

export const newsRouter = Router()

newsRouter.get('/news', async (req, res, next) => {
  try {
    const { region, focus, limit } = req.query
    const items = await getNewsFeed({
      region: typeof region === 'string' ? region : undefined,
      focus: typeof focus === 'string' ? focus : undefined,
      limit: limit ? Math.min(Number(limit) || 60, 200) : undefined,
    })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// The static source list (incl. link-only sources with no live feed) — the
// client uses this to build region/focus filters and to show a "visit site"
// link for sources that don't have a fetchable feed.
newsRouter.get('/news/sources', (_req, res) => {
  res.json({
    sources: NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name, region: s.region, focus: s.focus, homepage: s.homepage, hasFeed: Boolean(s.feedUrl) })),
  })
})

// Per-source fetch health — surfaces which of the 30 sources are actually
// working so a dead feed URL is visible and fixable, not a silent gap.
newsRouter.get('/news/status', async (_req, res, next) => {
  try {
    res.json({ sources: await getSourceStatus() })
  } catch (err) {
    next(err)
  }
})
