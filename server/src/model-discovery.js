// Self-healing model lists. Hosted catalogs rename and retire models without
// warning (production just showed Groq answering 404 and NVIDIA 410 for ids that
// used to work). Instead of trusting a hardcoded list alone, ask each provider
// which models it serves RIGHT NOW and put the best fits ahead of the static
// list. Failures are harmless: the static list still applies.

const NON_CHAT = /(whisper|tts|speech|embed|rerank|guard|safety|moderation|reward|vision|vlm|[-_]vl\b|clip|parse|ocr|riva|diffusion|image|audio|transcribe|orpheus|playai|retriev|translate|nemoguard|paligemma|steer)/i
const FAMILY = /(llama|qwen|gemma|mistral|mixtral|deepseek|gpt-oss|nemotron|phi|kimi|glm)/i
const FLAGSHIP = /(gpt-oss-120b|deepseek[\w.-]*(v3|r1)|kimi-k2|qwen3-235b|llama-3\.1-405b)/i

export function sizeB(id) {
  const m = String(id).match(/(\d+(?:\.\d+)?)\s*b(?![a-z])/i)
  if (m) return parseFloat(m[1])
  if (/instant|mini|small|lite/i.test(id)) return 8
  return null
}

/**
 * Orders model ids for a Bermi "kind". `fast` prefers small, cheap models
 * (7–34B, smallest first); `core` prefers the strongest affordable ones
 * (flagships, then ~70–130B, then smaller). Other kinds keep their static list.
 */
export function rankModels(ids, kind) {
  if (kind !== 'fast' && kind !== 'core') return []
  const ok = [...new Set(ids)].filter((id) => FAMILY.test(id) && !NON_CHAT.test(id))
  if (kind === 'fast') {
    return ok
      .map((id) => ({ id, s: sizeB(id) }))
      .filter((x) => x.s != null && x.s >= 7 && x.s <= 34)
      .sort((a, b) => a.s - b.s || a.id.length - b.id.length)
      .slice(0, 3)
      .map((x) => x.id)
  }
  return ok
    .map((id) => ({ id, s: FLAGSHIP.test(id) ? 1000 : sizeB(id) }))
    .filter((x) => x.s != null && x.s >= 20)
    .sort((a, b) => (b.s <= 130 || b.s === 1000 ? b.s : 0) - (a.s <= 130 || a.s === 1000 ? a.s : 0))
    .slice(0, 3)
    .map((x) => x.id)
}

const TTL = 6 * 60 * 60_000
const cache = new Map() // provider id -> { at, ids }

/** Chat-capable model ids a provider reports (cached; [] when unreachable). */
export async function listProviderModels(provider, fetchFn = fetch) {
  const hit = cache.get(provider.id)
  if (hit && Date.now() - hit.at < TTL) return hit.ids
  if (!provider.modelsUrl || !provider.keys?.length) return []
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 6000)
  try {
    const res = await fetchFn(provider.modelsUrl, { headers: provider.headers(provider.keys[0]), signal: ctl.signal })
    if (!res.ok) throw new Error(String(res.status))
    const body = await res.json()
    const ids = (body.data ?? body.models ?? []).map((m) => m.id ?? m.name).filter((x) => typeof x === 'string')
    cache.set(provider.id, { at: Date.now(), ids })
    return ids
  } catch {
    // Keep serving the last good list rather than forgetting it; retry in 10 min.
    const old = hit?.ids ?? []
    cache.set(provider.id, { at: Date.now() - TTL + 10 * 60_000, ids: old })
    return old
  } finally {
    clearTimeout(timer)
  }
}

export async function discoveredModels(provider, kind, fetchFn) {
  return rankModels(await listProviderModels(provider, fetchFn), kind)
}

// Models that answered "does not exist / gone" are skipped for a while so a
// retired id doesn't cost a failed call per key on every request.
const dead = new Map()
const DEAD_MS = 6 * 60 * 60_000
export const markDead = (providerId, model) => dead.set(`${providerId}:${model}`, Date.now() + DEAD_MS)
export const isDead = (providerId, model) => (dead.get(`${providerId}:${model}`) ?? 0) > Date.now()
export const _resetForTests = () => { cache.clear(); dead.clear() }
