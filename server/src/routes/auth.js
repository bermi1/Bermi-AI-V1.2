import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import {
  clearSessionCookie,
  createSessionFor,
  hashPassword,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from '../auth.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

authRouter.post('/auth/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {}
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required' })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    const normalized = email.trim().toLowerCase()
    if (await storage.getUserByEmail(normalized)) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const user = await storage.createUser({
      id: randomUUID(),
      name: name.trim(),
      email: normalized,
      password_hash: await hashPassword(password),
      created_at: new Date().toISOString(),
    })
    // Seed the profile so personalization works out of the box.
    await storage.setSetting(`u:${user.id}:profile_name`, user.name)

    setSessionCookie(res, await createSessionFor(user.id))
    res.status(201).json({ user: publicUser(user) })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}
    const user =
      typeof email === 'string'
        ? await storage.getUserByEmail(email.trim().toLowerCase())
        : null
    if (!user || !(await verifyPassword(String(password ?? ''), user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }
    setSessionCookie(res, await createSessionFor(user.id))
    res.json({ user: publicUser(user) })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/auth/logout', async (req, res, next) => {
  try {
    if (req.sessionToken) await storage.deleteSession(req.sessionToken)
    clearSessionCookie(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' })
  res.json({ user: publicUser(req.user) })
})
