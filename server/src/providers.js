import { storage } from './storage/index.js'

// Hybrid multi-provider layer: several free, OPEN-WEIGHT AI providers, each
// with its own key(s) and model-name dialect. If one provider is out of
// tokens, rate-limited, or down, requests roll over to the next — so the
// whole platform never goes dark because of a single exhausted key.
//
// Every model behind every provider here is open-weight (Llama, Qwen,
// DeepSeek, Mistral, Gemma) — deliberately, no closed/proprietary model
// (e.g. Gemini, GPT, Claude) is ever routed to, on principle.
//
// Each provider maps Bermi's neutral model "kind" (core/fast/reason/coder/
// vision/math) to that provider's own real model id. Order = preference.

function parseKeys(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

// Numbered env var slots (BASE, BASE_2, BASE_3, ...) rather than a fixed
// count — adding another free-tier account's key to widen the quota pool
// should never require a code change, just one more Vercel env var.
function numberedEnvKeys(base, max = 20) {
  const names = [base]
  for (let i = 2; i <= max; i++) names.push(`${base}_${i}`)
  return names
}

// Keys can come from Vercel env vars (set once by whoever has dashboard
// access) AND/OR from admin-added keys stored in the database (added
// in-product via Settings → AI Providers — see routes/admin.js). The two
// pools are merged, deduplicated, so an admin who can't touch Vercel can
// still widen the shared quota pool themselves, and an env-configured
// deployment keeps working with zero setup.
async function envOrSetting(envKeys, settingKey) {
  const fromEnv = envKeys.flatMap((k) => parseKeys(process.env[k]))
  const storedRaw = await storage.getSetting(settingKey)
  const fromSetting = storedRaw ? parseKeys(storedRaw) : []
  return [...new Set([...fromEnv, ...fromSetting])]
}

const OPENROUTER_MODELS = {
  core: [
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'deepseek/deepseek-chat-v3-0324:free',
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
  ],
  fast: ['google/gemma-3-27b-it:free', 'mistralai/mistral-small-3.1-24b-instruct:free', 'meta-llama/llama-3.2-3b-instruct:free'],
  reason: ['deepseek/deepseek-r1:free', 'deepseek/deepseek-r1-0528:free', 'qwen/qwq-32b:free'],
  coder: ['qwen/qwen-2.5-coder-32b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'],
  vision: ['qwen/qwen-2.5-vl-72b-instruct:free', 'meta-llama/llama-3.2-11b-vision-instruct:free'],
  math: ['qwen/qwen-2.5-72b-instruct:free', 'qwen/qwq-32b:free', 'deepseek/deepseek-r1:free'],
}

// Groq's free tier serves genuinely open-weight models (Llama, etc.) at very
// high speed — a strong second provider for the hybrid pool.
const GROQ_MODELS = {
  core: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  fast: ['llama-3.1-8b-instant'],
  reason: ['deepseek-r1-distill-llama-70b', 'llama-3.3-70b-versatile'],
  coder: ['llama-3.3-70b-versatile'],
  vision: ['llama-3.2-11b-vision-preview'],
  math: ['llama-3.3-70b-versatile'],
}

// Cerebras serves fast, free-tier open-weight inference — another independent
// quota pool.
const CEREBRAS_MODELS = {
  core: ['llama-3.3-70b'],
  fast: ['llama3.1-8b'],
  reason: ['llama-3.3-70b'],
  coder: ['llama-3.3-70b'],
  vision: [],
  math: ['llama-3.3-70b'],
}

async function openrouterProvider() {
  const keys = await envOrSetting(numberedEnvKeys('OPENROUTER_API_KEY'), 'openrouter_api_key')
  if (!keys.length) return null
  return {
    id: 'openrouter',
    keys,
    models: OPENROUTER_MODELS,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bermi.ai',
      'X-Title': 'Bermi AI',
    }),
    supportsWebPlugin: true,
    body: (model, messages, { stream, maxTokens, web }) => ({
      model,
      messages,
      ...(stream ? { stream: true } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(web ? { plugins: [{ id: 'web', max_results: 5 }] } : {}),
    }),
  }
}

async function groqProvider() {
  const keys = await envOrSetting(numberedEnvKeys('GROQ_API_KEY'), 'groq_api_key')
  if (!keys.length) return null
  return {
    id: 'groq',
    keys,
    models: GROQ_MODELS,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
    supportsWebPlugin: false,
    body: (model, messages, { stream, maxTokens }) => ({
      model,
      messages,
      ...(stream ? { stream: true } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  }
}

async function cerebrasProvider() {
  const keys = await envOrSetting(numberedEnvKeys('CEREBRAS_API_KEY'), 'cerebras_api_key')
  if (!keys.length) return null
  return {
    id: 'cerebras',
    keys,
    models: CEREBRAS_MODELS,
    url: 'https://api.cerebras.ai/v1/chat/completions',
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
    supportsWebPlugin: false,
    body: (model, messages, { stream, maxTokens }) => ({
      model,
      messages,
      ...(stream ? { stream: true } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  }
}

// On-device fallback: a bundled llama.cpp server (llama-server) speaks the
// same OpenAI-compatible /v1/chat/completions contract as every other
// provider here, so it's just one more link in the same chain — the last
// one, since a local small model only kicks in once every cloud option is
// unreachable (used by the offline desktop build; unset in the web deploy).
// One small on-device model serves every "kind" — there's no lineup of
// specialized local models like the cloud providers have.
async function localProvider() {
  const url = process.env.LOCAL_LLM_URL
  if (!url) return null
  const modelId = process.env.LOCAL_LLM_MODEL || 'local'
  const models = { core: [modelId], fast: [modelId], reason: [modelId], coder: [modelId], vision: [], math: [modelId] }
  return {
    id: 'local',
    keys: ['local'], // no auth — the model runs on localhost inside the same app
    models,
    url,
    headers: () => ({ 'Content-Type': 'application/json' }),
    supportsWebPlugin: false,
    body: (model, messages, { stream, maxTokens }) => ({
      model,
      messages,
      ...(stream ? { stream: true } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  }
}

// Provider keys manageable from the admin dashboard (Settings → AI
// Providers), not just Vercel env vars — see envOrSetting above.
export const MANAGED_KEY_PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter', settingKey: 'openrouter_api_key', envBase: 'OPENROUTER_API_KEY' },
  { id: 'groq', label: 'Groq', settingKey: 'groq_api_key', envBase: 'GROQ_API_KEY' },
  { id: 'cerebras', label: 'Cerebras', settingKey: 'cerebras_api_key', envBase: 'CEREBRAS_API_KEY' },
]

export function envKeyCount(envBase) {
  return numberedEnvKeys(envBase).flatMap((k) => parseKeys(process.env[k])).length
}

export async function addStoredKey(settingKey, newKey) {
  const trimmed = String(newKey || '').trim()
  if (!trimmed) throw new Error('Key is required')
  const keys = parseKeys(await storage.getSetting(settingKey))
  if (!keys.includes(trimmed)) keys.push(trimmed)
  await storage.setSetting(settingKey, keys.join(','))
  return keys
}

export async function removeStoredKey(settingKey, index) {
  const keys = parseKeys(await storage.getSetting(settingKey))
  if (index < 0 || index >= keys.length) throw new Error('No such key')
  keys.splice(index, 1)
  if (keys.length) await storage.setSetting(settingKey, keys.join(','))
  else await storage.deleteSetting(settingKey)
  return keys
}

/** All configured providers, in preference order. Unconfigured ones are skipped. */
export async function listProviders() {
  const all = await Promise.all([
    openrouterProvider(),
    groqProvider(),
    cerebrasProvider(),
    localProvider(),
  ])
  return all.filter(Boolean)
}

export async function providerStatus() {
  const providers = await listProviders()
  return providers.map((p) => ({ id: p.id, keys: p.keys.length }))
}
