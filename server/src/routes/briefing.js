import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'
import { checkRateLimit } from '../rateLimit.js'
import * as credits from '../credits.js'
import { buildPlan, publicPlan } from '../briefing/plan.js'
import { buildBriefing, SOURCES } from '../briefing/index.js'
import { TOPICS, PERSONAS } from '../briefing/topics.js'
import { COUNTRIES } from '../briefing/countries.js'

export const briefingRouter = Router()

// Buckets are per user AND per feature (the shared limiter keys on user only).
const limit = (name, { windowMs, max, message }) => (req, res, next) => {
  if (!checkRateLimit(`${req.user?.id || req.ip}:${name}`, { windowMs, max })) {
    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
    return res.status(429).json({ error: message })
  }
  next()
}

async function loadPlan(userId, { respectContext = true } = {}) {
  const [profile, prefs] = await Promise.all([
    storage.listLifeItems(userId, 'profile', { limit: 1 }).then((r) => r[0]?.data ?? {}).catch(() => ({})),
    storage.listLifeItems(userId, 'briefing_prefs', { limit: 1 }).then((r) => r[0]?.data ?? {}).catch(() => ({})),
  ])
  // A person who switched "assistant context" off in Personalisation has said
  // not to use their goals/interests; their explicit briefing picks still apply.
  const useProfile = !respectContext || profile.assistantContext !== false
  return { profile: useProfile ? profile : { region: profile.region }, prefs, plan: buildPlan({ profile: useProfile ? profile : { region: profile.region }, prefs }) }
}

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    next(err)
  }
}

// What the "tune your feed" screen offers.
briefingRouter.get(
  '/life/briefing/catalog',
  wrap(async (_req, res) => {
    res.json({
      topics: TOPICS.map((t) => ({ id: t.id, label: t.label, group: t.group })),
      personas: PERSONAS.map((p) => ({ id: p.id, label: p.label })),
      countries: COUNTRIES.map((c) => ({ code: c.code, name: c.name })),
      registry: { sources: SOURCES.length, withFeeds: SOURCES.filter((s) => s.feed).length },
    })
  }),
)

briefingRouter.get(
  '/life/briefing/plan',
  wrap(async (req, res) => {
    const { plan } = await loadPlan(req.user.id)
    res.json({ plan: publicPlan(plan) })
  }),
)

briefingRouter.get(
  '/life/briefing',
  limit('briefing', { windowMs: 60_000, max: 20, message: 'Give the briefing a moment, then refresh again.' }),
  wrap(async (req, res) => {
    const { plan } = await loadPlan(req.user.id)
    if (plan.empty) return res.json({ plan: publicPlan(plan), empty: true, sections: null })
    const force = req.query.refresh === '1'
    const brief = await buildBriefing(plan, { force })
    res.json({ plan: publicPlan(plan), ...brief })
  }),
)

const DIGEST_PROMPT =
  'You write a short, personal daily briefing for one person. You are given their goals and a numbered list of REAL headlines ' +
  '(title, source, age) that were just fetched. Rules: use ONLY the numbered items — never add facts, figures, prices or events that are ' +
  'not in a title; if the items do not support a claim, do not make it. Reply with JSON only: ' +
  '{"summary":"3-4 plain sentences on what matters most for THIS person today","why":"1-2 sentences linking it to their goals",' +
  '"actions":["up to 3 specific, small next steps they could take today"],"cite":[item numbers you relied on]}. No markdown.'

function extractJson(text) {
  const m = /\{[\s\S]*\}/.exec(text || '')
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

briefingRouter.post(
  '/life/briefing/digest',
  limit('digest', { windowMs: 60_000, max: 4, message: 'Give the assistant a moment, then try again.' }),
  wrap(async (req, res) => {
    const { plan, profile } = await loadPlan(req.user.id)
    if (plan.empty) return res.status(400).json({ error: 'Choose a few interests first so the briefing knows what to look for.' })
    // Digest works on what is already fetched — no network, no surprise cost.
    const brief = await buildBriefing(plan, { cacheOnly: true })
    const pool = [...brief.sections.breaking, ...brief.sections.forYou, ...brief.sections.opportunities].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i).slice(0, 12)
    if (pool.length < 3) return res.status(409).json({ code: 'not_enough_items', error: 'Open your briefing first so there is something to summarise.' })

    const idemKey = String(req.body?.idemKey || randomUUID()).slice(0, 80)
    const reservation = await credits.reserve(req.user.id, { feature: 'briefing_digest', idemKey })
    if (!reservation.ok) {
      const status = reservation.code === 'insufficient_credits' ? 402 : reservation.code === 'duplicate' ? 409 : 503
      return res.status(status).json({ code: reservation.code, error: reservation.message, balance: reservation.balance })
    }
    const list = pool.map((i, n) => `${n + 1}. ${i.title} — ${i.source}${i.ageH != null ? `, ${i.ageH < 1 ? 'minutes' : Math.round(i.ageH) + 'h'} ago` : ''}`).join('\n')
    const goals = (profile.assistantContext === false ? [] : profile.goals ?? []).slice(0, 5)
    let raw
    try {
      raw = await complete({
        model: 'bermi-fast',
        maxTokens: 700,
        messages: [
          { role: 'system', content: DIGEST_PROMPT },
          {
            role: 'user',
            content: `Person: follows ${plan.topics.map((t) => t.label).join(', ') || 'general news'}${plan.customs.length ? `, ${plan.customs.join(', ')}` : ''}. Location: ${plan.country?.name ?? 'unknown'}.\nGoals: ${goals.join('; ') || 'not stated'}. ${plan.ambition ? `Ambition: ${plan.ambition}.` : ''}\n\nHeadlines:\n${list}`,
          },
        ],
      })
    } catch (err) {
      await credits.refund(req.user.id, reservation, `provider error: ${err.message}`)
      return res.status(502).json({ code: 'ai_unavailable', error: err.friendly || 'The assistant could not be reached just now. Your credits were not used.', refunded: true })
    }
    if (raw == null) {
      await credits.refund(req.user.id, reservation, 'no provider configured')
      return res.status(503).json({ code: 'ai_unavailable', error: 'AI is not configured on this server. Your credits were not used.', refunded: true })
    }
    const parsed = extractJson(raw)
    const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
    if (!parsed || !clean(parsed.summary, 800)) {
      await credits.refund(req.user.id, reservation, 'unusable output')
      return res.status(502).json({ code: 'ai_bad_output', error: "The assistant's answer couldn't be used this time. Your credits were not used — please try again.", refunded: true })
    }
    const cite = (Array.isArray(parsed.cite) ? parsed.cite : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= pool.length)
    res.json({
      digest: {
        summary: clean(parsed.summary, 800),
        why: clean(parsed.why, 400),
        actions: (Array.isArray(parsed.actions) ? parsed.actions : []).map((a) => clean(a, 200)).filter(Boolean).slice(0, 3),
        sources: [...new Set(cite)].map((n) => ({ title: pool[n - 1].title, url: pool[n - 1].url, source: pool[n - 1].source })),
        generatedAt: new Date().toISOString(),
      },
      creditsUsed: reservation.cost,
    })
  }),
)
