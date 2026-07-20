import { Router } from 'express'
import { storage } from '../storage/index.js'
import { apiKeyInfo } from '../openrouter.js'

export const settingsRouter = Router()

const PROFILE_FIELDS = ['name', 'role', 'preferences']
const profileKey = (userId, field) => `u:${userId}:profile_${field}`

/**
 * AI access is managed centrally: the server's OPENROUTER_API_KEY powers all
 * users, so no key material or key management is ever exposed to clients —
 * only whether AI is ready.
 */
settingsRouter.get('/settings', async (req, res, next) => {
  try {
    const [info, ...profileValues] = await Promise.all([
      apiKeyInfo(),
      ...PROFILE_FIELDS.map((f) => storage.getSetting(profileKey(req.user.id, f))),
    ])
    res.json({
      aiReady: info.hasApiKey,
      storageBackend: storage.backend(),
      account: { name: req.user.name, email: req.user.email },
      profile: {
        name: profileValues[0] ?? req.user.name ?? '',
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
      PROFILE_FIELDS.map((f, i) =>
        values[i]
          ? storage.setSetting(profileKey(req.user.id, f), values[i])
          : storage.deleteSetting(profileKey(req.user.id, f)),
      ),
    )
    res.json({ profile: { name: values[0], role: values[1], preferences: values[2] } })
  } catch (err) {
    next(err)
  }
})
