import { randomInt, randomUUID } from 'node:crypto'
import { storage } from './storage/index.js'
import { fishAudioKey } from './tts.js'
import { transcribeAudio } from './stt.js'

// Voice cloning (Fish Audio's core feature) is deliberately excluded from
// tts.js's normal reach — "upload a sample, speak in someone's voice" is a
// live deepfake/impersonation risk with no safe default. This module is the
// one place it's allowed, gated behind a real consent check: before any
// clone is created, the requesting user must speak a fresh, random,
// server-issued phrase out loud and have it verified via our own
// speech-to-text. That proves whoever ends up in the model was actually
// present and consenting at the moment of creation — not just someone who
// uploaded a recording of a voice that isn't theirs. It is not identity
// verification (nothing here confirms *who* is speaking), but it does mean
// a clone can't be created from a found/stolen recording alone, and every
// clone carries a timestamped, transcribed consent statement for accountability.

const CONSENT_TTL_MS = 5 * 60_000
// In-memory, per-instance challenge store — short-lived by design (a
// consent code is used once, within minutes), so it doesn't need to survive
// a restart the way the created voices themselves do (those live in
// storage, see below).
const pendingConsent = new Map()

function consentPhraseFor(code) {
  return `I am giving Bermi my consent to clone this voice. Confirmation code ${code}.`
}

/** Issues a fresh random phrase the user must read aloud next. Call again to
 * get a new one if the previous attempt expired or failed verification. */
export function issueConsentPhrase(userId) {
  const code = String(randomInt(1000, 10000))
  pendingConsent.set(userId, { code, phrase: consentPhraseFor(code), expiresAt: Date.now() + CONSENT_TTL_MS })
  return { phrase: consentPhraseFor(code), expiresInSeconds: CONSENT_TTL_MS / 1000 }
}

function normalizeWords(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// Deliberately lenient on wording (speech-to-text on a short clip is never
// perfect) but strict on the one thing that actually matters: the random
// code must be present, since that's the part nobody could have pre-recorded
// or found online ahead of time.
function transcriptMatchesConsent(transcript, pending) {
  if (!transcript.includes(pending.code)) return false
  const got = new Set(normalizeWords(transcript))
  const expected = normalizeWords(pending.phrase)
  const hits = expected.filter((w) => got.has(w)).length
  return hits / expected.length >= 0.5
}

async function fishRequest(path, options) {
  const key = await fishAudioKey()
  if (!key) {
    const err = new Error('Voice cloning needs a Fish Audio key — ask an admin to add one in Admin → AI Providers.')
    err.status = 501
    throw err
  }
  return fetch(`https://api.fish.audio${path}`, {
    ...options,
    headers: { ...(options?.headers || {}), Authorization: `Bearer ${key}` },
  })
}

export async function listVoiceClones(userId) {
  const raw = await storage.getSetting(`voice_clones:${userId}`)
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveVoiceClones(userId, clones) {
  if (clones.length) await storage.setSetting(`voice_clones:${userId}`, JSON.stringify(clones))
  else await storage.deleteSetting(`voice_clones:${userId}`)
}

/**
 * Creates a cloned voice from an audio sample, but ONLY after verifying the
 * user just spoke their own fresh consent code (see issueConsentPhrase). The
 * consent clip doubles as one of the voice samples fed to Fish Audio, since
 * it's a real recording of the same person's voice either way.
 */
export async function createVoiceClone(user, { title, consentAudio, consentMimetype, sampleAudio, sampleMimetype }) {
  const pending = pendingConsent.get(user.id)
  if (!pending || pending.expiresAt < Date.now()) {
    const err = new Error('Your consent code expired — request a new phrase and try again.')
    err.status = 400
    throw err
  }
  const transcript = await transcribeAudio(consentAudio, 'consent.webm', consentMimetype)
  if (!transcriptMatchesConsent(transcript, pending)) {
    const err = new Error(
      "We couldn't confirm you spoke the consent phrase clearly — please try again, reading it exactly as shown.",
    )
    err.status = 400
    throw err
  }
  pendingConsent.delete(user.id)

  const cleanTitle = title?.trim() || `${user.name || 'My'} voice`
  const form = new FormData()
  form.append('type', 'tts')
  form.append('title', cleanTitle)
  form.append(
    'description',
    `Cloned via Bermi AI by ${user.name || user.email}. Consent verified ${new Date().toISOString()}: "${transcript.slice(0, 200)}"`,
  )
  form.append('visibility', 'private')
  form.append('train_mode', 'fast')
  form.append('voices', new Blob([sampleAudio], { type: sampleMimetype || 'audio/webm' }), 'sample.webm')
  if (Buffer.compare(sampleAudio, consentAudio) !== 0) {
    form.append('voices', new Blob([consentAudio], { type: consentMimetype || 'audio/webm' }), 'consent.webm')
  }

  const res = await fishRequest('/model', { method: 'POST', body: form })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`Fish Audio could not create the voice model (${res.status}): ${detail}`)
  }
  const body = await res.json()

  const clones = await listVoiceClones(user.id)
  const entry = { id: randomUUID(), fishModelId: body._id, title: cleanTitle, createdAt: new Date().toISOString() }
  clones.push(entry)
  await saveVoiceClones(user.id, clones)
  return entry
}

export async function deleteVoiceClone(userId, id) {
  const clones = await listVoiceClones(userId)
  const entry = clones.find((c) => c.id === id)
  if (!entry) {
    const err = new Error('Voice not found')
    err.status = 404
    throw err
  }
  try {
    await fishRequest(`/model/${entry.fishModelId}`, { method: 'DELETE' })
  } catch {
    /* best-effort — still drop it from this user's own list below */
  }
  await saveVoiceClones(userId, clones.filter((c) => c.id !== id))
}
