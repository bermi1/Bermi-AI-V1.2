import { storage } from './storage/index.js'
import { checkRateLimit } from './rateLimit.js'

// Real web-search grounding. OpenRouter's own "web" plugin (see openrouter.js
// providers) looked like the natural fit since it rides the same request,
// but it bills real money PER SEARCH even when the underlying chat model is
// free — and this app deliberately runs on a $0 free-tier account, so every
// plugin-enabled request was almost certainly failing (insufficient credits)
// and silently falling back to an ungrounded answer. That's the actual root
// cause behind "Bermi still thinks it's however-many years ago" complaints:
// the freshness-detection logic (needsFreshInfo/TOPIC_RE in routes/chat.js)
// was working correctly the whole time — the grounding attempt behind it
// just never had funds to run.
//
// Tavily is built specifically for this (LLM/RAG-oriented search, licensed
// for exactly this use, not a scrape of someone else's copyrighted pages)
// and has a genuine, permanent free tier (1,000 searches/month, no card
// required) — consistent with every other provider in this app.

function parseKeys(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

async function tavilyKey() {
  const fromEnv = parseKeys(process.env.TAVILY_API_KEY)[0]
  if (fromEnv) return fromEnv
  return parseKeys(await storage.getSetting('tavily_api_key'))[0] || null
}

export const MANAGED_SEARCH_PROVIDERS = [
  { id: 'tavily', label: 'Tavily (web search)', settingKey: 'tavily_api_key', envBase: 'TAVILY_API_KEY' },
]

export async function webSearchStatus() {
  return { available: Boolean(await tavilyKey()) }
}

// A shared, server-wide daily cap — independent of any per-user chat quota —
// so one chatty day can't silently blow through the whole month's free
// credit allowance before anyone notices. Search just degrades to "not
// available right now" past this, the same as when no key is configured.
const DAILY_BUDGET = 40

/**
 * Runs a real web search and returns concrete, citable results — or `null`
 * if search isn't configured/available/over budget, in which case the
 * caller should proceed without grounding (and may still fall back to
 * OpenRouter's paid plugin, see routes/chat.js) rather than fail the chat.
 */
export async function webSearch(query, { maxResults = 5 } = {}) {
  const key = await tavilyKey()
  if (!key) return null
  if (!checkRateLimit('websearch:global', { windowMs: 24 * 60 * 60_000, max: DAILY_BUDGET })) return null

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.slice(0, 400), max_results: maxResults, search_depth: 'basic' }),
  })
  if (!res.ok) {
    throw new Error(`Web search error (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  const body = await res.json()
  const results = (body.results || [])
    .filter((r) => r?.url && r?.content)
    .map((r) => ({ title: r.title || r.url, url: r.url, content: String(r.content).slice(0, 1200) }))
  return { results }
}
