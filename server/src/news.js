import Parser from 'rss-parser'
import { storage } from './storage/index.js'
import { NEWS_SOURCES } from '../config/news-sources.js'

// Vercel's function timeout for this endpoint is 60s (see vercel.json) —
// keep individual feed timeouts well under that so one slow site can't eat
// the whole budget on its own.
const parser = new Parser({ timeout: 8_000 })

const ITEMS_KEY = (sourceId) => `news:items:${sourceId}`
const STATUS_KEY = (sourceId) => `news:status:${sourceId}`
const MAX_ITEMS_PER_SOURCE = 15

// One dead feed must never take the others down with it — each source is
// fetched and stored completely independently, exactly like the AI provider
// fallback chain treats each provider/model as its own isolated attempt.
async function refreshSource(source) {
  if (!source.feedUrl) {
    // Link-only source (no discoverable RSS feed) — nothing to fetch, but
    // still recorded as "ok" so /api/news/status doesn't flag it as broken.
    await storage.setSetting(STATUS_KEY(source.id), JSON.stringify({ ok: true, linkOnly: true, checkedAt: new Date().toISOString() }))
    return { id: source.id, ok: true, linkOnly: true }
  }
  try {
    const feed = await parser.parseURL(source.feedUrl)
    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE).map((item) => ({
      title: (item.title || '').trim(),
      link: item.link || item.guid || '',
      publishedAt: item.isoDate || item.pubDate || null,
      summary: (item.contentSnippet || item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    })).filter((i) => i.title && i.link)
    await storage.setSetting(ITEMS_KEY(source.id), JSON.stringify(items))
    await storage.setSetting(STATUS_KEY(source.id), JSON.stringify({ ok: true, itemCount: items.length, checkedAt: new Date().toISOString() }))
    return { id: source.id, ok: true, itemCount: items.length }
  } catch (err) {
    await storage.setSetting(STATUS_KEY(source.id), JSON.stringify({ ok: false, error: err.message, checkedAt: new Date().toISOString() }))
    return { id: source.id, ok: false, error: err.message }
  }
}

/**
 * Refreshes every source. Called by the scheduled cron endpoint, which has a
 * hard 60s ceiling (see vercel.json) — 30 sources fully sequential at up to
 * 8s each could exceed that on a bad day, so this runs a small number in
 * parallel at a time: fast enough to finish comfortably within budget,
 * gentle enough not to open 30 outbound connections from one function at
 * once.
 */
export async function refreshAllSources() {
  const CONCURRENCY = 6
  const results = []
  for (let i = 0; i < NEWS_SOURCES.length; i += CONCURRENCY) {
    const batch = NEWS_SOURCES.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(refreshSource))
    results.push(...batchResults)
  }
  return results
}

/** Cached feed for the client — never fetches live, always reads the cache. */
export async function getNewsFeed({ region, focus, limit = 60 } = {}) {
  const sources = NEWS_SOURCES.filter(
    (s) => (!region || s.region === region) && (!focus || s.focus === focus),
  )
  const all = []
  for (const source of sources) {
    if (!source.feedUrl) continue
    const raw = await storage.getSetting(ITEMS_KEY(source.id))
    if (!raw) continue
    let items
    try {
      items = JSON.parse(raw)
    } catch {
      continue
    }
    for (const item of items) {
      all.push({ ...item, source: source.name, sourceId: source.id, region: source.region, focus: source.focus })
    }
  }
  all.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
  return all.slice(0, limit)
}

/** Per-source health, so a source that never returns anything is visible and fixable. */
export async function getSourceStatus() {
  const out = []
  for (const source of NEWS_SOURCES) {
    const raw = await storage.getSetting(STATUS_KEY(source.id))
    const status = raw ? JSON.parse(raw) : { ok: null, checkedAt: null }
    out.push({ id: source.id, name: source.name, region: source.region, focus: source.focus, homepage: source.homepage, hasFeed: Boolean(source.feedUrl), ...status })
  }
  return out
}

export { NEWS_SOURCES }
