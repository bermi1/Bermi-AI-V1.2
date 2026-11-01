import { SOURCES, SOURCE_BY_ID } from './sources.js'
import { TOPIC_BY_ID } from './topics.js'
import { nearbyRegions } from './countries.js'
import { rankCandidates, diversify, pickBreaking } from './rank.js'
import { runUnit, keyFor, pool, cacheRead, fetchSourceFeed, laneGoogleNews, laneBooks, lanePubmed, laneArxiv, laneJobs } from './fetch.js'
import { webSearch } from '../websearch.js'
import { storage } from '../storage/index.js'

const HOUR = 3_600_000
const TTL = { source: 5 * HOUR, news: 3 * HOUR, top: 1 * HOUR, books: 24 * HOUR, research: 12 * HOUR, jobs: 6 * HOUR }
const REQUEST_BUDGET_MS = 9_000 // how long one request may spend refreshing stale data
const MAX_SOURCES = 40

// ------------------------------------------------------- choosing sources

/** Which registry feeds are worth reading for THIS person. */
export function chooseSources(plan, { limit = MAX_SOURCES } = {}) {
  const near = nearbyRegions(plan.countryRaw)
  const weight = Object.fromEntries(plan.topics.map((t) => [t.id, t.weight]))
  const topicalOf = (s) => s.topics.reduce((a, t) => a + (weight[t] ?? 0), 0)
  const scored = SOURCES.filter((s) => s.feed && !plan.mutedSources.includes(s.id)).map((s) => {
    let topical = 0
    for (const t of s.topics) topical += weight[t] ?? 0
    const idx = near.indexOf(s.region)
    const loc = idx === 0 ? 1 : idx > 0 && s.region !== 'global' ? 0.6 : s.region === 'global' ? 0.2 : 0
    const lang = s.lang === 'sw' ? (plan.lang === 'en' ? -0.5 : 0.3) : 0
    return { s, score: topical + 0.35 * loc + (4 - s.tier) * 0.05 + lang }
  })
  scored.sort((a, b) => b.score - a.score)
  const chosen = new Map()
  // Guarantee depth for each followed topic, then fill by overall score.
  for (const t of plan.topics) {
    let n = 0
    for (const { s } of scored) {
      if (s.topics.includes(t.id) && !chosen.has(s.id) && !(s.lang === 'sw' && plan.lang === 'en')) {
        chosen.set(s.id, s)
        if (++n >= 4) break
      }
    }
  }
  for (const { s, score } of scored) {
    if (chosen.size >= limit) break
    if (score > 0.2 && topicalOf(s) > 0 && !chosen.has(s.id)) chosen.set(s.id, s)
  }
  return [...chosen.values()].slice(0, limit)
}

/** Official sites to point to (never scraped): link-only registry entries relevant to the person. */
export function officialShelf(plan, n = 6) {
  const near = nearbyRegions(plan.countryRaw)
  const weight = Object.fromEntries(plan.topics.map((t) => [t.id, t.weight]))
  return SOURCES.filter((s) => !s.feed && s.kind === 'official')
    .map((s) => {
      const topical = s.topics.reduce((a, t) => a + (weight[t] ?? 0), 0)
      const idx = near.indexOf(s.region)
      const loc = idx === 0 ? 1 : idx > 0 && s.region !== 'global' ? 0.6 : 0.2
      return { s, score: topical > 0 ? topical + 0.3 * loc : 0 }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ s }) => ({ id: s.id, name: s.name, url: s.home, topics: s.topics.filter((t) => weight[t]).map((t) => TOPIC_BY_ID[t]?.label).filter(Boolean).slice(0, 2) }))
}

// ------------------------------------------------------- the pipeline

/**
 * Build one person's briefing. `cacheOnly` reads what is already cached and
 * never touches the network (used for AI digests and quick reloads).
 */
const DISABLED_KEY = 'brief:v1:disabled'
export async function disabledSources() {
  try {
    const raw = await storage.getSetting(DISABLED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
export async function setSourceDisabled(id, disabled) {
  if (!SOURCE_BY_ID[id]) throw new Error('Unknown source')
  const cur = new Set(await disabledSources())
  disabled ? cur.add(id) : cur.delete(id)
  await storage.setSetting(DISABLED_KEY, JSON.stringify([...cur]))
  return [...cur]
}

export async function buildBriefing(rawPlan, { cacheOnly = false, force = false, now = Date.now() } = {}) {
  const off = await disabledSources()
  const plan = off.length ? { ...rawPlan, mutedSources: [...rawPlan.mutedSources, ...off] } : rawPlan
  const deadline = cacheOnly ? 0 : now + REQUEST_BUDGET_MS
  const stats = { sources: { chosen: 0, fresh: 0, refreshed: 0, stale: 0, failed: 0 }, lanes: { run: 0, ok: 0, failed: 0 } }
  const candidates = []
  const tasks = []

  const note = (kind, res) => {
    const bucket = stats[kind]
    bucket.fresh += res.state === 'fresh' ? 1 : 0
    if (kind === 'sources') {
      bucket.refreshed += res.state === 'refreshed' ? 1 : 0
      bucket.stale += res.state === 'stale' ? 1 : 0
      bucket.failed += res.state === 'failed' || res.state === 'backoff' ? 1 : 0
    } else {
      bucket.run += 1
      if (res.items.length) bucket.ok += 1
      else if (res.state === 'failed' || res.state === 'backoff') bucket.failed += 1
    }
  }

  const unit = (spec, onItems, kind) =>
    tasks.push(async () => {
      const res = await runUnit({ ...spec, deadline, force: force && !cacheOnly })
      note(kind, res)
      onItems(res.items)
    })

  // 1. Registry feeds
  const chosen = chooseSources(plan)
  stats.sources.chosen = chosen.length
  for (const s of chosen) {
    unit(
      { key: keyFor('src', s.id), label: s.name, ttlMs: TTL.source, producer: () => fetchSourceFeed(s) },
      (items) => items.forEach((i) => candidates.push({ ...i, src: s })),
      'sources',
    )
  }

  // 2. Live search lanes (reach beyond the registry: any interest, any place)
  for (const q of plan.queries) {
    unit(
      { key: keyFor('gn', q.q, plan.locale.gl, plan.locale.hl), label: `Search: ${q.q}`, ttlMs: TTL.news, producer: () => laneGoogleNews({ q: q.q, locale: plan.locale }) },
      (items) => items.forEach((i) => candidates.push({ ...i, lane: q.opportunity ? 'opportunity' : 'search', scope: q.scope, laneTopic: q.topic ?? null, laneCustom: q.custom ?? null })),
      'lanes',
    )
  }
  for (const s of plan.sections) {
    unit(
      { key: keyFor('gnsec', s.section ?? 'top', plan.locale.gl, plan.locale.hl), label: `Headlines ${plan.country?.name ?? 'world'} ${s.section ?? ''}`, ttlMs: TTL.top, producer: () => laneGoogleNews({ locale: plan.locale, section: s.section }) },
      (items) => items.forEach((i) => candidates.push({ ...i, lane: s.section ? 'search' : 'local', scope: 'local', laneTopic: null })),
      'lanes',
    )
  }
  for (const r of plan.research) {
    unit(
      { key: keyFor('res', r.type, r.term ?? r.cat), label: `Research: ${r.term ?? r.cat}`, ttlMs: TTL.research, producer: () => (r.type === 'pubmed' ? lanePubmed(r.term) : laneArxiv(r.cat)) },
      (items) => items.forEach((i) => candidates.push({ ...i, lane: 'research', laneTopic: r.topic ?? null, laneCustom: r.custom ?? null })),
      'lanes',
    )
  }
  for (const b of plan.books) {
    unit(
      { key: keyFor('book', b.subject), label: `Books: ${b.subject}`, ttlMs: TTL.books, producer: () => laneBooks(b.subject) },
      (items) => items.forEach((i) => candidates.push({ ...i, lane: 'books', laneTopic: b.topic })),
      'lanes',
    )
  }
  if (plan.jobs) {
    unit(
      { key: keyFor('jobs', plan.jobs.dev ? 'dev' : 'all'), label: 'Remote jobs', ttlMs: TTL.jobs, producer: () => laneJobs({ dev: plan.jobs.dev }) },
      (items) => items.forEach((i) => candidates.push({ ...i, lane: 'jobs', laneTopic: plan.topics.find((t) => t.id === 'careers' || t.id === 'software')?.id ?? null })),
      'lanes',
    )
  }

  await pool(tasks, 12)

  // 3. Optional web-search fallback for custom interests that found nothing.
  let tavilyUsed = 0
  if (!cacheOnly) {
    for (const cu of plan.customs.slice(0, 2)) {
      const has = candidates.some((c) => c.laneCustom === cu)
      if (has) continue
      const res = await runUnit({
        key: keyFor('tav', cu),
        label: `Web: ${cu}`,
        ttlMs: 6 * HOUR,
        deadline,
        producer: async () => {
          const r = await webSearch(`${cu} latest news and opportunities`, { maxResults: 5 })
          if (!r) return []
          return r.results.map((x) => ({ title: x.title, url: x.url, publishedAt: null, summary: x.content.slice(0, 220), image: null, source: safeHost(x.url) }))
        },
      })
      if (res.items.length) tavilyUsed++
      res.items.forEach((i) => candidates.push({ ...i, lane: 'search', laneCustom: cu }))
    }
  }

  // 4. Rank, cluster, section
  const ranked = rankCandidates(candidates, plan, { now })
  const breaking = pickBreaking(ranked)
  const breakingIds = new Set(breaking.map((b) => b.id))
  const by = (kind) => ranked.filter((i) => i.kind === kind && !breakingIds.has(i.id))

  const forYou = diversify(ranked.filter((i) => i.rel >= 0.35 || i.why.some((w) => w.startsWith('Top story'))), 36, 3)
  const sections = {
    forYou,
    breaking,
    opportunities: diversify(by('opportunity'), 24, 4),
    reads: diversify([...by('read'), ...by('headline').filter((i) => i.ageH == null || i.ageH > 24)], 24, 3),
    research: diversify(by('research'), 16, 4),
    books: diversify(by('book'), 12, 4),
    mindset: diversify(by('mindset'), 14, 3),
    local: plan.country ? diversify(ranked.filter((i) => i.kind === 'headline' && i.why.some((w) => /^Top story|^Near you/.test(w))), 10, 3) : [],
  }

  const answered = new Set(candidates.map((c) => c.src?.id ?? c.source)).size
  return {
    generatedAt: new Date(now).toISOString(),
    sections,
    official: officialShelf(plan),
    meta: {
      candidates: candidates.length,
      shown: ranked.length,
      sourcesAnswered: answered,
      registrySize: SOURCES.length,
      sources: stats.sources,
      lanes: stats.lanes,
      webSearch: tavilyUsed,
      warming: !cacheOnly && stats.sources.chosen > 0 && answered < Math.ceil(stats.sources.chosen * 0.5) && candidates.length < 40,
      offline: candidates.length === 0 && !plan.empty && (stats.sources.failed > 0 || stats.lanes.failed > 0),
    },
  }
}

const safeHost = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ------------------------------------------------------- scheduled refresh

const CURSOR_KEY = 'brief:v1:cursor'

/**
 * Refresh the registry in the background (called by the daily cron). Works
 * through sources oldest-first and stops at the deadline, so a 60-second
 * function budget is always respected and the next run continues the work.
 */
export async function refreshRegistry({ budgetMs = 40_000, concurrency = 10 } = {}) {
  const deadline = Date.now() + budgetMs
  const feeds = SOURCES.filter((s) => s.feed)
  const aged = await Promise.all(feeds.map(async (s) => ({ s, at: (await cacheRead(keyFor('src', s.id)))?.at ?? 0 })))
  aged.sort((a, b) => a.at - b.at)
  const results = { attempted: 0, ok: 0, failed: 0, skippedForTime: 0 }
  const tasks = aged.map(({ s }) => async () => {
    if (Date.now() >= deadline) {
      results.skippedForTime++
      return
    }
    results.attempted++
    const r = await runUnit({ key: keyFor('src', s.id), label: s.name, ttlMs: 3 * HOUR, producer: () => fetchSourceFeed(s), deadline })
    if (r.state === 'refreshed' || r.state === 'fresh') results.ok++
    else results.failed++
  })
  await pool(tasks, concurrency)
  try {
    await storage.setSetting(CURSOR_KEY, JSON.stringify({ at: new Date().toISOString(), ...results }))
  } catch {
    /* informational only */
  }
  return results
}

/** Health of every registry source, for the admin board. */
export async function sourceHealth() {
  const off = new Set(await disabledSources())
  const rows = await Promise.all(
    SOURCES.map(async (s) => {
      const c = s.feed ? await cacheRead(keyFor('src', s.id)) : null
      return {
        id: s.id,
        name: s.name,
        home: s.home,
        region: s.region,
        kind: s.kind,
        tier: s.tier,
        lang: s.lang,
        topics: s.topics,
        linkOnly: !s.feed,
        disabled: off.has(s.id),
        status: !s.feed ? 'link-only' : !c ? 'untested' : c.fails > 0 && !c.items?.length ? 'failing' : c.fails > 0 ? 'degraded' : 'ok',
        items: c?.items?.length ?? 0,
        lastOk: c?.lastOk ? new Date(c.lastOk).toISOString() : null,
        error: c?.err ?? null,
        fails: c?.fails ?? 0,
      }
    }),
  )
  return rows
}

export { SOURCES, SOURCE_BY_ID }
