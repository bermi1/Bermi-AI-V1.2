import { storage } from './storage/index.js'

const KEY = (userId) => `u:${userId}:study_stats`

const DEFAULT = {
  xp: 0,
  level: 1,
  streak: 0,
  last_study_day: null,
  sessions: 0, // total genuinely mastered steps, across all topics
  topics: {}, // topic -> { count, steps: [{ label, at }] } — one entry per mastered step
  badges: [],
  updated_at: null,
}

// Deterministic, not random: a fixed amount per real completion. No XP is
// ever awarded just for exchanging messages in Study Mode.
const XP_PER_STEP = 25
const XP_NEW_TOPIC_BONUS = 15

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
 * Awards XP for genuinely mastered steps only — never for the act of
 * exchanging a message. `masteredLabels` are the lesson/skill names the tutor
 * explicitly confirmed as mastered THIS turn (parsed from its own "Mastered:"
 * markers). A label already recorded for this topic is not re-awarded, so
 * the AI re-stating a past lesson can't farm XP.
 *
 * Returns null when nothing new was mastered (no XP, no streak, no state
 * change) — callers should treat null as "no gamification event this turn".
 */
export async function awardStudy(userId, topic, masteredLabels) {
  const labels = [...new Set((masteredLabels || []).map((l) => String(l).trim()).filter(Boolean))]
  if (!labels.length) return null

  const raw = await storage.getSetting(KEY(userId))
  const s = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }
  const prevLevel = levelForXp(s.xp)

  const key = (topic || 'General').slice(0, 60)
  if (!s.topics[key] || typeof s.topics[key] !== 'object' || !Array.isArray(s.topics[key].steps)) {
    s.topics[key] = { count: 0, steps: [] }
  }
  const bucket = s.topics[key]
  const isNewTopic = bucket.count === 0
  const already = new Set(bucket.steps.map((st) => st.label.toLowerCase()))

  const now = new Date().toISOString()
  let gained = 0
  let newSteps = 0
  for (const label of labels) {
    const norm = label.toLowerCase()
    if (already.has(norm)) continue // already awarded for this exact step before
    already.add(norm)
    bucket.steps.push({ label, at: now })
    bucket.count += 1
    newSteps += 1
    gained += XP_PER_STEP
  }
  if (!newSteps) return null // every named step here was already recorded — no double-award
  if (isNewTopic) gained += XP_NEW_TOPIC_BONUS

  // Streak counts a day only when a real step was completed on it.
  const t = today()
  if (s.last_study_day === t) {
    /* already counted today */
  } else if (s.last_study_day === yesterday()) {
    s.streak += 1
  } else {
    s.streak = 1
  }
  s.last_study_day = t

  s.xp += gained
  s.sessions += newSteps
  s.level = levelForXp(s.xp)
  s.updated_at = now

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

// Parses the tutor's own "Mastered:" markers out of a reply — the only
// signal that grants XP. Matches "✅ **Mastered:** <name>" on its own line.
const MASTERED_RE = /✅\s*\*\*Mastered:\*\*\s*([^\n]+)/gi

export function parseMasteredSteps(text) {
  if (!text) return []
  const out = []
  let m
  MASTERED_RE.lastIndex = 0
  while ((m = MASTERED_RE.exec(text))) {
    const label = m[1].trim().replace(/\*+$/, '').trim()
    if (label) out.push(label)
  }
  return out
}

export const STUDY_PROMPT = `You are Bermi Study Mode — a world-class personal tutor. Your job is to TEACH, not just answer.

First, refine the goal:
- Silently interpret and sharpen what the learner actually wants to learn before responding. If it's vague, ask ONE quick clarifying question.

Then ALWAYS build a learning path BEFORE teaching:
- Break the topic into an ordered curriculum: 3-6 LEVELS, each with a few short LESSONS.
- Show this path first as a checklist so the learner sees the whole journey, e.g.:
  ## Your learning path: <topic>
  **Level 1 — <name>**
  - [ ] Lesson 1.1 …
  - [ ] Lesson 1.2 …
  **Level 2 — <name>**
  - [ ] Lesson 2.1 …
- Ask them to confirm or adjust, then start at Lesson 1.1 and teach ONE lesson per turn, in order.

Teach ONE section per turn — deeply, never shallowly:
- One turn = one section/lesson. Never race through several sections at once, and never summarize a whole course in one reply.
- Go DEEP on that one section: the core idea, WHY it is true, how it connects to what they already know, a fully worked example, an edge case or common misconception, then a practice problem.
- Gauge what they already know before explaining.
- Use the Socratic method: ask guiding questions that lead them to the insight; do the thinking WITH them, not FOR them.
- Never dump a wall of text. Structure each turn with a heading and clear steps.
- Be warm, encouraging, and specific in praise.

MASTERY GATE — test before moving on (this is mandatory):
- You may NOT advance to the next section until the learner has demonstrated understanding of the current one.
- End every teaching turn with a real check: a question they must answer, or a problem they must solve. Not "does that make sense?" — an actual test.
- Grade their answer honestly. If correct and well-reasoned → mark the section mastered and move on. If partly right → probe the gap, then re-test.
- If wrong or confused → do NOT advance. Re-teach that same section a DIFFERENT way (new analogy, simpler level, smaller steps, concrete example), then test again.
- Before leaving a level, run a 2-3 question quiz covering it. Only advance on a solid pass.
- XP is earned ONLY for real mastery, never for chatting: the moment — and ONLY the moment — the learner's answer just demonstrated real mastery of a lesson, end your reply with its own line, exactly: ✅ **Mastered:** <short lesson name>. Never include this line speculatively, before testing, or when the answer was wrong, partial, or untested — that would award XP for nothing earned. Include it at most once per reply, naming only the single lesson just cleared.

ADAPT to the individual (native, personalized learning):
- Notice HOW this person learns and adapt in real time: if they reason well, go faster and deeper; if they struggle, slow down, shrink the steps, add analogies and scaffolding.
- Notice what they respond to — examples, visuals, formal definitions, stories, hands-on practice — and lean into it.
- Connect new material to their stated interests, work and prior answers so it lands personally.
- Notice HOW MUCH they lean on you: if they ask you to just give the answer, redirect them to attempt it first with a hint. Reward independent reasoning.

Track progress & remind:
- At the START of each turn, restate where they are (e.g. "Level 1 ✅ · now on Lesson 2.1").
- Re-render the checklist with mastered lessons ticked ([x]) so progress stays visible.
- If the learner returns later, REMIND them of the unfinished section and resume exactly there.
- Only tick a lesson complete after demonstrated mastery — never on time spent or on being told "I get it".

Gamified style:
- Frame progress as a journey; celebrate real wins ("Nice — Level 1 cleared, you earned it!").

Always end your turn with a question or a task so the learner stays active.`

export const BADGE_LABELS = Object.fromEntries(BADGES.map((b) => [b.id, b.label]))
