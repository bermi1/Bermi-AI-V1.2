import { storage } from './storage/index.js'
import { listProviders } from './providers.js'

// Text-to-speech is architecturally separate from the chat LLM providers
// (different endpoint, binary audio response, no streaming token contract),
// so it gets its own small provider layer rather than being shoehorned into
// providers.js. Preference order: a dedicated paid provider with real
// multi-language coverage (Fish Audio, then ElevenLabs) if an admin has
// added a key for one, otherwise Groq's free Orpheus voices (English/Arabic
// only today) reusing the same key already configured for chat — genuinely
// free, no extra signup, just more limited language coverage.
//
// Voice CLONING (as opposed to picking a stock catalog voice) is
// deliberately NOT handled here — see voices.js, which gates it behind a
// spoken, server-issued consent check before ever creating a Fish Audio
// voice model, precisely because cloning a voice without real consent is a
// live deepfake/impersonation risk.

function parseKeys(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

async function firstKey(envBase, settingKey) {
  const fromEnv = parseKeys(process.env[envBase])
  if (fromEnv.length) return fromEnv[0]
  const stored = parseKeys(await storage.getSetting(settingKey))
  return stored[0] || null
}

export const MANAGED_TTS_PROVIDERS = [
  { id: 'fishaudio', label: 'Fish Audio', settingKey: 'fishaudio_api_key', envBase: 'FISH_AUDIO_API_KEY' },
  { id: 'elevenlabs', label: 'ElevenLabs', settingKey: 'elevenlabs_api_key', envBase: 'ELEVENLABS_API_KEY' },
]

/** Shared with voices.js — voice cloning creates Fish Audio models using the
 * same admin-managed key TTS already uses. */
export async function fishAudioKey() {
  return firstKey('FISH_AUDIO_API_KEY', 'fishaudio_api_key')
}

async function groqKeyForTts() {
  const providers = await listProviders()
  return providers.find((p) => p.id === 'groq')?.keys?.[0] || null
}

/** Status for the admin dashboard: what's configured and what each covers. */
export async function ttsProviderStatus() {
  const out = []
  for (const p of MANAGED_TTS_PROVIDERS) {
    const key = await firstKey(p.envBase, p.settingKey)
    out.push({
      id: p.id,
      label: p.label,
      configured: Boolean(key),
      managed: true,
      languages: p.id === 'fishaudio' ? '80+ languages (paid — not licensed on Fish Audio’s free tier for commercial use)' : 'Multiple languages (paid)',
    })
  }
  const groq = await groqKeyForTts()
  out.push({ id: 'groq', label: 'Groq (Orpheus, free)', configured: Boolean(groq), managed: false, languages: 'English, Arabic only' })
  return out
}

async function synthesizeFishAudio(text, key, voice) {
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 4000), reference_id: voice || undefined, format: 'mp3' }),
  })
  if (!res.ok) throw new Error(`Fish Audio error (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' }
}

async function synthesizeElevenLabs(text, key, voice) {
  const voiceId = voice || '21m00Tcm4TlvDq8ikWAM' // ElevenLabs' default public "Rachel" voice
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 4000), model_id: 'eleven_multilingual_v2' }),
  })
  if (!res.ok) throw new Error(`ElevenLabs error (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' }
}

// Groq deprecated playai-tts/playai-tts-arabic (Dec 2025) in favor of Canopy
// Labs' Orpheus models — same endpoint and request shape, new model ids and
// voice names.
async function synthesizeGroq(text, key, voice, language) {
  const arabic = language === 'ar'
  const model = arabic ? 'canopylabs/orpheus-arabic-saudi' : 'canopylabs/orpheus-v1-english'
  const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: text.slice(0, 2000),
      voice: voice || (arabic ? 'abdullah' : 'autumn'),
      response_format: 'wav',
    }),
  })
  if (!res.ok) throw new Error(`Groq TTS error (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: 'audio/wav' }
}

/**
 * Synthesizes speech for `text` using the best available configured
 * provider. Throws a 501-status error when nothing is configured at all —
 * callers should surface that as "voice isn't set up yet", not a crash.
 */
export async function synthesizeSpeech(text, { voice, language } = {}) {
  const clean = String(text || '').trim()
  if (!clean) {
    const err = new Error('No text to speak')
    err.status = 400
    throw err
  }

  const fishKey = await firstKey('FISH_AUDIO_API_KEY', 'fishaudio_api_key')
  if (fishKey) return synthesizeFishAudio(clean, fishKey, voice)

  const elevenKey = await firstKey('ELEVENLABS_API_KEY', 'elevenlabs_api_key')
  if (elevenKey) return synthesizeElevenLabs(clean, elevenKey, voice)

  const groqKey = await groqKeyForTts()
  if (groqKey) return synthesizeGroq(clean, groqKey, voice, language)

  const err = new Error(
    'No text-to-speech provider is configured yet. An admin can add a Fish Audio or ElevenLabs key in Admin → AI Providers, or Groq’s existing chat key already enables free English/Arabic voices automatically.',
  )
  err.status = 501
  throw err
}
