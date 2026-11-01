import { TOPICS, TOPIC_BY_ID, PERSONAS, mapPhrases } from './topics.js'
import { resolveCountry, countryByCode, newsLocale } from './countries.js'

// Turns who a person is (profile + briefing settings) into a concrete,
// explainable plan: which topics at what weight, where, in which language,
// and which live searches to run. Pure function — easy to test, and the
// same plan is shown back to the person so the feed is never a black box.

const SECTION = { world: 'WORLD', politics: 'NATION', economy: 'BUSINESS', investing: 'BUSINESS', stocks: 'BUSINESS', bonds: 'BUSINESS', entrepreneurship: 'BUSINESS', medicine: 'HEALTH', 'public-health': 'HEALTH', fitness: 'HEALTH', 'mental-health': 'HEALTH', science: 'SCIENCE', software: 'TECHNOLOGY', ai: 'TECHNOLOGY', cyber: 'TECHNOLOGY', sports: 'SPORTS', culture: 'ENTERTAINMENT' }

const firstWords = (s, n = 2) => s.split(/\s+/).slice(0, n).join(' ')
const OPPORTUNITY_TOPICS = new Set(['medicine', 'software', 'ai', 'cyber', 'science', 'education', 'entrepreneurship', 'startups', 'agriculture', 'design', 'public-health', 'climate-energy', 'investing', 'leadership'])

export function buildPlan({ profile = {}, prefs = {}, maxTopics = 8 } = {}) {
  const weights = new Map() // topicId -> { w, from:Set }
  const bump = (id, w, from) => {
    if (!TOPIC_BY_ID[id] || w <= 0) return
    const cur = weights.get(id) ?? { w: 0, from: new Set() }
    cur.w = Math.max(cur.w, Math.min(1, w))
    cur.from.add(from)
    weights.set(id, cur)
  }

  // 1. Explicit choices (strongest signal — the person picked them).
  for (const [id, w] of Object.entries(prefs.topics ?? {})) bump(id, Number(w) || 1, 'pick')
  // 2. "I am a …" starter bundles.
  for (const pid of prefs.personas ?? []) {
    const p = PERSONAS.find((x) => x.id === pid)
    if (p) for (const [id, w] of Object.entries(p.topics)) bump(id, w * 0.9, `persona:${p.label}`)
  }
  // 3. Profile interests & goals, plus the free-text ambition.
  const customs = []
  const ints = mapPhrases(profile.interests ?? [], 0.9)
  for (const [id, w] of ints.matched) bump(id, w, 'interest')
  customs.push(...ints.unmatched)
  const goals = mapPhrases(profile.goals ?? [], 0.75)
  for (const [id, w] of goals.matched) bump(id, w, 'goal')
  if (prefs.ambition) {
    const amb = mapPhrases([prefs.ambition], 0.7)
    for (const [id, w] of amb.matched) bump(id, w, 'ambition')
  }
  const cust = mapPhrases(prefs.custom ?? [], 1)
  for (const [id, w] of cust.matched) bump(id, w, 'pick')
  customs.push(...cust.unmatched)

  // Muting wins over everything.
  for (const m of prefs.mutedTopics ?? []) weights.delete(m)

  const topics = [...weights.entries()]
    .map(([id, v]) => ({ id, label: TOPIC_BY_ID[id].label, weight: Math.round(v.w * 100) / 100, from: [...v.from] }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxTopics)

  const country = countryByCode(prefs.country) || resolveCountry(profile.region) || null
  const lang = prefs.lang || (country?.lang === 'sw' ? 'both' : 'en')
  const locale = newsLocale(country)

  const uniqCustoms = [...new Set(customs.map((c) => c.trim()).filter(Boolean))].slice(0, 5)

  // ---- live searches (cached + shared between users; see index.js)
  const queries = []
  const customQ = []
  const oppQ = []
  const where = country?.name ?? ''
  for (const t of topics.slice(0, 4)) {
    const topic = TOPIC_BY_ID[t.id]
    const lq = topic.lq || firstWords(topic.q)
    queries.push({ key: `t:${t.id}:local`, q: `${where} ${lq}`.trim(), topic: t.id, scope: where ? 'local' : 'world' })
    if (where) queries.push({ key: `t:${t.id}:global`, q: topic.q, topic: t.id, scope: 'world' })
    const mkt = country?.mkt
    if (mkt && topic.group === 'Money') {
      const q = t.id === 'bonds' ? (mkt[2] ?? mkt[1]) : t.id === 'economy' ? mkt[1] : mkt[0]
      if (q) queries.push({ key: `t:${t.id}:mkt`, q, topic: t.id, scope: 'local' })
    }
  }
  for (const c of uniqCustoms.slice(0, 4)) customQ.push({ key: `c:${c.toLowerCase()}`, q: `"${c}"`, custom: c, scope: 'world' })
  // Ambition → opportunities: scholarships / internships / fellowships in their lane.
  const opp = topics.filter((t) => OPPORTUNITY_TOPICS.has(t.id)).slice(0, 2)
  for (const t of opp) {
    const topic = TOPIC_BY_ID[t.id]
    oppQ.push({ key: `o:${t.id}`, q: `${topic.lq || firstWords(topic.q, 1)} (scholarship OR fellowship OR internship OR grant OR "call for applications") ${where}`.trim(), topic: t.id, opportunity: true, scope: 'opportunity' })
  }

  // ---- section headlines for their country
  const sections = []
  if (country) {
    sections.push({ key: 'top', section: null })
    const seen = new Set()
    for (const t of topics) {
      const s = SECTION[t.id]
      if (s && !seen.has(s)) {
        seen.add(s)
        sections.push({ key: `s:${s}`, section: s })
      }
      if (sections.length >= 3) break
    }
  } else {
    sections.push({ key: 'top', section: null })
  }

  // ---- research / books / jobs lanes
  const research = []
  for (const t of topics.slice(0, 5)) {
    const topic = TOPIC_BY_ID[t.id]
    if (topic.pubmed) research.push({ type: 'pubmed', term: topic.pubmed === 'medicine' ? 'medicine[MeSH Terms] AND (review[pt] OR clinical trial[pt])' : `${topic.pubmed}[MeSH Terms]`, topic: t.id })
    if (topic.arxiv) research.push({ type: 'arxiv', cat: topic.arxiv, topic: t.id })
  }
  for (const c of uniqCustoms) if (topics.some((t) => ['medicine', 'public-health', 'mental-health'].includes(t.id)) && /^[\w\s-]{3,40}$/.test(c)) research.push({ type: 'pubmed', term: `${c}[Title/Abstract]`, topic: null, custom: c })
  const books = []
  for (const t of topics.slice(0, 4)) {
    const slug = TOPIC_BY_ID[t.id].books?.[0]
    if (slug) books.push({ subject: slug, topic: t.id })
  }
  const jobTopic = topics.find((t) => t.id === 'careers' || t.id === 'software')
  const jobs = jobTopic && jobTopic.weight >= 0.4 ? { dev: topics.some((t) => t.id === 'software' && t.weight >= 0.5) } : null

  return {
    topics,
    customs: uniqCustoms,
    country: country ? { code: country.code, name: country.name } : null,
    countryRaw: country,
    lang,
    locale,
    // Reserve room for custom interests and opportunity searches so a long
    // topic list can never crowd them out.
    queries: dedupeQueries([...dedupeQueries(queries).slice(0, 6), ...customQ.slice(0, 3), ...oppQ.slice(0, 2)]),
    sections,
    research: research.slice(0, 4),
    books: books.slice(0, 3),
    jobs,
    mutedSources: prefs.mutedSources ?? [],
    hidden: new Set(prefs.hidden ?? []),
    ambition: prefs.ambition || '',
    empty: topics.length === 0 && uniqCustoms.length === 0,
  }
}

function dedupeQueries(list) {
  const seen = new Set()
  return list.filter((q) => {
    const k = q.q.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** The plan as the client sees it (no internals). */
export function publicPlan(plan) {
  return {
    topics: plan.topics,
    customs: plan.customs,
    country: plan.country,
    lang: plan.lang,
    ambition: plan.ambition,
    searches: plan.queries.map((q) => q.q),
    empty: plan.empty,
  }
}

export { TOPICS, PERSONAS }
