import { Router } from 'express'
import { deleteSetting, setSetting } from '../db.js'
import { apiKeyInfo } from '../openrouter.js'

export const settingsRouter = Router()

// Only masked metadata about the key is ever returned; the key itself
// stays server-side.
settingsRouter.get('/settings', (_req, res) => {
  res.json(apiKeyInfo())
})

settingsRouter.put('/settings/api-key', (req, res) => {
  const { apiKey } = req.body ?? {}
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return res.status(400).json({ error: 'A valid API key is required' })
  }
  setSetting('openrouter_api_key', apiKey.trim())
  res.json(apiKeyInfo())
})

settingsRouter.delete('/settings/api-key', (_req, res) => {
  deleteSetting('openrouter_api_key')
  res.json(apiKeyInfo())
})
