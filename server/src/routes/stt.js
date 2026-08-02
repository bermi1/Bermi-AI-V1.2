import { Router } from 'express'
import multer from 'multer'
import { transcribeAudio, sttStatus } from '../stt.js'
import { rateLimit } from '../rateLimit.js'

export const sttRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

// Whether voice input can work at all right now — drives the mic button's
// enabled/disabled state instead of it silently failing on first use.
sttRouter.get('/stt/status', async (_req, res, next) => {
  try {
    res.json(await sttStatus())
  } catch (err) {
    next(err)
  }
})

// Transcription is real provider spend (shares Groq's chat/TTS quota), same
// treatment as /tts: rate-limited separately from ordinary chat.
sttRouter.post(
  '/stt/transcribe',
  rateLimit({ windowMs: 60_000, max: 20, message: "You're sending voice clips a bit fast — try again shortly." }),
  upload.single('audio'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No audio uploaded' })
      const text = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype)
      res.json({ text })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      next(err)
    }
  },
)
