process.env.ADMIN_EMAILS = 'boss@example.com'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolveCountry } from '../src/briefing/countries.js'
import { mapPhrases, TOPICS } from '../src/briefing/topics.js'
import { SOURCES } from '../src/briefing/sources.js'
import { buildPlan } from '../src/briefing/plan.js'
import { rankCandidates, parseDeadline, canonicalUrl, pickBreaking } from '../src/briefing/rank.js'
import { parseFeedText, assertPublicHttps, __setFetch, __clearMemo, gnUrl } from '../src/briefing/fetch.js'
import { buildBriefing, chooseSources } from '../src/briefing/index.js'

const rss = (items) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${new Date(i.at ?? Date.now() - 3_600_000).toUTCString()}</pubDate><description>${i.desc ?? ''}</description></item>`)
    .join('')}</channel></rss>`

const response = (body, { status = 200, type = 'application/xml' } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  body: null,
  text: async () => body,
})

// ------------------------------------------------------------ the registry

test('registry: 100+ sources, unique ids, valid topics, https, honest link-only entries', () => {
  assert.ok(SOURCES.length >= 100, `only ${SOURCES.length} sources`)
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length)
  const topicIds = new Set(TOPICS.map((t) => t.id))
  for (const s of SOURCES) {
    assert.ok(s.topics.length > 0, s.id)
    for (const t of s.topics) assert.ok(topicIds.has(t), `${s.id} → unknown topic ${t}`)
    assert.match(s.home, /^https:\/\//, s.id)
    if (s.feed) assert.match(s.feed, /^https?:\/\//, s.id)
  }
  assert.ok(SOURCES.filter((s) => s.feed).length >= 100)
})

// ------------------------------------------------------------ understanding the person

test('location: cities, aliases and codes resolve; unknown places do not guess', () => {
  assert.equal(resolveCountry('Dar es Salaam')?.code, 'TZ')
  assert.equal(resolveCountry('Mwanza, Tanzania')?.code, 'TZ')
  assert.equal(resolveCountry('nairobi')?.code, 'KE')
  assert.equal(resolveCountry('tz')?.code, 'TZ')
  assert.equal(resolveCountry('Atlantis'), null)
  assert.equal(resolveCountry(''), null)
})

test('interests: English + Swahili phrases map to topics; unknown ones are kept as custom searches', () => {
  const { matched, unmatched } = mapPhrases(['I invest in bonds and stocks', 'kilimo', 'medical student', 'knitting'])
  assert.ok(matched.has('bonds') && matched.has('stocks') && matched.has('investing'))
  assert.ok(matched.has('agriculture'))
  assert.ok(matched.has('medicine'))
  assert.deepEqual(unmatched, ['knitting'])
  // "prayer" only matches faith when someone says it themselves
  assert.ok(!mapPhrases(['study hard']).matched.has('faith'))
})

test('plan: an investor in Dar es Salaam gets local market queries, bonds + stocks, official sources', () => {
  const plan = buildPlan({ profile: { interests: ['bonds', 'stocks'], goals: ['grow my savings'], region: 'Dar es Salaam' }, prefs: { personas: ['investor'] } })
  assert.equal(plan.country.code, 'TZ')
  const ids = plan.topics.map((t) => t.id)
  assert.ok(ids.includes('bonds') && ids.includes('stocks'))
  const qs = plan.queries.map((q) => q.q.toLowerCase())
  assert.ok(qs.some((q) => q.includes('dar es salaam stock exchange')))
  assert.ok(qs.some((q) => q.includes('tanzania') && q.includes('bond')))
  assert.equal(new Set(qs).size, qs.length, 'queries are de-duplicated')
  assert.ok(plan.queries.length <= 11)
  assert.equal(plan.empty, false)
  const picks = chooseSources(plan)
  assert.ok(picks.length > 10 && picks.every((s) => s.feed))
  assert.ok(picks.some((s) => s.region === 'tz'), 'local sources are chosen')
})

test('plan: a long topic list never crowds out custom interests or opportunity searches', () => {
  const p = buildPlan({ profile: { interests: ['bonds', 'stocks', 'medicine'], region: 'Tanzania' }, prefs: { personas: ['investor', 'medical'], custom: ['beekeeping'] } })
  assert.ok(p.queries.some((q) => q.custom === 'beekeeping'))
  assert.ok(p.queries.some((q) => q.opportunity && /scholarship/i.test(q.q)), 'ambition-driven opportunity search present')
})

test('plan: muting a topic removes it; no signals means an empty plan (never a generic firehose)', () => {
  const p = buildPlan({ profile: { interests: ['bonds'] }, prefs: { mutedTopics: ['bonds'] } })
  assert.ok(!p.topics.some((t) => t.id === 'bonds'))
  assert.equal(buildPlan({}).empty, true)
  const custom = buildPlan({ prefs: { custom: ['beekeeping'] } })
  assert.equal(custom.empty, false)
  assert.deepEqual(custom.customs, ['beekeeping'])
})

// ------------------------------------------------------------ fetching & parsing

test('parser: keeps title/link/snippet/date, drops junk and very old items, splits Google News publisher', async () => {
  const old = Date.now() - 90 * 86_400_000
  const items = await parseFeedText(rss([
    { title: 'Treasury bond auction oversubscribed', link: 'https://example.com/a', desc: '<p>Investors &amp; banks bid <b>TZS 300bn</b></p>' },
    { title: 'Ancient story', link: 'https://example.com/old', at: old },
    { title: 'No link', link: '' },
  ]))
  assert.equal(items.length, 1)
  assert.equal(items[0].summary, 'Investors & banks bid TZS 300bn')
  const gn = await parseFeedText(rss([{ title: 'BoT holds rate steady - The Citizen', link: 'https://news.google.com/rss/articles/xyz' }]), { gn: true })
  assert.equal(gn[0].title, 'BoT holds rate steady')
  assert.equal(gn[0].source, 'The Citizen')
})

test('network safety: private hosts and odd protocols are refused; user text only ever lands in an encoded query', () => {
  assert.throws(() => assertPublicHttps('http://127.0.0.1/admin'), /Blocked/)
  assert.throws(() => assertPublicHttps('https://localhost/x'), /Blocked/)
  assert.throws(() => assertPublicHttps('https://192.168.1.5/x'), /Blocked/)
  assert.throws(() => assertPublicHttps('file:///etc/passwd'), /Unsupported/)
  const u = gnUrl({ q: 'x&gl=EVIL#frag', locale: { hl: 'en-TZ', gl: 'TZ', ceid: 'TZ:en' } })
  assert.ok(new URL(u).hostname === 'news.google.com' && !u.includes('&gl=EVIL'))
})

// ------------------------------------------------------------ ranking

const plan = buildPlan({ profile: { interests: ['bonds', 'medicine'], region: 'Tanzania' } })
const cand = (o) => ({ title: 'x', url: `https://example.com/${randomUUID()}`, publishedAt: new Date(Date.now() - 2 * 3.6e6).toISOString(), summary: '', image: null, ...o })
const src = (o = {}) => ({ id: 's1', name: 'S1', home: 'https://s1.com', topics: ['bonds'], region: 'global', kind: 'news', tier: 1, lang: 'en', ...o })

test('ranking: irrelevant items are dropped, relevant ones explain why', () => {
  const out = rankCandidates([
    cand({ title: 'Celebrity wedding photos released', src: src({ topics: ['culture'] }) }),
    cand({ title: 'Treasury bond yields climb as auction draws record bids', src: src() }),
  ], plan)
  assert.equal(out.length, 1)
  assert.match(out[0].title, /Treasury bond/)
  assert.ok(out[0].why.some((w) => /Bonds/.test(w)))
})

test('ranking: duplicates collapse into one story that credits the other outlets', () => {
  const out = rankCandidates([
    cand({ title: 'Bank of Tanzania raises treasury bond yields', src: src({ id: 'a', name: 'A' }) }),
    cand({ title: 'Bank of Tanzania raises treasury bond yields sharply', src: src({ id: 'b', name: 'B' }) }),
    cand({ title: 'Treasury bond yields: Bank of Tanzania raises', url: 'https://example.com/x?utm_source=z', src: src({ id: 'c', name: 'C' }) }),
  ], plan)
  assert.equal(out.length, 1)
  assert.equal(out[0].cluster, 3)
  assert.equal(out[0].also.length, 2)
  assert.equal(canonicalUrl('https://www.Example.com/a/?utm_source=x&id=2#top'), 'example.com/a?id=2')
})

test('ranking: closed opportunities are dropped, stated deadlines are surfaced, none is invented', () => {
  const today = new Date(Date.UTC(2026, 10, 1))
  const open = cand({ title: 'Mastercard Foundation scholarship for medicine students — deadline: 20 November 2026', src: src({ kind: 'opportunity', topics: ['medicine'] }) })
  const closed = cand({ title: 'Medicine fellowship for graduates — deadline: 3 March 2026', src: src({ kind: 'opportunity', topics: ['medicine'] }) })
  const undated = cand({ title: 'Medicine internship call for applications', src: src({ kind: 'opportunity', topics: ['medicine'] }) })
  const out = rankCandidates([open, closed, undated], plan, { today, now: today.getTime() })
  const by = Object.fromEntries(out.map((o) => [o.title.slice(0, 12), o]))
  assert.equal(out.length, 2)
  assert.equal(by['Mastercard F'].deadline, '2026-11-20')
  assert.equal(by['Medicine int'].deadline, null)
  assert.equal(parseDeadline('Apply before December 5, 2026', today), '2026-12-05')
  assert.equal(parseDeadline('Apply soon!', today), null)
})

test('ranking: muted sources and hidden stories never come back; breaking needs freshness + corroboration or a primary newsroom', () => {
  const muted = buildPlan({ profile: { interests: ['bonds'] }, prefs: { mutedSources: ['s1'] } })
  assert.equal(rankCandidates([cand({ title: 'Treasury bond auction', src: src() })], muted).length, 0)
  const c = cand({ title: 'Treasury bond auction results', src: src() })
  const first = rankCandidates([c], plan)
  const hidden = buildPlan({ profile: { interests: ['bonds'] }, prefs: { hidden: [first[0].id] } })
  assert.equal(rankCandidates([c], hidden).length, 0)

  const fresh = rankCandidates([cand({ title: 'Treasury bond emergency rate decision', publishedAt: new Date(Date.now() - 20 * 60_000).toISOString(), src: src({ tier: 1 }) })], plan)
  assert.equal(pickBreaking(fresh).length, 1)
  const lowTierSolo = rankCandidates([cand({ title: 'Treasury bond rumour mill', publishedAt: new Date(Date.now() - 20 * 60_000).toISOString(), src: src({ tier: 3 }) })], plan)
  assert.equal(pickBreaking(lowTierSolo).length, 0)
  const stale = rankCandidates([cand({ title: 'Treasury bond emergency rate decision', publishedAt: new Date(Date.now() - 30 * 3.6e6).toISOString(), src: src({ tier: 1 }) })], plan)
  assert.equal(pickBreaking(stale).length, 0)
})

// ------------------------------------------------------------ the whole pipeline

test('pipeline: failing sources degrade gracefully, fresh data is cached, lanes reach beyond the registry', async (t) => {
  __clearMemo()
  const calls = []
  __setFetch(async (url) => {
    calls.push(String(url))
    const u = String(url)
    if (u.includes('bbci.co.uk') || u.includes('dailynews.co.tz')) return response('nope', { status: 503 }) // dead sources
    if (u.startsWith('https://news.google.com/rss/search')) {
      return response(rss([{ title: 'Tanzania treasury bonds draw record demand - The Citizen', link: `https://news.google.com/rss/articles/${randomUUID()}` }]))
    }
    if (u.startsWith('https://openlibrary.org/search.json')) {
      return response(JSON.stringify({ docs: [{ key: '/works/OL1W', title: 'The Intelligent Investor', author_name: ['Benjamin Graham'], first_publish_year: 1949, cover_i: 12, ratings_count: 900 }] }))
    }
    if (u.includes('pubmed') || u.includes('eutils')) return response(JSON.stringify({ esearchresult: { idlist: [] } }))
    return response(rss([{ title: 'Investors eye treasury bonds as inflation cools', link: `https://example.com/${randomUUID()}` }, { title: 'Local football derby tonight', link: `https://example.com/${randomUUID()}` }]))
  })
  t.after(() => __setFetch(null))

  const p = buildPlan({ profile: { interests: ['bonds', 'stocks'], region: 'Dar es Salaam' }, prefs: { custom: ['beekeeping'] } })
  const brief = await buildBriefing(p)
  assert.ok(brief.sections.forYou.length > 0, 'got stories')
  assert.ok(brief.sections.forYou.every((i) => i.why.length > 0), 'every story says why')
  // A football story may appear only as a labelled national top story, never as a topical match.
  assert.ok(brief.sections.forYou.filter((i) => /football/i.test(i.title)).every((i) => i.why[0].startsWith('Top story')), 'off-topic stories only appear labelled as local top stories')
  assert.ok(brief.sections.books.some((b) => b.title === 'The Intelligent Investor'), 'books lane works')
  assert.ok(brief.sections.forYou.some((i) => i.source === 'The Citizen'), 'search lane reaches publishers outside the registry')
  assert.ok(brief.meta.sources.failed >= 1 || brief.meta.sources.chosen >= 1)
  assert.equal(brief.meta.offline, false)
  assert.ok(brief.official.some((o) => o.name.includes('Dar es Salaam Stock Exchange')), 'official sources are pointed to, not scraped')

  // Second build is served from the shared cache — no new network calls.
  const before = calls.length
  await buildBriefing(p)
  assert.equal(calls.length, before, 'cached data is reused')

  // cacheOnly never touches the network.
  __clearMemo()
  const b2 = await buildBriefing(p, { cacheOnly: true })
  assert.equal(calls.length, before)
  assert.ok(b2.sections.forYou.length > 0)
})

test('pipeline: when every site is down the briefing says so instead of inventing content', async (t) => {
  __clearMemo()
  __setFetch(async () => {
    throw new Error('network down')
  })
  t.after(() => __setFetch(null))
  const p = buildPlan({ profile: { region: 'Kigali' }, prefs: { custom: [`zzqx${randomUUID().slice(0, 6)}`] } })
  const brief = await buildBriefing(p)
  assert.equal(brief.sections.forYou.length, 0)
  assert.equal(brief.meta.offline, true)
})

// ------------------------------------------------------------ HTTP API

async function boot() {
  const { default: app } = await import('../src/app.js')
  const server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const email = `brief-${randomUUID().slice(0, 8)}@example.com`
  const res = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Brief Tester', email, password: 'correct-horse-battery' }) })
  const body = await res.json()
  assert.ok(body.token, JSON.stringify(body))
  const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${body.token}`, ...(init.headers ?? {}) } })
  return { server, api }
}

test('briefing API: requires auth, starts empty, personalises from prefs, saves & validates items, digest refunds without AI', async (t) => {
  __clearMemo()
  __setFetch(async (url) => {
    const u = String(url)
    if (u.startsWith('https://openlibrary.org')) return response(JSON.stringify({ docs: [] }))
    if (u.includes('eutils')) return response(JSON.stringify({ esearchresult: { idlist: [] } }))
    return response(rss([{ title: 'Doctors report breakthrough in malaria vaccine rollout', link: `https://example.com/${randomUUID()}` }, { title: 'Medicine students win research grant', link: `https://example.com/${randomUUID()}` }]))
  })
  const { server, api } = await boot()
  t.after(() => {
    server.close()
    __setFetch(null)
  })

  const anon = await fetch(`http://127.0.0.1:${server.address().port}/api/life/briefing`)
  assert.equal(anon.status, 401)

  const cat = await (await api('/life/briefing/catalog')).json()
  assert.ok(cat.topics.length > 20 && cat.personas.length >= 8 && cat.countries.some((c) => c.code === 'TZ'))
  assert.ok(cat.registry.sources >= 100)

  const empty = await (await api('/life/briefing')).json()
  assert.equal(empty.empty, true)

  // validation of the settings kind
  const badTopic = await api('/life/items', { method: 'POST', body: JSON.stringify({ kind: 'briefing_prefs', data: { topics: { 'Bad Topic!': 1, medicine: 5 }, lang: 'fr' } }) })
  assert.equal(badTopic.status, 400) // lang enum enforced
  const ok = await api('/life/items', { method: 'POST', body: JSON.stringify({ kind: 'briefing_prefs', data: { personas: ['medical'], topics: { 'Bad Topic!': 1, medicine: 5 }, country: 'tz', lang: 'both', onboarded: true } }) })
  assert.equal(ok.status, 201)
  const saved = (await ok.json()).item.data
  assert.deepEqual(saved.topics, { medicine: 1 }, 'bad ids dropped, weights clamped')
  assert.equal(saved.country, 'TZ')

  const plan = (await (await api('/life/briefing/plan')).json()).plan
  assert.ok(plan.topics.some((x) => x.id === 'medicine'))
  assert.equal(plan.country.code, 'TZ')

  const brief = await (await api('/life/briefing')).json()
  assert.ok(brief.sections.forYou.length > 0)
  assert.ok(brief.sections.forYou.some((i) => /malaria|Medicine/.test(i.title)))

  // Saving a story keeps it in full; non-http links are refused.
  const story = brief.sections.forYou[0]
  const keep = await api('/life/items', { method: 'POST', body: JSON.stringify({ kind: 'feed_saved', data: { url: story.url, title: story.title, source: story.source, kind: story.kind } }) })
  assert.equal(keep.status, 201)
  const evil = await api('/life/items', { method: 'POST', body: JSON.stringify({ kind: 'feed_saved', data: { url: 'javascript:alert(1)', title: 'x' } }) })
  assert.equal(evil.status, 400)

  // Digest: no AI configured → clear message and no credits spent.
  const before = (await (await api('/life/credits')).json()).balance
  const dg = await api('/life/briefing/digest', { method: 'POST', body: JSON.stringify({ idemKey: randomUUID() }) })
  assert.ok([502, 503].includes(dg.status), `digest status ${dg.status}: ${await dg.clone().text()}`)
  assert.equal((await (await api('/life/credits')).json()).balance, before)
})
