import { storage } from './storage/index.js'
import { complete } from './openrouter.js'

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
