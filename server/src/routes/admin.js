import { Router } from 'express'
import { storage } from '../storage/index.js'
import { hashPassword } from '../auth.js'

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
