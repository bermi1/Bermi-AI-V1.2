import { Router } from 'express'
import { storage } from '../storage/index.js'
import { hashPassword } from '../auth.js'
import { providerHealth } from '../openrouter.js'
import { MANAGED_KEY_PROVIDERS, addStoredKey, removeStoredKey, envKeyCount } from '../providers.js'
import { MANAGED_TTS_PROVIDERS, ttsProviderStatus } from '../tts.js'

export const adminRouter = Router()

// Admins are identified by email allowlist (comma-separated ADMIN_EMAILS, with
// the platform owners as a built-in default). Kept simple and role-free.
const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS || 'multiverselimited01@gmail.com,basilrealestatecompany@gmail.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdmin(user) {
  return Boolean(user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()))
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
  next()
}

// Any signed-in user can ask whether they are an admin (drives the UI).
adminRouter.get('/admin/me', (req, res) => res.json({ isAdmin: isAdmin(req.user) }))

// Platform overview: aggregate stats + the full user list.
adminRouter.get('/admin/overview', requireAdmin, async (_req, res, next) => {
  try {
    const [stats, users] = await Promise.all([storage.adminStats(), storage.listUsers()])
    res.json({ stats, users })
  } catch (err) {
    next(err)
  }
})

// AI provider/quota capacity — watch this during a launch to see pressure
// building on the shared free-tier pool before users start hitting errors.
adminRouter.get('/admin/providers', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await providerHealth())
  } catch (err) {
    next(err)
  }
})

// Admin-manageable API keys: lets an admin widen the shared AI quota pool
// (or wire up a new TTS provider) directly from the product, without
// needing Vercel dashboard access — keys added here are stored in the
// database and merged with whatever's set as an env var (see
// providers.js#envOrSetting).
adminRouter.get('/admin/provider-keys', requireAdmin, async (_req, res, next) => {
  try {
    const chat = await Promise.all(
      MANAGED_KEY_PROVIDERS.map(async (p) => {
        const raw = await storage.getSetting(p.settingKey)
        const storedKeys = raw ? raw.split(/[,\s]+/).filter(Boolean).map((k) => `…${k.slice(-4)}`) : []
        return { id: p.id, label: p.label, envKeys: envKeyCount(p.envBase), storedKeys }
      }),
    )
    res.json({ chat, tts: await ttsProviderStatus() })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/admin/provider-keys', requireAdmin, async (req, res, next) => {
  try {
    const { provider, key } = req.body ?? {}
    const all = [...MANAGED_KEY_PROVIDERS, ...MANAGED_TTS_PROVIDERS]
    const p = all.find((x) => x.id === provider)
    if (!p) return res.status(400).json({ error: 'Unknown provider' })
    const keys = await addStoredKey(p.settingKey, key)
    res.status(201).json({ ok: true, count: keys.length })
  } catch (err) {
    if (err.message === 'Key is required') return res.status(400).json({ error: err.message })
    next(err)
  }
})

adminRouter.delete('/admin/provider-keys/:provider/:index', requireAdmin, async (req, res, next) => {
  try {
    const all = [...MANAGED_KEY_PROVIDERS, ...MANAGED_TTS_PROVIDERS]
    const p = all.find((x) => x.id === req.params.provider)
    if (!p) return res.status(400).json({ error: 'Unknown provider' })
    await removeStoredKey(p.settingKey, Number(req.params.index))
    res.json({ ok: true })
  } catch (err) {
    if (err.message === 'No such key') return res.status(404).json({ error: err.message })
    next(err)
  }
})

// Per-user hourly AI-message quota (see routes/chat.js#quotaGate) — how many
// messages each signed-in user can draw from the shared provider pool per
// hour. Admin-adjustable so it can be raised as more provider keys are added.
adminRouter.get('/admin/quota', requireAdmin, async (_req, res, next) => {
  try {
    const stored = Number(await storage.getSetting('chat_quota_per_hour'))
    res.json({ perHour: stored > 0 ? stored : 40, isDefault: !(stored > 0) })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/admin/quota', requireAdmin, async (req, res, next) => {
  try {
    const perHour = Number(req.body?.perHour)
    if (!(perHour > 0)) return res.status(400).json({ error: 'perHour must be a positive number' })
    await storage.setSetting('chat_quota_per_hour', String(Math.floor(perHour)))
    res.json({ ok: true, perHour: Math.floor(perHour) })
  } catch (err) {
    next(err)
  }
})

// Edit a user's name / verified state.
adminRouter.patch('/admin/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const { email_verified, name } = req.body ?? {}
    const patch = {}
    if (typeof email_verified === 'boolean') patch.email_verified = email_verified
    if (typeof name === 'string' && name.trim()) patch.name = name.trim()
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' })
    const u = await storage.updateUser(req.params.id, patch)
    res.json({ id: u.id, name: u.name, email: u.email, email_verified: Boolean(u.email_verified) })
  } catch (err) {
    next(err)
  }
})

// Reset a user's password to an admin-chosen value.
adminRouter.post('/admin/users/:id/password', requireAdmin, async (req, res, next) => {
  try {
    const { password } = req.body ?? {}
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    const user = await storage.getUserById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    await storage.updateUser(req.params.id, { password_hash: await hashPassword(password) })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Delete a user (and their sessions). An admin can't delete themselves here.
adminRouter.delete('/admin/users/:id', requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't delete your own account from here" })
    }
    await storage.deleteUser(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
