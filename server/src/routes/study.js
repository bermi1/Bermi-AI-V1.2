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
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, count })),
    })
  } catch (err) {
    next(err)
  }
})
