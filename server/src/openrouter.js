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
// ---------------------------------------------------------------------------
// Dynamic best-open-weight-model discovery (OpenRouter, "core" kind only).
//
// A hardcoded model id list goes stale the moment a provider renames or
// re-prices a model — exactly what just happened when OpenRouter discontinued
// the `:free` variant of every model this file used to list. Rather than
// hardcode the "best" model by name (which will just go stale again), this
// asks OpenRouter's own live catalog which open-weight models are CURRENTLY
// free and picks the largest/most capable ones itself — self-correcting
// instead of needing another manual fix next time the catalog shifts.
//
// Falls back to nothing (an empty list) on any failure, so the caller's
// existing hardcoded OPENROUTER_MODELS.core always still applies — this is
// purely additive, prepended ahead of the static list, never a replacement
// that could leave core with zero options if the live fetch is unavailable.
// ---------------------------------------------------------------------------

// Orgs that publish genuinely open-weight models on OpenRouter. A couple of
// these orgs (google, microsoft) publish BOTH open and closed models under
// the same namespace, so those two need an extra name check below.
const OPEN_WEIGHT_ORGS = new Set(['meta-llama', 'qwen', 'deepseek', 'mistralai', 'google', 'moonshotai', '01-ai', 'thudm', 'microsoft'])

function isOpenWeightModelId(id) {
  const org = id.split('/')[0]?.toLowerCase()
  if (!OPEN_WEIGHT_ORGS.has(org)) return false
  if (org === 'google' && !/gemma/i.test(id)) return false // exclude closed Gemini
  if (org === 'microsoft' && !/\bphi/i.test(id)) return false // exclude closed models
  if (/vision|embed|moderation|guard/i.test(id)) return false // not a general chat model
  return true
}

// Known flagship-tier open-weight models whose names don't encode a plain
// "Nb" parameter count (e.g. Kimi K2 is a ~1T-parameter MoE model, DeepSeek
// R1/V3 are frontier-class reasoning/chat models) — without this, the naive
// size heuristic below would rank them BELOW an ordinary "Llama-3.3-70b"
// just because "70b" is easy to parse and "kimi-k2" isn't. Scored above any
// plain parsed size so these always rank first when available.
const FLAGSHIP_RE = /deepseek[\w-]*-r1|deepseek[\w-]*-v3|kimi-k2|kimi-k1\.5|qwen3-235b|qwen-3-235b|llama-3\.1-405b/i

// Rough capability proxy: known flagships first, then parameter count parsed
// from the id/name (e.g. "70b", "405b"). Not exact science, but a reasonable
// way to prefer the strongest variant of each model family without a fully
// hardcoded, ever-staling model list.
function modelScore(id) {
  if (FLAGSHIP_RE.test(id)) return 1000
  const m = id.match(/(\d+(?:\.\d+)?)b\b/i)
  return m ? parseFloat(m[1]) : 0
}

let coreModelCache = { at: 0, ids: [] }
const CORE_MODEL_CACHE_MS = 6 * 60 * 60_000 // 6h — this doesn't need to be fresh-to-the-second

async function dynamicOpenRouterCoreModels() {
  if (Date.now() - coreModelCache.at < CORE_MODEL_CACHE_MS) return coreModelCache.ids
  try {
    const models = await fetchLiveModels()
    const ids = models
      .filter((m) => isOpenWeightModelId(m.id) && parseFloat(m.pricing?.prompt ?? '1') === 0 && parseFloat(m.pricing?.completion ?? '1') === 0)
      .sort((a, b) => modelScore(b.id) - modelScore(a.id))
      .slice(0, 5)
      .map((m) => m.id)
    coreModelCache = { at: Date.now(), ids }
    return ids
  } catch {
    // Live catalog unreachable — keep the previous cache (even if stale) if
    // there is one, so a transient fetch failure doesn't downgrade to the
    // static list unnecessarily; a genuinely empty cache just means "add
    // nothing", the static OPENROUTER_MODELS.core is still there.
    return coreModelCache.ids
  }
}

// Moves the given provider (if configured) to the front of the list,
// preserving the relative order of the rest — used to prefer one provider
// for a specific model kind without dropping the others as fallback.
function preferProvider(list, id) {
  const idx = list.findIndex((p) => p.id === id)
  if (idx <= 0) return list
  const copy = [...list]
  const [preferred] = copy.splice(idx, 1)
  copy.unshift(preferred)
  return copy
}

async function buildAttempts(uiModelId, { web = false } = {}) {
  const providers = await listProviders()
  const kind = uiModelId?.startsWith('bermi-') ? uiModelId.slice(6) : null
  const attempts = []

  if (kind && KNOWN_KINDS.has(kind)) {
    // When web grounding is requested, exhaust the web-capable provider
    // (OpenRouter) first; only fall back to non-grounded providers if it's
    // unavailable, trading citations for uptime rather than failing outright.
    let ordered = web
      ? [...providers.filter((p) => p.supportsWebPlugin), ...providers.filter((p) => !p.supportsWebPlugin)]
      : providers
    // bermi-core (the default chat model) prefers NVIDIA first when it's
    // configured — still falls back through the rest of the chain if
    // NVIDIA's quota is exhausted, so this doesn't trade away the hybrid
    // failover, just reorders who gets tried first for this one kind.
    if (kind === 'core') ordered = preferProvider(ordered, 'nvidia')
    // Best-currently-free-open-weight models, discovered live from
    // OpenRouter's own catalog rather than hardcoded — see
    // dynamicOpenRouterCoreModels above for why. Only applies to
    // OpenRouter's core list; other providers/kinds are unaffected.
    const dynamicCoreIds = kind === 'core' ? await dynamicOpenRouterCoreModels() : []
    for (const provider of ordered) {
      let models = provider.models[kind] || []
      if (provider.id === 'openrouter' && dynamicCoreIds.length) {
        models = [...new Set([...dynamicCoreIds, ...models])]
      }
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
  // Every attempt's outcome, kept so a total failure can be logged in full —
  // "all providers failed" used to only ever surface the LAST attempt's
  // error, which made a single broken model id look identical to genuine
  // multi-provider quota exhaustion. Now the real spread is visible.
  const trace = []
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
      trace.push(`${provider.id}/${realModel}: network error — ${err.message}`)
      continue
    }
    if (res.ok) return res
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    trace.push(`${provider.id}/${realModel}: ${res.status} — ${lastErr.message}`)
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
  finalErr.trace = trace
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
  const trace = []
  const oversizedModels = new Set()
  for (const { provider, key, realModel } of attempts) {
    if (oversizedModels.has(realModel)) continue
    let res
    try {
      res = await fetchAttempt(provider, key, realModel, messages, { stream: false, maxTokens }, undefined)
    } catch (err) {
      lastErr = err
      trace.push(`${provider.id}/${realModel}: network error — ${err.message}`)
      continue
    }
    if (res.ok) {
      const body = await res.json()
      return body.choices?.[0]?.message?.content ?? null
    }
    lastErr = new Error(await errorDetail(res))
    lastErr.status = res.status
    trace.push(`${provider.id}/${realModel}: ${res.status} — ${lastErr.message}`)
    if (res.status === 413) oversizedModels.add(realModel)
    if (isExhausted(res.status)) cooldown.set(cooldownKey(provider.id, key), Date.now() + COOLDOWN_MS)
  }
  const finalErr = lastErr ?? new Error('No model available')
  finalErr.friendly = friendlyMessage(finalErr.status)
  finalErr.retryAfter = suggestedRetrySeconds(finalErr.status, attempts)
  finalErr.trace = trace
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
