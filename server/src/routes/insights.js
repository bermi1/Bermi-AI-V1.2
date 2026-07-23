import { Router } from 'express'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'

export const insightsRouter = Router()

const MODEL = process.env.INSIGHTS_MODEL || 'bermi-core'

/**
 * Gathers the user's recent messages within a period and returns a compact
 * transcript sample for analysis. We keep user + assistant turns but cap size.
 */
async function collectTranscript(userId, sinceMs) {
  const conversations = await storage.listConversations(userId)
  const recent = conversations.filter(
    (c) => new Date(c.updated_at).getTime() >= sinceMs,
  )
  let userTurns = 0
  let assistantTurns = 0
  const chunks = []
  let budget = 16000
  for (const conv of recent.slice(0, 25)) {
    const msgs = await storage.listMessages(conv.id)
    for (const m of msgs) {
      if (m.role === 'user') userTurns++
      else assistantTurns++
      if (budget > 0) {
        const line = `${m.role === 'user' ? 'USER' : 'AI'}: ${m.content.slice(0, 600)}`
        chunks.push(line)
        budget -= line.length
      }
    }
  }
  return { transcript: chunks.join('\n'), userTurns, assistantTurns, conversations: recent.length }
}

// Wellbeing "vitals" — a health-app style panel. Each has a polarity so the UI
// can color it: for some, higher is healthier; for others (brain rot,
// dependency) higher is a concern.
const VITAL_META = {
  emotional_balance: { label: 'Emotional balance', goodHigh: true },
  focus: { label: 'Focus & depth', goodHigh: true },
  growth: { label: 'Growth & learning', goodHigh: true },
  healthy_usage: { label: 'Healthy usage', goodHigh: true },
  dependency: { label: 'AI dependency', goodHigh: false },
  brain_rot: { label: 'Brain-rot risk', goodHigh: false },
}
const VITAL_ORDER = ['emotional_balance', 'focus', 'growth', 'healthy_usage', 'dependency', 'brain_rot']

const vitalStatus = (score, goodHigh) => {
  const eff = goodHigh ? score : 100 - score
  return eff >= 67 ? 'good' : eff >= 34 ? 'watch' : 'high'
}

function buildVitals(parsed) {
  const src = {}
  if (Array.isArray(parsed.vitals)) for (const v of parsed.vitals) if (v && v.id) src[v.id] = v
  return VITAL_ORDER.map((id) => {
    const meta = VITAL_META[id]
    const v = src[id] || {}
    const score = Math.max(0, Math.min(100, Math.round(Number(v.score) || 0)))
    return {
      id,
      label: meta.label,
      score,
      good_high: meta.goodHigh,
      status: vitalStatus(score, meta.goodHigh),
      note: String(v.note || ''),
    }
  })
}

function emptyReport(period, stats) {
  return {
    period,
    generated_at: new Date().toISOString(),
    conversations: stats.conversations,
    user_turns: stats.userTurns,
    assistant_turns: stats.assistantTurns,
    productivity_pct: 0,
    dependency_pct: 0,
    prompt_quality_pct: 0,
    wellbeing_pct: 0,
    emotion: { label: '—', score: 0, note: '' },
    vitals: [],
    recommendations: [],
    prompt_tips: [],
    skills: [],
    positive_traits: [],
    negative_traits: [],
    adaptation: '',
    summary:
      stats.userTurns === 0
        ? 'No conversations in this period yet. Start chatting and your check-in will appear here.'
        : 'Not enough signal yet — keep chatting to build your check-in.',
  }
}

async function analyze(period, stats) {
  if (!stats.transcript.trim() || stats.userTurns < 2) {
    return emptyReport(period, stats)
  }
  const raw = await complete({
    model: MODEL,
    maxTokens: 1400,
    messages: [
      {
        role: 'system',
        content:
          'You are Bermi Health, a warm, non-judgmental wellbeing companion — like a mental-health / screen-time ' +
          'app — that reviews how a person uses an AI assistant and reflects it back kindly. You are a mirror, not a ' +
          'doctor: never diagnose, never alarm, always be gentle and practical. Respond with ONLY a JSON object, no ' +
          'markdown, shaped exactly as:\n' +
          '{"productivity_pct":0-100,"dependency_pct":0-100,"prompt_quality_pct":0-100,"wellbeing_pct":0-100,' +
          '"emotion":{"label":string,"score":0-100,"note":string},' +
          '"vitals":[{"id":"emotional_balance","score":0-100,"note":string},{"id":"focus","score":0-100,"note":string},' +
          '{"id":"growth","score":0-100,"note":string},{"id":"healthy_usage","score":0-100,"note":string},' +
          '{"id":"dependency","score":0-100,"note":string},{"id":"brain_rot","score":0-100,"note":string}],' +
          '"recommendations":[string,string,string],"prompt_tips":[string,string,string],"skills":[string,...],' +
          '"positive_traits":[{"trait":string,"note":string},{...},{...}],' +
          '"negative_traits":[{"trait":string,"note":string},{...},{...}],' +
          '"adaptation":string,"summary":string}\n' +
          'Guidance for the health vitals (each 0-100 with a short kind note):\n' +
          '- emotional_balance: how steady, calm and positive their emotional tone reads (higher = healthier).\n' +
          '- focus: depth and intentionality of their sessions vs. scattered (higher = healthier).\n' +
          '- growth: how much they are learning and building real skills (higher = healthier).\n' +
          '- healthy_usage: balanced, purposeful use rather than compulsive over-use (higher = healthier).\n' +
          '- dependency: over-reliance on AI to think for them (higher = MORE concern).\n' +
          '- brain_rot: shallow, mindless, doom-scroll-style or low-value use (higher = MORE concern).\n' +
          'emotion.label = one or two words for their overall mood (e.g. "Motivated", "Stressed", "Curious"); ' +
          'emotion.score = positivity 0-100. wellbeing_pct = overall healthy-use score. ' +
          'recommendations = 3 concrete, caring suggestions to improve mental wellbeing and healthy AI use. ' +
          'prompt_tips = 3 concrete ways to write better prompts. skills = concrete skills they are building. ' +
          'Exactly 3 positive and 3 negative traits, each with a short kind note. adaptation = one sentence on how ' +
          'Bermi is tuning to their style. summary = 2 warm, encouraging sentences. Be specific to the transcript.',
      },
      {
        role: 'user',
        content: `Period: ${period}. Conversations: ${stats.conversations}, your messages: ${stats.userTurns}.\n\nTRANSCRIPT SAMPLE:\n${stats.transcript}`,
      },
    ],
  })

  const base = emptyReport(period, stats)
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''))
    const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
    const traits = (arr) =>
      Array.isArray(arr)
        ? arr.slice(0, 3).map((t) => ({ trait: String(t.trait || ''), note: String(t.note || '') }))
        : []
    const emotion = parsed.emotion && typeof parsed.emotion === 'object' ? parsed.emotion : {}
    return {
      ...base,
      productivity_pct: clampPct(parsed.productivity_pct),
      dependency_pct: clampPct(parsed.dependency_pct),
      prompt_quality_pct: clampPct(parsed.prompt_quality_pct),
      wellbeing_pct: clampPct(parsed.wellbeing_pct),
      emotion: {
        label: String(emotion.label || '—').slice(0, 24),
        score: clampPct(emotion.score),
        note: String(emotion.note || ''),
      },
      vitals: buildVitals(parsed),
      recommendations: (parsed.recommendations || []).slice(0, 5).map(String),
      prompt_tips: (parsed.prompt_tips || []).slice(0, 5).map(String),
      skills: (parsed.skills || []).slice(0, 8).map(String),
      positive_traits: traits(parsed.positive_traits),
      negative_traits: traits(parsed.negative_traits),
      adaptation: String(parsed.adaptation || ''),
      summary: String(parsed.summary || base.summary),
    }
  } catch {
    return base
  }
}

const cacheKey = (userId, period) => `u:${userId}:insights_${period}`

insightsRouter.get('/insights', async (req, res, next) => {
  try {
    const period = req.query.period === 'day' ? 'day' : 'week'
    const cached = await storage.getSetting(cacheKey(req.user.id, period))
    res.json({ report: cached ? JSON.parse(cached) : null })
  } catch (err) {
    next(err)
  }
})

insightsRouter.post('/insights/refresh', async (req, res, next) => {
  try {
    const period = req.body?.period === 'day' ? 'day' : 'week'
    const windowMs = period === 'day' ? 24 * 3600e3 : 7 * 24 * 3600e3
    const stats = await collectTranscript(req.user.id, Date.now() - windowMs)
    const report = await analyze(period, stats)
    await storage.setSetting(cacheKey(req.user.id, period), JSON.stringify(report))
    res.json({ report })
  } catch (err) {
    next(err)
  }
})
