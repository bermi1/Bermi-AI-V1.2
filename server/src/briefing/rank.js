import { createHash } from 'node:crypto'
import { TOPIC_BY_ID, topicHits } from './topics.js'
import { nearbyRegions } from './countries.js'

// Scoring is deliberately transparent: every number below is explained back
// to the person as a "why you're seeing this" chip. Nothing is invented —
// an item is shown only if it genuinely matches something they follow,
// (or is a headline for their own country).

const OPP_RE = /\b(scholarships?|fellowships?|bursar(?:y|ies)|grants?|internships?|apprenticeships?|call for (?:applications?|proposals?|papers)|applications? (?:open|are open|invited)|apply (?:now|by|before)|vacanc(?:y|ies)|hiring|we(?:'| a)re hiring|job opening|tender|competition|accelerator|incubator|ajira|nafasi za kazi|udhamini)\b/i

const HALF_LIFE_H = { headline: 14, opportunity: 120, read: 96, research: 240, mindset: 168, book: Infinity }

const STOP = new Set('the a an of to in on for and or at by with from as is are was were be it its this that after over into new says say will about how what why who'.split(' '))

export function canonicalUrl(u) {
  try {
    const x = new URL(u)
    x.hash = ''
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$|cmpid|ocid)/i.test(k)) x.searchParams.delete(k)
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase()
  } catch {
    return String(u).toLowerCase()
  }
}

export const itemId = (url) => createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 12)

const tokens = (title) => new Set(title.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** Best-effort deadline from the text; null when not stated. Never guesses. */
export function parseDeadline(text, now = new Date()) {
  const t = String(text || '')
  const m =
    /deadline[^.\n]{0,25}?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s+(\d{4})/i.exec(t) ||
    /(?:deadline|closes?|apply (?:by|before))[^.\n]{0,25}?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i.exec(t)
  if (!m) return null
  let day, mon, year
  if (/^\d/.test(m[1])) [day, mon, year] = [Number(m[1]), m[2], Number(m[3])]
  else [mon, day, year] = [m[1], Number(m[2]), Number(m[3])]
  const mi = MONTHS[mon.slice(0, 3).toLowerCase()]
  if (mi == null || day < 1 || day > 31 || year < now.getFullYear() - 1 || year > now.getFullYear() + 2) return null
  const d = new Date(Date.UTC(year, mi, day))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function classify(item, src) {
  if (item.lane === 'books') return 'book'
  if (item.lane === 'research') return 'research'
  if (item.lane === 'jobs' || item.lane === 'opportunity') return 'opportunity'
  const text = `${item.title} ${item.summary || ''}`
  if (src?.kind === 'opportunity' || OPP_RE.test(item.title)) return 'opportunity'
  if (src?.kind === 'research') return 'research'
  if (src?.kind === 'motivation') return 'mindset'
  if (src?.kind === 'article') return 'read'
  if (OPP_RE.test(text) && !src) return 'opportunity'
  return 'headline'
}

/**
 * Score and shape raw candidates.
 * candidate: { title,url,publishedAt,summary,image,source?, lane?, laneTopic?, laneCustom?, src? }
 */
export function rankCandidates(candidates, plan, { now = Date.now(), today = new Date(now) } = {}) {
  const userTopics = plan.topics.map((t) => ({ ...t, def: TOPIC_BY_ID[t.id] }))
  const near = nearbyRegions(plan.countryRaw)
  const out = []
  const seenUrl = new Set()

  for (const c of candidates) {
    const id = itemId(c.url)
    if (plan.hidden.has(id) || seenUrl.has(id)) continue
    const src = c.src || null
    if (src && plan.mutedSources.includes(src.id)) continue
    seenUrl.add(id)

    const kind = classify(c, src)
    const text = `${c.title} ${c.summary || ''}`
    const titleOnly = c.title

    // ----- relevance: best-matching followed topic (or a custom interest)
    let rel = 0
    let best = null
    for (const t of userTopics) {
      const hits = topicHits(t.def, text)
      let r = 0
      if (hits) r = Math.min(1, 0.5 + 0.18 * hits + (topicHits(t.def, titleOnly) ? 0.2 : 0))
      else if (c.laneTopic === t.id) r = 0.6
      // A specialist source (journal, opportunity board, official body…) is
      // topical by itself; a general newsroom must actually mention the topic.
      else if (src && src.kind !== 'news' && src.topics.includes(t.id)) r = 0.3
      r *= t.weight
      if (r > rel) {
        rel = r
        best = t
      }
    }
    let customHit = null
    for (const cu of plan.customs) {
      const words = cu.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
      const lower = text.toLowerCase()
      const hit = words.length && words.every((w) => lower.includes(w))
      if (hit || c.laneCustom === cu) {
        const r = hit ? 0.85 : 0.6
        if (r > rel) {
          rel = r
          best = null
          customHit = cu
        }
      }
    }
    const isLocalLane = c.lane === 'local'
    if (isLocalLane) rel = Math.max(rel, 0.3)
    if (rel < 0.25) continue

    // ----- freshness
    const ageH = c.publishedAt ? Math.max(0, (now - Date.parse(c.publishedAt)) / 3.6e6) : null
    const half = HALF_LIFE_H[kind] ?? 24
    const fresh = half === Infinity ? 0.6 : ageH == null ? 0.35 : Math.pow(0.5, ageH / half)

    // ----- location
    let loc = 0
    if (c.lane === 'local' || c.scope === 'local') loc = 0.8
    if (src) {
      const idx = near.indexOf(src.region)
      if (idx === 0) loc = 1
      else if (idx > 0 && src.region !== 'global') loc = Math.max(loc, 0.6 - 0.1 * Math.min(idx, 3))
    }

    // ----- language preference
    let lang = 1
    if (src) {
      if (src.lang === 'sw' && plan.lang === 'en') lang = 0.45
      else if (src.lang === 'en' && plan.lang === 'sw') lang = 0.7
    }

    // ----- opportunity deadlines (only when the text actually states one)
    let deadline = null
    let urgency = 0
    if (kind === 'opportunity') {
      deadline = parseDeadline(text, today)
      if (deadline) {
        const days = Math.ceil((Date.parse(deadline) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000)
        if (days < 0) continue // closed — never show expired chances
        if (days <= 14) urgency = 0.15
      }
    }

    const trust = src ? (src.tier === 1 ? 1 : src.tier === 2 ? 0.9 : 0.8) : 0.85
    const score = (0.58 * rel + 0.27 * fresh + 0.1 * loc + 0.05 * trust + urgency) * lang

    const why = []
    if (best) {
      const origin = best.from.includes('goal') ? `your goal` : best.from.includes('ambition') ? 'your ambition' : best.from.some((f) => f.startsWith('persona')) && !best.from.includes('pick') && !best.from.includes('interest') ? 'your profile' : 'what you follow'
      why.push(`${best.label} — ${origin}`)
    } else if (customHit) why.push(`You follow “${customHit}”`)
    else if (isLocalLane) why.push(`Top story in ${plan.country?.name ?? 'your area'}`)
    if (loc >= 0.8 && plan.country && !isLocalLane) why.push(`Near you: ${plan.country.name}`)
    else if (loc >= 0.5 && plan.country) why.push('Regional')
    if (deadline) why.push(`Deadline ${deadline}`)

    out.push({
      id,
      title: c.title,
      url: c.url,
      source: c.source || src?.name || hostOf(c.url),
      home: src?.home || null,
      tier: src?.tier ?? 3,
      sourceId: src?.id ?? null,
      publishedAt: c.publishedAt || null,
      summary: c.summary || '',
      image: c.image || null,
      kind,
      topic: best?.id ?? null,
      custom: customHit,
      deadline,
      why,
      score: Math.round(score * 1000) / 1000,
      rel: Math.round(rel * 100) / 100,
      cluster: 1,
      also: [],
      ageH: ageH == null ? null : Math.round(ageH * 10) / 10,
    })
  }

  return cluster(out)
}

const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Group near-duplicate stories; keep the best and record who else covered it. */
function cluster(items) {
  items.sort((a, b) => b.score - a.score)
  const kept = []
  const toks = new Map()
  for (const it of items) {
    const tk = tokens(it.title)
    toks.set(it.id, tk)
    const twin = kept.find((k) => k.kind === it.kind && jaccard(toks.get(k.id), tk) >= 0.6)
    if (twin) {
      // "N outlets" counts DISTINCT publishers; the same site repeating a story is just dropped.
      if (it.source !== twin.source && !twin.also.includes(it.source)) {
        twin.cluster++
        if (twin.also.length < 4) twin.also.push(it.source)
      }
      continue
    }
    kept.push(it)
  }
  // Corroboration is a quality signal: a story many outlets carry rises a little.
  for (const k of kept) if (k.cluster > 1) k.score = Math.round((k.score + Math.min(0.08, 0.03 * (k.cluster - 1))) * 1000) / 1000
  return kept.sort((a, b) => b.score - a.score)
}

/** Take the top n while capping how many come from one source. */
export function diversify(items, n, perSource = 3) {
  const per = new Map()
  const out = []
  for (const it of items) {
    const k = it.sourceId || it.source
    if ((per.get(k) ?? 0) >= perSource) continue
    per.set(k, (per.get(k) ?? 0) + 1)
    out.push(it)
    if (out.length >= n) break
  }
  return out
}

/** Breaking = genuinely fresh, relevant, and corroborated or from a primary newsroom. */
export function pickBreaking(items) {
  return items
    .filter((i) => i.kind === 'headline' && i.ageH != null && i.ageH <= 3 && i.rel >= 0.4 && (i.cluster >= 2 || i.tier === 1))
    .sort((a, b) => a.ageH - b.ageH)
    .slice(0, 5)
}
