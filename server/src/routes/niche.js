import { Router } from 'express'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'

export const nicheRouter = Router()

const MODEL = process.env.NICHE_MODEL || 'bermi-core'

// The guided discovery questionnaire (client renders these).
export const NICHE_QUESTIONS = [
  { id: 'passions', q: 'What topics or activities genuinely energize you? (list a few)' },
  { id: 'skills', q: 'What are you good at, or want to get good at?' },
  { id: 'audience', q: 'Who do you most want to help or reach?' },
  { id: 'problems', q: 'What problems do you love solving?' },
  { id: 'format', q: 'How do you like to create or work? (writing, video, building, coaching, events…)' },
  { id: 'goal', q: 'What outcome would make this worthwhile in a year? (income, impact, freedom…)' },
]

const key = (userId) => `u:${userId}:niche_report`

nicheRouter.get('/niche/questions', (_req, res) => {
  res.json({ questions: NICHE_QUESTIONS })
})

nicheRouter.get('/niche', async (req, res, next) => {
  try {
    const cached = await storage.getSetting(key(req.user.id))
    res.json({ report: cached ? JSON.parse(cached) : null })
  } catch (err) {
    next(err)
  }
})

nicheRouter.post('/niche/discover', async (req, res, next) => {
  try {
    const answers = req.body?.answers ?? {}
    const filled = NICHE_QUESTIONS.map((q) => `${q.q}\n> ${answers[q.id] || '(skipped)'}`).join('\n\n')

    const raw = await complete({
      model: MODEL,
      maxTokens: 1600,
      messages: [
        {
          role: 'system',
          content:
            'You are Bermi Niche Coach. From the answers, define a focused, viable niche and a practical ' +
            'plan. Respond with ONLY JSON, no markdown, shaped as: {"niche":string,"tagline":string,' +
            '"why_you":string,"audience":string,"positioning":string,' +
            '"content_pillars":[string,string,string,string],' +
            '"first_moves":[string,string,string,string,string],' +
            '"skills_to_build":[string,...],"monetization":[string,...],' +
            '"self_improvement":[string,string,string],"ninety_day_goal":string}. ' +
            'Be specific and encouraging; pick ONE clear niche rather than hedging.',
        },
        { role: 'user', content: filled },
      ],
    })

    let report
    try {
      report = JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''))
    } catch {
      report = {
        niche: 'Your focus area',
        tagline: 'A clear direction to build on',
        why_you: 'Based on your answers, lean into what energizes you and what you can help others with.',
        audience: answers.audience || 'People you want to help',
        positioning: '',
        content_pillars: [],
        first_moves: [],
        skills_to_build: [],
        monetization: [],
        self_improvement: [],
        ninety_day_goal: answers.goal || '',
      }
    }
    report.generated_at = new Date().toISOString()
    await storage.setSetting(key(req.user.id), JSON.stringify(report))

    // Also seed a knowledge base so Bermi remembers the user's niche in chat.
    try {
      const md =
        `# My niche: ${report.niche}\n\n${report.tagline}\n\n` +
        `**Audience:** ${report.audience}\n\n**Positioning:** ${report.positioning}\n\n` +
        `**Content pillars:** ${(report.content_pillars || []).join(', ')}\n\n` +
        `**90-day goal:** ${report.ninety_day_goal}`
      await storage.upsertBrain(req.user.id, {
        id: 'niche',
        name: 'My Niche',
        content: md,
        enabled: true,
        updated_at: new Date().toISOString(),
      })
    } catch {
      /* non-fatal */
    }

    res.json({ report })
  } catch (err) {
    next(err)
  }
})
