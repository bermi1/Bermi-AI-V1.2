import { randomBytes } from 'node:crypto'
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

// Parses the assistant's own completion markers out of a reply — the only
// signal that grants XP or records step progress. Matches "✅ **Mastered:**"
// (courses, mastery-gated), "✅ **Completed:**" (programs/resources, a
// lighter self-report confirmation) or "✅ **Done:**" on its own line — same
// mechanism, wording that fits what's actually being tracked.
const MASTERED_RE = /✅\s*\*\*(?:Mastered|Completed|Done):\*\*\s*([^\n]+)/gi

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

MASTERY GATE — test before moving on (this is mandatory, non-negotiable):
- You may NOT advance to the next section until the learner has demonstrated REAL understanding of the current one — not politeness, not their own self-report of "I get it", not time spent talking about it.
- If a curriculum/progress checklist is given to you in context below, teach and test lessons STRICTLY in the order shown. If the learner asks to skip ahead or jump to a later lesson/step, decline directly and explain lessons must be cleared in order — then continue with the actual next lesson, not the one they asked for. Never invent a shortcut around this.
- End every teaching turn with a real check: a question they must answer, or a problem they must solve. Not "does that make sense?" — an actual test.
- Grade their answer HONESTLY, never generously: if it is wrong, incomplete, or just a lucky guess, say so plainly and explain exactly what is missing or incorrect — do not soften a wrong answer into "close!" or "good effort!" if it is not actually close or good. If correct and well-reasoned → say so plainly, mark the section mastered, and move on. If partly right → name precisely what part is right and what part is not, probe the gap, then re-test.
- If wrong or confused → do NOT advance, no matter how many times it takes. Re-teach that same section a DIFFERENT way (new analogy, simpler level, smaller steps, concrete example), then test again. Never advance out of politeness, sympathy, or to keep the conversation moving.
- Before leaving a level, run a 2-3 question quiz covering it. Only advance on a solid pass — grade that quiz with the same honesty as above.
- XP is earned ONLY for real, verified mastery, never for chatting, trying, or asking good questions: the moment — and ONLY the moment — the learner's answer just demonstrated real mastery of a lesson, end your reply with its own line, exactly: ✅ **Mastered:** <short lesson name>. Never include this line speculatively, before testing, when the answer was wrong or partial, or as encouragement — that would award XP and unlock the next lesson for nothing actually earned, which defeats the entire point of gating. Include it at most once per reply, naming only the single lesson just cleared.

TEACH FOR REAL DEPTH, NOT SURFACE COVERAGE:
- "Covered it" and "understands it" are different things — always aim for the second. Do not settle for a definition-level pass when the topic supports (and the learner can handle) genuine depth: the underlying mechanism, why it works, where it breaks down, how it connects to adjacent ideas, and how it is actually used in practice.
- Prefer one lesson taught to real, checkable understanding over five lessons skimmed. If a learner is breezing through, raise the bar — harder questions, less scaffolding, edge cases — rather than just moving faster through the same shallow level.
- Be realistic, not motivational filler: if a topic is genuinely hard, say so and explain why, instead of implying it is easy to sound encouraging. Realistic confidence, built on things they actually proved they can do, beats false confidence every time.

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

NEVER FABRICATE MEDIA OR SOURCES:
- Do not mention, describe, reference, or offer a video ("as shown in this video", "watch this clip", "check out this video") unless an actual video_url for the exact current lesson is explicitly given to you in context below. Most lessons — especially any self-built/AI-generated course — have no video at all, and that is completely normal; never invent one or imply one exists.
- The same goes for any other source, link, image, or reference you were not actually given: never invent a citation, URL, or "as seen in..." reference. If you don't have a real one, teach from what you actually know instead of gesturing at a source that doesn't exist.

Always end your turn with a question or a task so the learner stays active.`

export const BADGE_LABELS = Object.fromEntries(BADGES.map((b) => [b.id, b.label]))

// ---------------------------------------------------------------------------
// Real evaluation, not just "moved on": marking a structured lesson complete
// (score + progress + certificate) lives here, shared by the explicit
// /learn/lessons/:id/complete endpoint AND the Study Mode chat bridge below —
// one honest completion path instead of two.
// ---------------------------------------------------------------------------

// A course lesson is unlocked when it's the first lesson, or the lesson
// immediately before it (by ordinal) is already marked done. Programs,
// events, and resources aren't gated this strictly by the AI's own
// judgement — but working through them in order is still the sane default,
// so the same rule applies to every kind.
export function findLockedBy(orderedLessons, progress, lessonId) {
  const idx = orderedLessons.findIndex((l) => l.id === lessonId)
  if (idx <= 0) return null
  const prev = orderedLessons[idx - 1]
  return progress?.[prev.id]?.done ? null : prev
}

export async function isLessonUnlocked(lesson, enrollment) {
  const lessons = await storage.listLessons(lesson.course_id)
  const ordered = [...lessons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
  const blocker = findLockedBy(ordered, enrollment.progress || {}, lesson.id)
  return { unlocked: !blocker, blockingLesson: blocker }
}

// The minimum quiz score (%) needed to pass a COURSE lesson and unlock the
// next one. Programs/events/resources aren't graded this way — a plain
// confirmation is enough for those, per their own design (see learn.js).
export const QUIZ_PASS_THRESHOLD = 70

/**
 * Marks a lesson complete. Returns:
 * - null: no such lesson, or the user isn't enrolled in its course.
 * - { locked: true, blockingLesson }: an earlier lesson isn't done yet —
 *   completion refused, nothing changed.
 * - { failed: true, score, threshold }: a COURSE lesson's quiz score came in
 *   under the pass threshold — refused, nothing changed, learner can retake.
 * - { enrollment, certificate }: success (certificate is null unless this
 *   was the course's last lesson).
 */
export async function applyLessonCompletion(user, lessonId, score) {
  const lesson = await storage.getLesson(lessonId)
  if (!lesson) return null
  const enrollment = await storage.getEnrollment(lesson.course_id, user.id)
  if (!enrollment) return null
  if (enrollment.progress?.[lessonId]?.done) return { enrollment, certificate: null }

  const lessons = await storage.listLessons(lesson.course_id)
  const ordered = [...lessons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
  const blocker = findLockedBy(ordered, enrollment.progress || {}, lessonId)
  if (blocker) return { locked: true, blockingLesson: blocker }

  const course = await storage.getCourse(lesson.course_id)
  if ((course?.kind || 'course') === 'course' && typeof score === 'number' && score < QUIZ_PASS_THRESHOLD) {
    return { failed: true, score: Math.round(score), threshold: QUIZ_PASS_THRESHOLD }
  }

  const progress = { ...(enrollment.progress || {}) }
  progress[lessonId] = { done: true, score: typeof score === 'number' ? Math.round(score) : undefined }

  const allDone = lessons.length > 0 && lessons.every((l) => progress[l.id]?.done)
  const scores = lessons.map((l) => progress[l.id]?.score).filter((s) => typeof s === 'number')
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const patch = { status: allDone ? 'completed' : 'enrolled', progress, score: avg }
  if (allDone) patch.completed_at = new Date().toISOString()
  const updated = await storage.updateEnrollment(enrollment.id, patch)

  let certificate = null
  if (allDone) {
    const course = await storage.getCourse(lesson.course_id)
    const inst = await storage.getInstitution(course.institution_id)
    const code = 'BC-' + randomBytes(5).toString('hex').toUpperCase()
    certificate = await storage.createCertificate({
      code,
      course_id: course.id,
      user_id: user.id,
      learner_name: user.name,
      course_title: course.title,
      institution_name: inst?.name || 'Bermi',
      score: avg,
      issued_at: new Date().toISOString(),
    })
  }
  return { enrollment: updated, certificate }
}

const normalizeTitle = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// How confidently a mastered-step label (the tutor's own free text) names a
// specific stored lesson title. Direct containment is a strong signal;
// otherwise fall back to how much of the shorter title's meaningful words
// appear in the other.
export function titleSimilarity(a, b) {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const wa = new Set(na.split(' ').filter((w) => w.length > 2))
  const wb = new Set(nb.split(' ').filter((w) => w.length > 2))
  if (!wa.size || !wb.size) return 0
  let overlap = 0
  for (const w of wa) if (wb.has(w)) overlap++
  return overlap / Math.min(wa.size, wb.size)
}

/**
 * Bridges Study Mode's freeform mastery signal into the structured
 * enrollment/lesson records that power "My learning", institution analytics,
 * and certificates — so progress shown there reflects lessons the learner
 * actually demonstrated understanding of in chat, not just conversation
 * turns going by.
 *
 * Two tiers, in order:
 * 1. Exact/near-exact match — when the tutor is following an enrolled
 *    course's real curriculum (chat.js feeds it the actual lesson titles for
 *    exactly this reason), its "Mastered:" label should name a lesson title
 *    almost verbatim. Match against ANY active enrollment.
 * 2. Sequential fallback — for the ONE enrolled course whose title clearly
 *    matches this conversation's own topic, advance its next not-yet-done
 *    lesson. Covers looser phrasing without guessing at the wrong course.
 * No confident course match at all → left alone rather than guessed at.
 */
export async function syncLessonProgress(user, topicTitle, masteredLabels) {
  if (!masteredLabels?.length) return
  try {
    const enrollments = (await storage.listEnrollmentsByUser(user.id)).filter((e) => e.status !== 'completed')
    if (!enrollments.length) return

    const withCourses = []
    for (const enr of enrollments) {
      const course = await storage.getCourse(enr.course_id)
      if (course) withCourses.push({ enr, course, lessons: await storage.listLessons(course.id) })
    }
    if (!withCourses.length) return

    for (const label of masteredLabels) {
      // Tier 1: exact/near-exact lesson-title match, any active enrollment.
      let best = null
      for (const entry of withCourses) {
        for (const lesson of entry.lessons) {
          if (entry.enr.progress?.[lesson.id]?.done) continue
          const sim = titleSimilarity(label, lesson.title)
          if (sim >= 0.8 && (!best || sim > best.sim)) best = { entry, lesson, sim }
        }
      }
      if (best) {
        const result = await applyLessonCompletion(user, best.lesson.id, 100)
        // A locked result here means the tutor's own "Mastered:" label named
        // a lesson out of order (e.g. matched lesson 5 while 1-4 aren't done)
        // — refused by design, so just leave progress as-is rather than
        // recording something the learner hasn't actually earned in order.
        if (result?.enrollment) best.entry.enr = result.enrollment // keep in-memory progress fresh for later labels
        continue
      }

      // Tier 2: the course this conversation is clearly about, advanced by one.
      const ranked = [...withCourses].sort(
        (a, b) => titleSimilarity(topicTitle, b.course.title) - titleSimilarity(topicTitle, a.course.title),
      )
      const top = ranked[0]
      if (top && titleSimilarity(topicTitle, top.course.title) >= 0.4) {
        const next = top.lessons
          .slice()
          .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
          .find((l) => !top.enr.progress?.[l.id]?.done)
        if (next) {
          const result = await applyLessonCompletion(user, next.id, 100)
          if (result?.enrollment) top.enr = result.enrollment
        }
      }
    }
  } catch {
    /* best-effort — a sync miss must never affect the chat response */
  }
}
