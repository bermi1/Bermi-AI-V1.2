import { storage } from './storage/index.js'

// Hybrid multi-provider layer: several free/open-weight AI providers, each
// with its own key(s) and model-name dialect. If one provider is out of
// tokens, rate-limited, or down, requests roll over to the next — so the
// whole platform never goes dark because of a single exhausted key.
//
// Each provider maps Bermi's neutral model "kind" (core/fast/reason/coder/
// vision/math) to that provider's own real model id. Order = preference.

function parseKeys(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

async function envOrSetting(envKeys, settingKey) {
  const keys = envKeys.flatMap((k) => parseKeys(process.env[k]))
  if (keys.length) return keys
  const stored = await storage.getSetting(settingKey)
  return stored ? parseKeys(stored) : []
}

const OPENROUTER_MODELS = {
  core: [
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'deepseek/deepseek-chat-v3-0324:free',
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
  ],
  fast: ['google/gemini-2.0-flash-exp:free', 'google/gemma-3-27b-it:free', 'meta-llama/llama-3.2-3b-instruct:free'],
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

// Google AI Studio's Gemini free tier (separate quota pool from OpenRouter's
// Gemini route) — another independent free lane when configured.
const GOOGLE_MODELS = {
  core: ['gemini-2.0-flash'],
  fast: ['gemini-2.0-flash'],
  reason: ['gemini-2.0-flash-thinking-exp'],
  coder: ['gemini-2.0-flash'],
  vision: ['gemini-2.0-flash'],
  math: ['gemini-2.0-flash-thinking-exp'],
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
  const keys = await envOrSetting(
    ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_2', 'OPENROUTER_API_KEY_3', 'OPENROUTER_API_KEY_4'],
    'openrouter_api_key',
  )
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
  const keys = await envOrSetting(['GROQ_API_KEY', 'GROQ_API_KEY_2'], 'groq_api_key')
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

async function googleProvider() {
  const keys = await envOrSetting(['GOOGLE_AI_API_KEY', 'GEMINI_API_KEY'], 'google_ai_api_key')
  if (!keys.length) return null
  return {
    id: 'google',
    keys,
    models: GOOGLE_MODELS,
    // OpenAI-compatible endpoint Google AI Studio exposes for Gemini.
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
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
  const keys = await envOrSetting(['CEREBRAS_API_KEY'], 'cerebras_api_key')
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

/** All configured providers, in preference order. Unconfigured ones are skipped. */
export async function listProviders() {
  const all = await Promise.all([openrouterProvider(), groqProvider(), googleProvider(), cerebrasProvider()])
  return all.filter(Boolean)
}

export async function providerStatus() {
  const providers = await listProviders()
  return providers.map((p) => ({ id: p.id, keys: p.keys.length }))
}
