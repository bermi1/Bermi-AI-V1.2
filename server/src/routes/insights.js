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
    prompt_tips: [],
    skills: [],
    positive_traits: [],
    negative_traits: [],
    adaptation: '',
    summary:
      stats.userTurns === 0
        ? 'No conversations in this period yet. Start chatting and your insights will appear here.'
        : 'Not enough signal yet — keep chatting to build your report.',
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
          'You are Bermi Insights, a supportive coach that reviews a person\'s chat history with an AI ' +
          'assistant and produces an honest, encouraging wellbeing-and-productivity report — like a health app ' +
          'summary. Respond with ONLY a JSON object, no markdown, shaped exactly as:\n' +
          '{"productivity_pct":0-100,"dependency_pct":0-100,"prompt_quality_pct":0-100,' +
          '"prompt_tips":[string,string,string],"skills":[string,...],' +
          '"positive_traits":[{"trait":string,"note":string},{...},{...}],' +
          '"negative_traits":[{"trait":string,"note":string},{...},{...}],' +
          '"adaptation":string,"summary":string}\n' +
          'Guidance: productivity_pct = how goal-directed and useful the discussions are. ' +
          'dependency_pct = how much the person leans on the AI to think for them vs. using it as a tool ' +
          '(higher = more dependent, a caution). prompt_quality_pct = how clear, specific and well-structured ' +
          'their prompts are. prompt_tips = 3 concrete ways to write better prompts. skills = concrete skills or ' +
          'knowledge they appear to be building. Exactly 3 positive and 3 negative traits, each with a short kind note. ' +
          'adaptation = one sentence on how Bermi is tuning to their style. summary = 2 warm sentences. Be specific to the transcript.',
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
    return {
      ...base,
      productivity_pct: clampPct(parsed.productivity_pct),
      dependency_pct: clampPct(parsed.dependency_pct),
      prompt_quality_pct: clampPct(parsed.prompt_quality_pct),
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
