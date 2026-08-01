import { storage } from './storage/index.js'
import { complete } from './openrouter.js'
import { getStudyStats } from './study.js'

// Cross-conversation memory: a compact, running summary of who this person
// is and what they care about, carried into EVERY conversation — not just
// the one it was learned in. Without this, each new chat starts from zero;
// with it, Bermi genuinely remembers past conversations.

const memoryKey = (userId) => `u:${userId}:memory`
const MAX_MEMORY_CHARS = 4000
// Skip trivial turns ("ok", "thanks", "hi") — not worth a model call or
// worth diluting the memory with noise.
const MIN_MESSAGE_LENGTH = 12

export async function getMemory(userId) {
  return (await storage.getSetting(memoryKey(userId))) || ''
}

/**
 * Fire-and-forget: folds one exchange into the user's persistent memory.
 * Never throws — a memory-update failure must never affect the chat response
 * that already went out to the user.
 */
export function remember(userId, userMessage, assistantMessage) {
  if (!userMessage || userMessage.trim().length < MIN_MESSAGE_LENGTH) return
  ;(async () => {
    try {
      const current = await getMemory(userId)
      const raw = await complete({
        model: 'bermi-fast',
        maxTokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'You maintain a compact, persistent memory of one person across all their conversations with an ' +
              'AI assistant — their interests, goals, ongoing projects, preferences, recurring context, and ' +
              'important facts they have shared. Given the CURRENT MEMORY and the LATEST EXCHANGE, output the ' +
              'UPDATED memory: merge in anything new and durable, quietly drop anything stale, trivial, or ' +
              'no longer relevant, and never just append. Keep it under 400 words, written as plain factual ' +
              'notes (not a letter). Output ONLY the updated memory text, nothing else. If the exchange has ' +
              'nothing worth remembering long-term, output the current memory unchanged.',
          },
          {
            role: 'user',
            content:
              `Current memory:\n${current || '(empty — nothing remembered yet)'}\n\n` +
              `Latest exchange:\nUser: ${userMessage.slice(0, 2000)}\nAssistant: ${(assistantMessage || '').slice(0, 2000)}`,
          },
        ],
      })
      const updated = (raw || '').trim().slice(0, MAX_MEMORY_CHARS)
      if (updated) await storage.setSetting(memoryKey(userId), updated)
    } catch {
      /* best-effort — never surfaces to the user */
    }
  })()
}

// "Hyper memory": the per-exchange merge above only ever sees ONE message at
// a time, so it can miss the bigger picture — what someone is actually
// learning, how far they've gotten, what they've mastered. At most once
// every 24h, fold in a snapshot of their broader learning activity (enrolled
// courses, real mastered topics, level/streak) so the profile stays current
// with what Bermi has genuinely learned about them lately, not just chat
// small talk. Self-paced by a stored timestamp rather than a cron job, since
// it only needs to happen the next time an active user shows up anyway.
const deepConsolidationKey = (userId) => `u:${userId}:memory_deep_at`
const DEEP_CONSOLIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000

export function maybeDeepConsolidate(userId) {
  ;(async () => {
    try {
      const lastRaw = await storage.getSetting(deepConsolidationKey(userId))
      const last = lastRaw ? Number(lastRaw) : 0
      if (Date.now() - last < DEEP_CONSOLIDATION_INTERVAL_MS) return
      // Claim the slot immediately so concurrent requests from the same user
      // can't both trigger a run before this one finishes.
      await storage.setSetting(deepConsolidationKey(userId), String(Date.now()))

      const [current, stats, enrollments] = await Promise.all([
        getMemory(userId),
        getStudyStats(userId),
        storage.listEnrollmentsByUser(userId),
      ])

      const courseLines = []
      for (const e of enrollments.slice(0, 20)) {
        const course = await storage.getCourse(e.course_id)
        if (course) courseLines.push(`- "${course.title}": ${e.status}${e.score != null ? `, avg ${e.score}%` : ''}`)
      }
      const topicLines = Object.entries(stats.topics || {})
        .slice(0, 15)
        .map(([topic, t]) => `- ${topic}: ${t.count} step(s) mastered`)

      if (!courseLines.length && !topicLines.length) return // nothing new to fold in

      const raw = await complete({
        model: 'bermi-fast',
        maxTokens: 900,
        messages: [
          {
            role: 'system',
            content:
              'You maintain a persistent, evolving profile of one person across everything they do in this app — ' +
              'not just chat, but their learning activity too. Given the CURRENT PROFILE and a snapshot of their ' +
              'recent learning activity, output an UPDATED profile: fold in durable new patterns (what they are ' +
              'learning, how far they have gotten, what they have genuinely mastered, how they learn), quietly ' +
              'drop anything stale or superseded, and never just append. Plain factual notes, under 450 words. ' +
              'Output ONLY the updated profile text. If nothing here changes the picture, output the current ' +
              'profile unchanged.',
          },
          {
            role: 'user',
            content:
              `Current profile:\n${current || '(empty — nothing remembered yet)'}\n\n` +
              `Learning snapshot:\nLevel ${stats.level}, ${stats.xp} XP, ${stats.streak}-day streak.\n\n` +
              `Enrolled courses:\n${courseLines.join('\n') || '(none)'}\n\n` +
              `Recently mastered:\n${topicLines.join('\n') || '(none)'}`,
          },
        ],
      })
      const updated = (raw || '').trim().slice(0, MAX_MEMORY_CHARS)
      if (updated) await storage.setSetting(memoryKey(userId), updated)
    } catch {
      /* best-effort — never surfaces to the user */
    }
  })()
}
