import { Router } from 'express'
import { storage } from '../storage/index.js'
import { apiKeyInfo } from '../openrouter.js'

export const settingsRouter = Router()

const PROFILE_KEYS = ['profile_name', 'profile_role', 'profile_preferences']

// Only masked metadata about the key is ever returned; the key itself
// stays server-side.
settingsRouter.get('/settings', async (_req, res, next) => {
  try {
    const [info, ...profileValues] = await Promise.all([
      apiKeyInfo(),
      ...PROFILE_KEYS.map((k) => storage.getSetting(k)),
    ])
    res.json({
      ...info,
      storageBackend: storage.backend(),
      profile: {
        name: profileValues[0] ?? '',
        role: profileValues[1] ?? '',
        preferences: profileValues[2] ?? '',
      },
    })
  } catch (err) {
    next(err)
  }
})

settingsRouter.put('/settings/profile', async (req, res, next) => {
  try {
    const { name = '', role = '', preferences = '' } = req.body ?? {}
    const values = [name, role, preferences].map((v) => String(v ?? '').slice(0, 2000))
    await Promise.all(
      PROFILE_KEYS.map((k, i) =>
        values[i] ? storage.setSetting(k, values[i]) : storage.deleteSetting(k),
      ),
    )
    res.json({ profile: { name: values[0], role: values[1], preferences: values[2] } })
  } catch (err) {
    next(err)
  }
})

settingsRouter.put('/settings/api-key', async (req, res, next) => {
  try {
    const { apiKey } = req.body ?? {}
    if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return res.status(400).json({ error: 'A valid API key is required' })
    }
    await storage.setSetting('openrouter_api_key', apiKey.trim())
    res.json(await apiKeyInfo())
  } catch (err) {
    next(err)
  }
})

settingsRouter.delete('/settings/api-key', async (_req, res, next) => {
  try {
    await storage.deleteSetting('openrouter_api_key')
    res.json(await apiKeyInfo())
  } catch (err) {
    next(err)
  }
})
