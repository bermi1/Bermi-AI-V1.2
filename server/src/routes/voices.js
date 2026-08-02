import { Router } from 'express'
import multer from 'multer'
import { rateLimit } from '../rateLimit.js'
import { issueConsentPhrase, createVoiceClone, listVoiceClones, deleteVoiceClone } from '../voices.js'

export const voicesRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

voicesRouter.get('/voices', async (req, res, next) => {
  try {
    res.json(await listVoiceClones(req.user.id))
  } catch (err) {
    next(err)
  }
})

// A fresh, random spoken phrase the user must read aloud before cloning —
// the real anti-impersonation gate (see voices.js for why).
voicesRouter.post(
  '/voices/consent-phrase',
  rateLimit({ windowMs: 60_000, max: 10, message: 'Too many attempts — wait a moment and try again.' }),
  (req, res) => {
    res.json(issueConsentPhrase(req.user.id))
  },
)

voicesRouter.post(
  '/voices',
  rateLimit({ windowMs: 60 * 60_000, max: 5, message: "You've created a few voices already — try again later." }),
  upload.fields([
    { name: 'consent', maxCount: 1 },
    { name: 'sample', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const consentFile = req.files?.consent?.[0]
      const sampleFile = req.files?.sample?.[0] || consentFile
      if (!consentFile) {
        return res.status(400).json({ error: 'A recording of you speaking the consent phrase is required' })
      }
      const entry = await createVoiceClone(req.user, {
        title: req.body?.title,
        consentAudio: consentFile.buffer,
        consentMimetype: consentFile.mimetype,
        sampleAudio: sampleFile.buffer,
        sampleMimetype: sampleFile.mimetype,
      })
      res.status(201).json(entry)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      next(err)
    }
  },
)

voicesRouter.delete('/voices/:id', async (req, res, next) => {
  try {
    await deleteVoiceClone(req.user.id, req.params.id)
    res.json({ ok: true })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})
