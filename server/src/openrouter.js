import { resolveModelChain } from './models.js'
import { listProviders } from './providers.js'

const KNOWN_KINDS = new Set(['core', 'fast', 'reason', 'coder', 'vision', 'math'])

/**
 * Back-compat single-key accessor (Settings page shows whether *any* key is
 * configured). The real routing below is multi-provider, multi-key.
 */
export async function resolveApiKey() {
  const providers = await listProviders()
  const first = providers[0]
  return first?.keys?.[0] ? { key: first.keys[0], source: 'env' } : { key: null, source: null }
}

export async function apiKeyInfo() {
  const providers = await listProviders()
  const first = providers[0]
  const totalKeys = providers.reduce((n, p) => n + p.keys.length, 0)
  return {
    hasApiKey: providers.length > 0,
    apiKeySource: first ? 'env' : null,
    apiKeyHint: first?.keys?.[0] ? `…${first.keys[0].slice(-4)}` : null,
    keyCount: totalKeys,
    providers: providers.map((p) => p.id),
  }
}

// A (provider, key) pair that just returned "out of credit / rate limited" is
// parked briefly so the next request starts on a healthy one, instead of
// retrying the dead one. This is the core of the hybrid failover: several
// independent free-tier providers/keys back each other up.
const cooldown = new Map()
const COOLDOWN_MS = 60_000
const isExhausted = (status) => status === 401 || status === 402 || status === 429
const cooldownKey = (providerId, key) => `${providerId}:${key}`

async function errorDetail(res) {
  const fallback = `Model provider error (${res.status})`
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
 * Builds the ordered list of attempts (provider × model × key) for a Bermi
 * model id. A Bermi alias ("bermi-core" etc.) fans out across every
 * configured provider that serves that kind of model — OpenRouter, Groq,
 * Google AI Studio, Cerebras — each with its own independent free quota, so
 * one provider running out of tokens never stalls the platform. A raw or
 * custom model id (advanced users) routes through OpenRouter only, as before.
 */
async function buildAttempts(uiModelId, { web = false } = {}) {
  const providers = await listProviders()
  const kind = uiModelId?.startsWith('bermi-') ? uiModelId.slice(6) : null
  const attempts = []

  if (kind && KNOWN_KINDS.has(kind)) {
    // When web grounding is requested, exhaust the web-capable provider
    // (OpenRouter) first; only fall back to non-grounded providers if it's
    // unavailable, trading citations for uptime rather than failing outright.
    const ordered = web
      ? [...providers.filter((p) => p.supportsWebPlugin), ...providers.filter((p) => !p.supportsWebPlugin)]
      : providers
    for (const provider of ordered) {
      const models = provider.models[kind] || []
      for (const realModel of models) {
        for (const key of provider.keys) {
          attempts.push({ provider, key, realModel, web: web && provider.supportsWebPlugin })
        }
      }
    }
  } else {
    const openrouter = providers.find((p) => p.id === 'openrouter')
    if (openrouter) {
      const chain = await resolveModelChain(uiModelId)
      for (const realModel of chain) {
        for (const key of openrouter.keys) {
          attempts.push({ provider: openrouter, key, realModel, web: web && openrouter.supportsWebPlugin })
        }
      }
    }
  }

  // Healthy (not cooling down) attempts first, so a temporarily exhausted
  // key/provider doesn't block a request that has other options.
  const now = Date.now()
  const healthy = attempts.filter((a) => (cooldown.get(cooldownKey(a.provider.id, a.key)) ?? 0) < now)
  const cooling = attempts.filter((a) => !healthy.includes(a))
  return [...healthy, ...cooling]
}

/**
 * Streaming chat completion. Returns the raw Response so callers can pipe
 * the SSE body. Throws with a readable message on non-2xx.
 */
export async function streamCompletion({ model, messages, signal, web = false }) {
  const attempts = await buildAttempts(model, { web })
  if (attempts.length === 0) {
    const err = new Error(
      'No AI provider is configured. Add OPENROUTER_API_KEY, GROQ_API_KEY, GOOGLE_AI_API_KEY, or CEREBRAS_API_KEY on the server.',
    )
    err.status = 401
    throw err
  }
  let lastErr
  for (const { provider, key, realModel, web: useWeb } of attempts) {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers(key),
      body: JSON.stringify(provider.body(realModel, messages, { stream: true, web: useWeb })),
      signal,
    })
    if (res.ok) return res
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    if (isExhausted(res.status)) {
      cooldown.set(cooldownKey(provider.id, key), Date.now() + COOLDOWN_MS)
      continue
    }
    if ([400, 404, 502, 503].includes(res.status)) continue
    throw lastErr
  }
  throw lastErr ?? new Error('No model available')
}

/**
 * Non-streaming completion, used for structured tasks like invoice drafting.
 * Returns the assistant message content as a string, or null when no
 * provider is configured (callers fall back to deterministic output).
 */
export async function complete({ model, messages, maxTokens = 1024 }) {
  const attempts = await buildAttempts(model, { web: false })
  if (attempts.length === 0) return null
  let lastErr
  for (const { provider, key, realModel } of attempts) {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers(key),
      body: JSON.stringify(provider.body(realModel, messages, { stream: false, maxTokens })),
    })
    if (res.ok) {
      const body = await res.json()
      return body.choices?.[0]?.message?.content ?? null
    }
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    if (isExhausted(res.status)) {
      cooldown.set(cooldownKey(provider.id, key), Date.now() + COOLDOWN_MS)
      continue
    }
    if ([400, 404, 502, 503].includes(res.status)) continue
    throw lastErr
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
