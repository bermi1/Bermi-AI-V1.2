import { storage } from './storage/index.js'

const KEY = (userId) => `u:${userId}:study_stats`

const DEFAULT = {
  xp: 0,
  level: 1,
  streak: 0,
  last_study_day: null,
  sessions: 0,
  topics: {},
  badges: [],
  updated_at: null,
}

// Level curve: each level needs 100 XP. Simple and legible in the UI.
export function levelForXp(xp) {
  return Math.floor(xp / 100) + 1
}
export function xpIntoLevel(xp) {
  return xp % 100
}

const BADGES = [
  { id: 'first_lesson', label: 'First Lesson', test: (s) => s.sessions >= 1 },
  { id: 'streak_3', label: '3-Day Streak', test: (s) => s.streak >= 3 },
  { id: 'streak_7', label: '7-Day Streak', test: (s) => s.streak >= 7 },
  { id: 'streak_30', label: '30-Day Streak', test: (s) => s.streak >= 30 },
  { id: 'level_5', label: 'Level 5', test: (s) => s.level >= 5 },
  { id: 'level_10', label: 'Level 10', test: (s) => s.level >= 10 },
  { id: 'scholar', label: 'Scholar (10 topics)', test: (s) => Object.keys(s.topics).length >= 10 },
  { id: 'centurion', label: '500 XP', test: (s) => s.xp >= 500 },
  { id: 'marathon', label: '1000 XP', test: (s) => s.xp >= 1000 },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}
function yesterday() {
  return new Date(Date.now() - 86400e3).toISOString().slice(0, 10)
}

export async function getStudyStats(userId) {
  const raw = await storage.getSetting(KEY(userId))
  const stats = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }
  stats.level = levelForXp(stats.xp)
  stats.xp_into_level = xpIntoLevel(stats.xp)
  stats.xp_for_level = 100
  stats.topic_count = Object.keys(stats.topics).length
  return stats
}

/**
 * Awards XP for a completed study exchange and updates streaks, topics, and
 * badges. Returns { stats, gained, leveledUp, newBadges } for a celebratory UI.
 */
export async function awardStudy(userId, topic) {
  const raw = await storage.getSetting(KEY(userId))
  const s = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }

  const prevLevel = levelForXp(s.xp)
  const t = today()

  // Streak
  if (s.last_study_day === t) {
    /* already counted today */
  } else if (s.last_study_day === yesterday()) {
    s.streak += 1
  } else {
    s.streak = 1
  }
  s.last_study_day = t

  // Topic + XP
  let gained = 12
  const key = (topic || 'General').slice(0, 60)
  const isNewTopic = !s.topics[key]
  if (isNewTopic) gained += 8
  s.topics[key] = (s.topics[key] || 0) + 1
  s.xp += gained
  s.sessions += 1
  s.level = levelForXp(s.xp)
  s.updated_at = new Date().toISOString()

  // Badges
  const before = new Set(s.badges)
  const newBadges = []
  for (const b of BADGES) {
    if (!before.has(b.id) && b.test(s)) {
      s.badges.push(b.id)
      newBadges.push({ id: b.id, label: b.label })
    }
  }

  await storage.setSetting(KEY(userId), JSON.stringify(s))

  return {
    stats: await getStudyStats(userId),
    gained,
    leveledUp: s.level > prevLevel,
    newBadges,
  }
}

export const STUDY_PROMPT = `You are Bermi Study Mode — a world-class personal tutor. Your job is to TEACH, not just answer.

Teaching method:
- Start by gauging what the learner already knows; ask before you explain.
- Break every topic into small, ordered steps. Teach one step at a time.
- Use the Socratic method: ask guiding questions that lead the learner to the insight.
- Give a concrete worked example, then a short practice question they can try.
- Never dump a wall of text. Keep each turn focused and structured with a heading and clear steps.
- Check understanding before moving on. If they're stuck, re-explain more simply with an analogy.
- Be warm, encouraging, and specific in praise.

Gamified style:
- Frame progress as a journey. Celebrate wins ("Nice — you nailed that step!").
- After teaching a step, end with EITHER a check-for-understanding question OR a small practice task.
- Occasionally offer a "quick quiz" of 2-3 questions to lock in learning.
- Suggest the next challenge to keep momentum.

Always end your turn with a question or a task so the learner stays active. Do the thinking WITH them, not FOR them.`

export const BADGE_LABELS = Object.fromEntries(BADGES.map((b) => [b.id, b.label]))
