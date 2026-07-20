import { Router } from 'express'
import { randomInt, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
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

/**
 * Auth provider selection. Internal auth (scrypt against the active storage
 * backend — including the Supabase database) is the default because it can
 * never be blocked by mail delivery or dashboard configuration: signup always
 * succeeds. Set AUTH_PROVIDER=supabase to delegate credentials + confirmation
 * emails to Supabase Auth instead.
 */
const SUPABASE_AUTH =
  process.env.AUTH_PROVIDER === 'supabase' && storage.backend() === 'supabase'
const supaAuth = SUPABASE_AUTH
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  : null

export const verificationRequired = () => (SUPABASE_AUTH ? false : emailEnabled())

function baseUrl(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
}

function validateSignup(body) {
  const { name, email, password } = body ?? {}
  if (typeof name !== 'string' || !name.trim()) return 'Name is required'
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return 'A valid email is required'
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  return null
}

async function startAppSession(req, res, user) {
  const token = await createSessionFor(user.id)
  setSessionCookie(res, token, req)
  return token
}

// ---------------------------------------------------------------------------
// Supabase Auth flow — confirmation email comes from Supabase directly.
// ---------------------------------------------------------------------------

async function supabaseSignup(req, res) {
  const invalid = validateSignup(req.body)
  if (invalid) return res.status(400).json({ error: invalid })
  const name = req.body.name.trim()
  const email = req.body.email.trim().toLowerCase()

  const { data, error } = await supaAuth.auth.signUp({
    email,
    password: req.body.password,
    options: { data: { name }, emailRedirectTo: baseUrl(req) },
  })
  if (error) {
    const status = /already|registered/i.test(error.message) ? 409 : 400
    return res.status(status).json({ error: error.message })
  }

  // Supabase returns identities: [] for repeated signups of an existing email.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return res.status(409).json({ error: 'An account with this email already exists — sign in instead' })
  }

  const verified = Boolean(data.user?.email_confirmed_at)
  const row = {
    id: data.user.id,
    name,
    email,
    password_hash: null,
    email_verified: verified,
    created_at: new Date().toISOString(),
  }
  await storage.upsertUser(row)
  await storage.setSetting(`u:${row.id}:profile_name`, name)

  if (data.session || verified) {
    // Email confirmations are disabled on the project — sign straight in.
    const token = await startAppSession(req, res, row)
    return res.status(201).json({ user: publicUser({ ...row, email_verified: true }), token })
  }
  // Confirmation email sent by Supabase; the user signs in after clicking it.
  return res.status(201).json({ needsConfirmation: true, email })
}

async function supabaseLogin(req, res) {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  const normalized = email.trim().toLowerCase()
  const { data, error } = await supaAuth.auth.signInWithPassword({
    email: normalized,
    password,
  })
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return res.status(403).json({
        error: 'Please confirm your email first — check your inbox for the Supabase link.',
        code: 'unconfirmed',
        email: normalized,
      })
    }
    return res.status(401).json({ error: 'Incorrect email or password' })
  }

  const su = data.user
  const row = {
    id: su.id,
    name: su.user_metadata?.name || normalized.split('@')[0],
    email: normalized,
    password_hash: null,
    email_verified: true,
    created_at: su.created_at ?? new Date().toISOString(),
  }
  await storage.upsertUser(row)
  const token = await startAppSession(req, res, row)
  res.json({ user: publicUser(row), token })
}

async function supabaseResend(req, res) {
  const { email } = req.body ?? {}
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email is required' })
  }
  const { error } = await supaAuth.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: baseUrl(req) },
  })
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Local flow (SQLite / offline dev) — scrypt passwords, optional SMTP codes.
// ---------------------------------------------------------------------------

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

async function localSignup(req, res) {
  const invalid = validateSignup(req.body)
  if (invalid) return res.status(400).json({ error: invalid })
  const name = req.body.name.trim()
  const normalized = req.body.email.trim().toLowerCase()
  if (await storage.getUserByEmail(normalized)) {
    return res.status(409).json({ error: 'An account with this email already exists' })
  }

  const needsVerification = emailEnabled()
  const user = await storage.createUser({
    id: randomUUID(),
    name,
    email: normalized,
    password_hash: await hashPassword(req.body.password),
    email_verified: !needsVerification,
    created_at: new Date().toISOString(),
  })
  await storage.setSetting(`u:${user.id}:profile_name`, user.name)

  if (needsVerification) {
    try {
      await issueVerification(req, user)
    } catch (err) {
      console.error('Verification email failed:', err.message)
    }
  }

  const token = await startAppSession(req, res, user)
  res.status(201).json({ user: publicUser(user), token })
}

async function localLogin(req, res) {
  const { email, password } = req.body ?? {}
  const user =
    typeof email === 'string' ? await storage.getUserByEmail(email.trim().toLowerCase()) : null
  if (!user || !(await verifyPassword(String(password ?? ''), user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' })
  }
  const token = await startAppSession(req, res, user)
  res.json({ user: publicUser(user), token })
}

// ---------------------------------------------------------------------------
// Google sign-in (OAuth 2.0 code flow, server-side)
// ---------------------------------------------------------------------------

function googleCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

authRouter.get('/auth/providers', (_req, res) => {
  res.json({
    provider: SUPABASE_AUTH ? 'supabase' : 'internal',
    google: Boolean(googleCreds()),
  })
})

authRouter.get('/auth/google', (req, res) => {
  const creds = googleCreds()
  if (!creds) return res.redirect('/?auth_error=google_not_configured')
  const state = randomUUID()
  res.setHeader(
    'Set-Cookie',
    `bermi_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
  )
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

authRouter.get('/auth/google/callback', async (req, res, next) => {
  try {
    const creds = googleCreds()
    const { code, state, error } = req.query
    const cookieState = (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('bermi_oauth_state='))
      ?.split('=')[1]
    if (error || !code || !creds || !state || state !== cookieState) {
      return res.redirect('/?auth_error=google')
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) return res.redirect('/?auth_error=google')
    const tokens = await tokenRes.json()

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!infoRes.ok) return res.redirect('/?auth_error=google')
    const info = await infoRes.json()
    const email = String(info.email || '').toLowerCase()
    if (!email) return res.redirect('/?auth_error=google')

    let user = await storage.getUserByEmail(email)
    if (!user) {
      user = {
        id: randomUUID(),
        name: info.name || email.split('@')[0],
        email,
        password_hash: null,
        email_verified: true,
        created_at: new Date().toISOString(),
      }
      await storage.upsertUser(user)
      await storage.setSetting(`u:${user.id}:profile_name`, user.name)
    } else if (!user.email_verified) {
      // Google verified this address; unblock any pending local verification.
      await storage.updateUser(user.id, {
        email_verified: true,
        verify_code: null,
        verify_expires: null,
      })
    }

    const token = await startAppSession(req, res, user)
    res.redirect(`/#bermi_token=${token}`)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

authRouter.post('/auth/signup', (req, res, next) =>
  (SUPABASE_AUTH ? supabaseSignup(req, res) : localSignup(req, res)).catch(next),
)

authRouter.post('/auth/login', (req, res, next) =>
  (SUPABASE_AUTH ? supabaseLogin(req, res) : localLogin(req, res)).catch(next),
)

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
  res.json({ user: publicUser(req.user), verificationRequired: verificationRequired() })
})

// Public resend: Supabase mode takes an email (pre-login); local mode uses
// the signed-in session.
authRouter.post('/auth/resend', async (req, res, next) => {
  try {
    if (SUPABASE_AUTH) return await supabaseResend(req, res)
    if (!req.user) return res.status(401).json({ error: 'Not signed in' })
    if (req.user.email_verified) return res.json({ ok: true, already: true })
    if (!emailEnabled()) return res.status(400).json({ error: 'Email is not configured' })
    await issueVerification(req, req.user)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---- Local-mode code verification (unused in Supabase mode) ----

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
