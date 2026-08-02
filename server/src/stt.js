import { listProviders } from './providers.js'

// Speech-to-text, architecturally the mirror of tts.js: Groq's Whisper
// endpoint is free on the same GROQ_API_KEY chat already uses, so voice
// input needs no separate signup or admin setup beyond what's already there
// for chat/TTS. (Fish Audio and ElevenLabs, the other configured audio
// providers, are TTS-only — neither offers transcription — so Groq is the
// only path here for now.)

async function groqKey() {
  const providers = await listProviders()
  return providers.find((p) => p.id === 'groq')?.keys?.[0] || null
}

/** Whether voice input can work at all right now — drives the mic button's
 * enabled/disabled state instead of it silently failing on first use. */
export async function sttStatus() {
  const key = await groqKey()
  return { available: Boolean(key) }
}

/**
 * Transcribes spoken audio to text using Groq's Whisper endpoint. `buffer` /
 * `filename` / `mimetype` come straight from a multer file upload (the
 * browser-recorded clip, typically audio/webm).
 */
export async function transcribeAudio(buffer, filename, mimetype) {
  const key = await groqKey()
  if (!key) {
    const err = new Error(
      'Voice input is not set up yet. An admin needs to add a Groq API key in Admin → AI Providers — the same key chat already uses covers this.',
    )
    err.status = 501
    throw err
  }
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimetype || 'audio/webm' }), filename || 'audio.webm')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('response_format', 'json')
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    const err = new Error(`Could not transcribe that — please try again. (${res.status}: ${detail})`)
    err.status = res.status >= 400 && res.status < 500 ? 400 : 502
    throw err
  }
  const body = await res.json()
  return String(body.text || '').trim()
}
