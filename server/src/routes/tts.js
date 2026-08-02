import { Router } from 'express'
import { synthesizeSpeech, ttsProviderStatus } from '../tts.js'
import { rateLimit } from '../rateLimit.js'

export const ttsRouter = Router()

// Which provider (if any) is live, and what it covers — drives the "Listen"
// button so the client can grey it out with a clear reason instead of
// silently failing when nothing is configured.
ttsRouter.get('/tts/status', async (_req, res, next) => {
  try {
    const providers = await ttsProviderStatus()
    res.json({ available: providers.some((p) => p.configured), providers })
  } catch (err) {
    next(err)
  }
})

// Speech synthesis is real provider spend (Fish Audio/ElevenLabs bill per
// character even on paid plans; Groq's free tier still has its own quota) —
// rate-limit separately from ordinary chat.
ttsRouter.post(
  '/tts',
  rateLimit({ windowMs: 60_000, max: 15, message: "You're requesting audio a bit fast — try again shortly." }),
  async (req, res, next) => {
    try {
      const { text, voice, language } = req.body ?? {}
      if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'text is required' })
      }
      const { buffer, mime } = await synthesizeSpeech(text, { voice, language })
      res.setHeader('Content-Type', mime)
      res.send(buffer)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      next(err)
    }
  },
)
