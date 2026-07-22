import { storage } from './storage/index.js'
import { resolveModelChain } from './models.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * The key never leaves the server: it is read from the environment or the
 * server-side settings store, and only a masked hint is ever sent to clients.
 */
export async function resolveApiKey() {
  // Managed key model: the platform's env key powers all users. A key stored
  // via the legacy settings path still works as a fallback.
  if (process.env.OPENROUTER_API_KEY) {
    return { key: process.env.OPENROUTER_API_KEY, source: 'env' }
  }
  const stored = await storage.getSetting('openrouter_api_key')
  if (stored) return { key: stored, source: 'settings' }
  return { key: null, source: null }
}

export async function apiKeyInfo() {
  const { key, source } = await resolveApiKey()
  return {
    hasApiKey: Boolean(key),
    apiKeySource: source,
    apiKeyHint: key ? `…${key.slice(-4)}` : null,
  }
}

function headers(key) {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://bermi.ai',
    'X-Title': 'Bermi AI',
  }
}

async function errorDetail(res) {
  const fallback = `OpenRouter error (${res.status})`
  try {
    const text = (await res.text()).slice(0, 300)
    try {
      return JSON.parse(text).error?.message || fallback
    } catch {
      return text ? `${fallback}: ${text}` : fallback
    }
  } catch {
    return fallback
  }
}

/**
 * Streaming chat completion. Returns the raw Response so callers can pipe
 * the SSE body. Throws with a readable message on non-2xx.
 */
export async function streamCompletion({ model, messages, signal, web = false }) {
  const { key } = await resolveApiKey()
  if (!key) {
    const err = new Error(
      'No OpenRouter API key configured. Add one in Settings or set OPENROUTER_API_KEY on the server.',
    )
    err.status = 401
    throw err
  }
  // A Bermi model resolves to a free-first fallback chain; try each until one
  // is available (free models are frequently rate-limited or rotated).
  const chain = await resolveModelChain(model)
  // Web search: OpenRouter's web plugin grounds the answer in live internet
  // results and returns url citations.
  const plugins = web ? [{ id: 'web', max_results: 5 }] : undefined
  let lastErr
  for (const realModel of chain) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ model: realModel, messages, stream: true, plugins }),
      signal,
    })
    if (res.ok) return res
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    // 400/404 = model unavailable, 429 = rate limited → try the next.
    if (![400, 404, 429, 502, 503].includes(res.status)) break
  }
  throw lastErr ?? new Error('No model available')
}

/**
 * Non-streaming completion, used for structured tasks like invoice drafting.
 * Returns the assistant message content as a string, or null when no key is
 * configured (callers fall back to deterministic output).
 */
export async function complete({ model, messages, maxTokens = 1024 }) {
  const { key } = await resolveApiKey()
  if (!key) return null
  const chain = await resolveModelChain(model)
  let lastErr
  for (const realModel of chain) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ model: realModel, messages, max_tokens: maxTokens }),
    })
    if (res.ok) {
      const body = await res.json()
      return body.choices?.[0]?.message?.content ?? null
    }
    lastErr = new Error(await errorDetail(res))
    if (![400, 404, 429, 502, 503].includes(res.status)) break
  }
  throw lastErr ?? new Error('No model available')
}

/** Live model listing from OpenRouter, used to augment the configured list. */
export async function fetchLiveModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(await errorDetail(res))
  const body = await res.json()
  return body.data ?? []
}
