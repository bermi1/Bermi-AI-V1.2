import { Router } from 'express'
import { randomInt, randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import {
  clearSessionCookie,
  createSessionFor,
  hashPassword,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from '../auth.js'
import { emailEnabled, sendMail, verificationEmail } from '../mailer.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_TTL_MS = 30 * 60 * 1000

function baseUrl(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
}

function newCode() {
  return String(randomInt(100000, 1000000))
}

async function issueVerification(req, user) {
  const code = newCode()
  await storage.updateUser(user.id, {
    verify_code: code,
    verify_expires: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })
  const url = baseUrl(req)
  const verifyUrl = `${url}/api/auth/verify-link?email=${encodeURIComponent(user.email)}&code=${code}`
  const mail = verificationEmail({ name: user.name, code, verifyUrl, baseUrl: url })
  await sendMail({ to: user.email, ...mail })
}

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

    // Without an email transport configured, accounts activate immediately.
    const needsVerification = emailEnabled()
    const user = await storage.createUser({
      id: randomUUID(),
      name: name.trim(),
      email: normalized,
      password_hash: await hashPassword(password),
      email_verified: !needsVerification,
      created_at: new Date().toISOString(),
    })
    // Seed the profile so personalization works out of the box.
    await storage.setSetting(`u:${user.id}:profile_name`, user.name)

    if (needsVerification) {
      try {
        await issueVerification(req, user)
      } catch (err) {
        console.error('Verification email failed:', err.message)
      }
    }

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
  res.json({ user: publicUser(req.user), verificationRequired: emailEnabled() })
})

// ---- Email verification ----

async function verifyWithCode(user, code) {
  if (!user || user.email_verified) return Boolean(user)
  if (
    !user.verify_code ||
    String(code) !== String(user.verify_code) ||
    !user.verify_expires ||
    new Date(user.verify_expires).getTime() < Date.now()
  ) {
    return false
  }
  await storage.updateUser(user.id, {
    email_verified: true,
    verify_code: null,
    verify_expires: null,
  })
  return true
}

authRouter.post('/auth/verify', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' })
    const ok = await verifyWithCode(req.user, req.body?.code)
    if (!ok) return res.status(400).json({ error: 'Invalid or expired code — request a new one' })
    const fresh = await storage.getUserById(req.user.id)
    res.json({ user: publicUser(fresh) })
  } catch (err) {
    next(err)
  }
})

// One-click link from the email; works without a session, redirects home.
authRouter.get('/auth/verify-link', async (req, res, next) => {
  try {
    const { email, code } = req.query
    const user =
      typeof email === 'string'
        ? await storage.getUserByEmail(String(email).toLowerCase())
        : null
    const ok = await verifyWithCode(user, code)
    res.redirect(ok ? '/?verified=1' : '/?verified=0')
  } catch (err) {
    next(err)
  }
})

authRouter.post('/auth/resend', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' })
    if (req.user.email_verified) return res.json({ ok: true, already: true })
    if (!emailEnabled()) return res.status(400).json({ error: 'Email is not configured' })
    await issueVerification(req, req.user)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
