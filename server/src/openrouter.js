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
// 401/402/403/429 all mean "this key/provider won't work right now" (bad,
// revoked, or rate/credit-limited) — worth a cooldown so it isn't retried on
// every request. Anything else (400 bad model id, 404, 5xx, proxy/network
// denials) still just moves on to the next attempt below; it's simply not
// worth cooling down since it's not necessarily the key's fault.
const isExhausted = (status) => status === 401 || status === 402 || status === 403 || status === 429
const cooldownKey = (providerId, key) => `${providerId}:${key}`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A single provider call, with ONE short-delay retry on a thrown (network-
 * level: DNS, TLS, dropped connection) failure — genuinely transient, unlike
 * an exhausted key or a real HTTP error, so it's worth catching before
 * giving up on that attempt and burning through the rest of the fallback
 * chain for something that likely would have worked a moment later anyway.
 * HTTP error responses (res.ok === false) are returned as-is, not retried
 * here — the caller's own fallback loop already moves on to the next
 * provider/model/key for those.
 */
async function fetchAttempt(provider, key, realModel, messages, { stream, maxTokens, web }, signal) {
  const doFetch = () =>
    fetch(provider.url, {
      method: 'POST',
      headers: provider.headers(key),
      body: JSON.stringify(provider.body(realModel, messages, { stream, maxTokens, web })),
      signal,
    })
  try {
    return await doFetch()
  } catch (err) {
    if (signal?.aborted) throw err
    await sleep(300)
    return doFetch()
  }
}

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

// A raw provider error ("Request too large for model `llama-3.1-8b-instant` on
// tokens per minute (TPM): Limit 6000, Requested 7765...") is meaningless to
// an end user and looks like a crash. Once every provider/model/key in the
// chain has been exhausted, translate the *last* failure into one plain,
// reassuring sentence — the system already tried everything available before
// giving up, so the message should say that, not dump the wire-level detail.
function friendlyMessage(status) {
  if (status === 413) {
    return "That request was too large for the AI providers' current capacity. Try starting a new conversation (or turning off a large knowledge base) to shrink it, then send it again."
  }
  if (status === 429 || status === 402) {
    return "Bermi's shared AI capacity is fully busy right now — it already tried every available provider. Please try again shortly."
  }
  if (status === 401 || status === 403) {
    return 'The AI provider rejected the request. An admin may need to check the configured API keys.'
  }
  if (typeof status === 'number' && status >= 500) {
    return 'The AI providers are temporarily unavailable. Please try again in a moment.'
  }
  return 'Bermi could not get a response right now. Please try again in a moment.'
}

// How long to suggest waiting before a retry, in seconds. Real cooldowns (see
// `cooldown` map below) give an exact number for auth/quota failures; a 413
// isn't tied to any cooldown (it's a payload-size problem, not an exhausted
// key) so it gets a short fixed suggestion instead.
function suggestedRetrySeconds(status, attempts) {
  if (status === 413) return 15
  const now = Date.now()
  const until = attempts
    .map((a) => cooldown.get(cooldownKey(a.provider.id, a.key)) ?? 0)
    .filter((t) => t > now)
  return until.length ? Math.ceil((Math.min(...until) - now) / 1000) : 30
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
      'No AI provider is configured. Add OPENROUTER_API_KEY, GROQ_API_KEY, or CEREBRAS_API_KEY on the server, or add a key from Admin → AI Providers.',
    )
    err.status = 401
    throw err
  }
  let lastErr
  // A 413 means THIS model can't fit THIS request at all — retrying the same
  // realModel under a different key would just 413 again for the identical
  // reason. Skip the rest of that model's keys and move straight to a
  // different model instead of burning attempts (and time) on guaranteed
  // repeats.
  const oversizedModels = new Set()
  for (const { provider, key, realModel, web: useWeb } of attempts) {
    if (oversizedModels.has(realModel)) continue
    let res
    try {
      res = await fetchAttempt(provider, key, realModel, messages, { stream: true, web: useWeb }, signal)
    } catch (err) {
      // Still failing after the one retry inside fetchAttempt — treat it as
      // this attempt's problem, not a reason to give up on every other
      // provider/model/key in the chain.
      if (signal?.aborted) throw err
      lastErr = err
      continue
    }
    if (res.ok) return res
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    if (res.status === 413) oversizedModels.add(realModel)
    // Every non-2xx just moves on to the next attempt — provider/model/key
    // outages should never take the whole request down while any other
    // option remains. Only cool the (provider, key) down when the failure
    // looks like an auth/quota problem, so it isn't retried needlessly.
    if (isExhausted(res.status)) cooldown.set(cooldownKey(provider.id, key), Date.now() + COOLDOWN_MS)
  }
  const finalErr = lastErr ?? new Error('No model available')
  finalErr.friendly = friendlyMessage(finalErr.status)
  finalErr.retryAfter = suggestedRetrySeconds(finalErr.status, attempts)
  throw finalErr
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
  const oversizedModels = new Set()
  for (const { provider, key, realModel } of attempts) {
    if (oversizedModels.has(realModel)) continue
    let res
    try {
      res = await fetchAttempt(provider, key, realModel, messages, { stream: false, maxTokens }, undefined)
    } catch (err) {
      lastErr = err
      continue
    }
    if (res.ok) {
      const body = await res.json()
      return body.choices?.[0]?.message?.content ?? null
    }
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    if (res.status === 413) oversizedModels.add(realModel)
    if (isExhausted(res.status)) cooldown.set(cooldownKey(provider.id, key), Date.now() + COOLDOWN_MS)
  }
  const finalErr = lastErr ?? new Error('No model available')
  finalErr.friendly = friendlyMessage(finalErr.status)
  finalErr.retryAfter = suggestedRetrySeconds(finalErr.status, attempts)
  throw finalErr
}

/**
 * Live capacity snapshot for the admin dashboard: which providers are
 * configured, how many keys each has, and how many of those keys are
 * currently cooling down (recently hit a quota/auth error). Lets an admin
 * watching a launch see quota pressure building in real time instead of
 * only finding out when users start reporting broken chats.
 */
export async function providerHealth() {
  const providers = await listProviders()
  const now = Date.now()
  return providers.map((p) => {
    const retries = p.keys
      .map((k) => cooldown.get(cooldownKey(p.id, k)) ?? 0)
      .filter((until) => until > now)
      .map((until) => Math.ceil((until - now) / 1000))
    return {
      id: p.id,
      totalKeys: p.keys.length,
      coolingKeys: retries.length,
      nextRetryInSeconds: retries.length ? Math.min(...retries) : null,
    }
  })
}

/** Live model listing from OpenRouter, used to augment the configured list. */
export async function fetchLiveModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(await errorDetail(res))
  const body = await res.json()
  return body.data ?? []
}
