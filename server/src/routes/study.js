import { Router } from 'express'
import { getStudyStats, BADGE_LABELS } from '../study.js'

export const studyStatsRouter = Router()

studyStatsRouter.get('/study/stats', async (req, res, next) => {
  try {
    const stats = await getStudyStats(req.user.id)
    res.json({
      ...stats,
      badge_labels: BADGE_LABELS,
      badges_detailed: stats.badges.map((id) => ({ id, label: BADGE_LABELS[id] || id })),
      topic_list: Object.entries(stats.topics)
        .map(([topic, v]) => ({
          topic,
          count: typeof v === 'object' ? v.count : v,
          steps: typeof v === 'object' ? v.steps.map((s) => s.label) : [],
        }))
        .sort((a, b) => b.count - a.count),
    })
  } catch (err) {
    next(err)
  }
})
