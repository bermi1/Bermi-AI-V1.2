import Parser from 'rss-parser'
import { createHash } from 'node:crypto'
import { storage } from '../storage/index.js'

// Everything that touches the network lives here. Rules:
//  • Only https, only public hosts (registry URLs and fixed API hosts — user
//    text is only ever placed in an encoded query string, never a hostname).
//  • Hard timeout and byte cap on every request; a slow or huge site can
//    never stall or exhaust a function.
//  • We keep ONLY headline, link, a short snippet, date and thumbnail URL —
//    attribution plus a link out. Full articles are never copied or stored.
//  • One failing source degrades to its last good copy and backs off; it can
//    never fail a person's briefing.

const UA = 'BermiBot/1.0 (+https://bermiai.com; personal news briefing; respects robots and rate limits)'
const MAX_BYTES = 1_500_000
const KEEP_DAYS = 45

export const CACHE_PREFIX = 'brief:v1:'

// ------------------------------------------------------------------- http

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?fe80|\[?fc|\[?fd)/i

export function assertPublicHttps(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Unsupported protocol')
  if (PRIVATE_HOST.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) throw new Error('Blocked host')
  return u
}

// Test seam: lets the suite supply canned responses without a network.
let fetchImpl = (...a) => globalThis.fetch(...a)
export function __setFetch(fn) {
  fetchImpl = fn ?? ((...a) => globalThis.fetch(...a))
}

export async function httpText(url, { timeout = 7000, accept = 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.5' } = {}) {
  assertPublicHttps(url)
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeout)
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: accept } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const len = Number(res.headers?.get?.('content-length') || 0)
    if (len > MAX_BYTES * 2) throw new Error('Response too large')
    if (!res.body?.getReader) {
      const t = await res.text()
      return t.length > MAX_BYTES ? t.slice(0, MAX_BYTES) : t
    }
    const reader = res.body.getReader()
    const chunks = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      chunks.push(value)
      if (total > MAX_BYTES) {
        ctl.abort()
        break
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
  } finally {
    clearTimeout(timer)
  }
}

// ------------------------------------------------------------------- parse

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumb'],
      ['media:content', 'mediaContent'],
      ['source', 'gnSource'],
    ],
  },
})

const decode = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

const attrUrl = (v) => {
  if (!v) return null
  const one = Array.isArray(v) ? v[0] : v
  const u = one?.$?.url ?? one?.url ?? (typeof one === 'string' ? one : null)
  return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null
}

function pickImage(item) {
  const enc = item.enclosure?.url && /^image\//.test(item.enclosure.type || 'image/') ? item.enclosure.url : null
  const media = attrUrl(item.mediaThumb) || attrUrl(item.mediaContent)
  let fromHtml = null
  const html = item['content:encoded'] || item.content || ''
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html)
  if (m && /^https?:\/\//i.test(m[1])) fromHtml = m[1]
  const url = enc || media || fromHtml
  return url && url.length < 600 ? url : null
}

function toIso(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Parse RSS/Atom text into normalised items (shared by sources and lanes). */
export async function parseFeedText(xml, { limit = 20, gn = false } = {}) {
  const feed = await parser.parseString(xml)
  const now = Date.now()
  const out = []
  for (const it of feed.items || []) {
    let title = decode(it.title)
    let link = (it.link || it.guid || '').trim()
    if (!title || !/^https?:\/\//i.test(link)) continue
    let source
    if (gn) {
      // Google News titles read "Headline - Publisher".
      const pub = typeof it.gnSource === 'string' ? it.gnSource : it.gnSource?._ || null
      const cut = title.lastIndexOf(' - ')
      if (cut > 12) {
        source = source || title.slice(cut + 3).trim()
        title = title.slice(0, cut).trim()
      }
      if (pub) source = decode(pub)
    }
    const publishedAt = toIso(it.isoDate || it.pubDate)
    if (publishedAt) {
      const age = now - Date.parse(publishedAt)
      if (age > KEEP_DAYS * 86_400_000 || age < -86_400_000) continue
    }
    const summary = gn ? '' : decode(it.contentSnippet || it.summary || it.content || '').slice(0, 280)
    out.push({ title: title.slice(0, 220), url: link, publishedAt, summary, image: gn ? null : pickImage(it), ...(source ? { source } : {}) })
    if (out.length >= limit) break
  }
  return out
}

// ------------------------------------------------------------------- lanes
// "Lanes" are live searches that reach beyond the registry — they are how a
// briefing covers any interest in any place.

const enc = encodeURIComponent

export function gnUrl({ q, locale, section }) {
  const loc = `hl=${enc(locale.hl)}&gl=${enc(locale.gl)}&ceid=${enc(locale.ceid)}`
  if (section) return `https://news.google.com/rss/headlines/section/topic/${section}?${loc}`
  if (!q) return `https://news.google.com/rss?${loc}`
  return `https://news.google.com/rss/search?q=${enc(`${q} when:7d`)}&${loc}`
}

export async function laneGoogleNews({ q, locale, section }) {
  const xml = await httpText(gnUrl({ q, locale, section }))
  return parseFeedText(xml, { limit: 14, gn: true })
}

export async function laneBooks(subject) {
  const slug = String(subject).toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
  const url = `https://openlibrary.org/search.json?subject=${enc(slug)}&sort=rating&limit=14&fields=key,title,author_name,first_publish_year,cover_i,ratings_count`
  const body = JSON.parse(await httpText(url, { accept: 'application/json' }))
  return (body.docs || [])
    .filter((d) => d.title && d.key && (d.ratings_count ?? 0) >= 5)
    .slice(0, 8)
    .map((d) => ({
      title: String(d.title).slice(0, 200),
      url: `https://openlibrary.org${d.key}`,
      publishedAt: null,
      summary: [d.author_name?.[0] && `by ${d.author_name[0]}`, d.first_publish_year].filter(Boolean).join(' · '),
      image: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      source: 'Open Library',
    }))
}

export async function lanePubmed(term) {
  const q = `${term} AND hasabstract`
  const search = JSON.parse(
    await httpText(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${enc(q)}&retmax=8&sort=date&datetype=pdat&reldate=45&retmode=json`, { accept: 'application/json' }),
  )
  const ids = search?.esearchresult?.idlist ?? []
  if (!ids.length) return []
  const sum = JSON.parse(await httpText(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`, { accept: 'application/json' }))
  return ids
    .map((id) => sum?.result?.[id])
    .filter((r) => r?.title)
    .map((r) => ({
      title: decode(r.title).slice(0, 240),
      url: `https://pubmed.ncbi.nlm.nih.gov/${r.uid}/`,
      publishedAt: toIso(r.sortpubdate?.slice(0, 10)),
      summary: [r.authors?.[0]?.name && `${r.authors[0].name}${r.authors.length > 1 ? ' et al.' : ''}`, r.fulljournalname].filter(Boolean).join(' · ').slice(0, 200),
      image: null,
      source: 'PubMed',
    }))
}

export async function laneArxiv(cat) {
  const xml = await httpText(`https://export.arxiv.org/api/query?search_query=cat:${enc(cat)}&sortBy=submittedDate&sortOrder=descending&max_results=8`)
  const items = await parseFeedText(xml, { limit: 8 })
  return items.map((i) => ({ ...i, source: 'arXiv', summary: i.summary.slice(0, 220) }))
}

export async function laneJobs({ q, dev }) {
  const url = `https://remotive.com/api/remote-jobs?limit=12${dev ? '&category=software-dev' : ''}${q ? `&search=${enc(q)}` : ''}`
  const body = JSON.parse(await httpText(url, { accept: 'application/json' }))
  return (body.jobs || []).slice(0, 10).map((j) => ({
    title: `${decode(j.title)} — ${decode(j.company_name)}`.slice(0, 220),
    url: j.url,
    publishedAt: toIso(j.publication_date),
    summary: [j.job_type?.replace(/_/g, ' '), j.candidate_required_location && `open to: ${j.candidate_required_location}`, j.salary].filter(Boolean).join(' · ').slice(0, 200),
    image: null,
    source: 'Remotive',
  }))
}

export async function fetchSourceFeed(source) {
  const xml = await httpText(source.feed)
  return parseFeedText(xml, { limit: 15 })
}

// ------------------------------------------------------------------- cache + health
// One cache entry per "unit" (a registry source or a lane query):
//   { at, items, fails, err, nextTry, lastOk }
// Shared by every user, so popular queries are fetched once per TTL.

const memo = new Map() // short in-process memo to spare storage round-trips on a warm instance
const MEMO_MS = 120_000
const inflight = new Map()

export const keyFor = (...parts) => CACHE_PREFIX + createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 20)

export async function cacheRead(key) {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.t < MEMO_MS) return hit.v
  let v = null
  try {
    const raw = await storage.getSetting(key)
    v = raw ? JSON.parse(raw) : null
  } catch {
    v = null
  }
  memo.set(key, { t: Date.now(), v })
  return v
}

async function cacheWrite(key, v) {
  memo.set(key, { t: Date.now(), v })
  try {
    await storage.setSetting(key, JSON.stringify(v))
  } catch {
    /* a failed cache write must never fail a request */
  }
}

const backoffMs = (fails) => (fails <= 1 ? 10 * 60_000 : fails === 2 ? 60 * 60_000 : fails < 6 ? 6 * 3_600_000 : 24 * 3_600_000)

export function __clearMemo() {
  memo.clear()
}

/**
 * Returns { items, state } for a unit. state: 'fresh' | 'refreshed' | 'stale'
 * | 'failed' | 'backoff' | 'empty'. Never throws.
 */
export async function runUnit({ key, label, ttlMs, producer, deadline, force = false }) {
  const cached = await cacheRead(key)
  const now = Date.now()
  const have = cached?.items ?? []
  if (cached && !force && now - cached.at < ttlMs) return { items: have, state: 'fresh', at: cached.at }
  if (cached?.nextTry && cached.nextTry > now && !force) return { items: have, state: have.length ? 'stale' : 'backoff', at: cached.at, err: cached.err }
  if (deadline && now >= deadline) return { items: have, state: have.length ? 'stale' : 'empty', at: cached?.at }

  if (inflight.has(key)) return inflight.get(key)
  const job = (async () => {
    try {
      const items = await producer()
      const v = { at: Date.now(), items, fails: 0, lastOk: Date.now(), label }
      await cacheWrite(key, v)
      return { items, state: 'refreshed', at: v.at }
    } catch (err) {
      const fails = (cached?.fails ?? 0) + 1
      const v = { at: cached?.at ?? 0, items: have, fails, err: String(err?.message || err).slice(0, 160), nextTry: Date.now() + backoffMs(fails), lastOk: cached?.lastOk ?? null, label }
      await cacheWrite(key, v)
      return { items: have, state: have.length ? 'stale' : 'failed', at: cached?.at, err: v.err }
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, job)
  return job
}

/** Run async tasks with a concurrency cap. */
export async function pool(tasks, limit = 10) {
  const results = new Array(tasks.length)
  let i = 0
  const worker = async () => {
    while (i < tasks.length) {
      const n = i++
      results[n] = await tasks[n]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}
