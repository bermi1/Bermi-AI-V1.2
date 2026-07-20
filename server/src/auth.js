import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { storage } from './storage/index.js'

const scrypt = promisify(scryptCb)
const SESSION_COOKIE = 'bermi_session'
const SESSION_DAYS = 30

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const derived = await scrypt(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return expected.length === derived.length && timingSafeEqual(derived, expected)
}

export function parseCookies(req) {
  const header = req.headers.cookie
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((part) => {
      const idx = part.indexOf('=')
      return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())]
    }),
  )
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`,
  )
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

export async function createSessionFor(userId) {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  await storage.createSession({
    token,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_DAYS * 86400_000).toISOString(),
  })
  return token
}

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email }
}

/**
 * Resolves the session cookie to req.user (or null). Kept cheap: one session
 * lookup + one user lookup per request.
 */
export async function attachUser(req, _res, next) {
  try {
    req.user = null
    const token = parseCookies(req)[SESSION_COOKIE]
    if (token) {
      const session = await storage.getSession(token)
      if (session && new Date(session.expires_at).getTime() > Date.now()) {
        const user = await storage.getUserById(session.user_id)
        if (user) {
          req.user = user
          req.sessionToken = token
        }
      }
    }
    next()
  } catch (err) {
    next(err)
  }
}

/** Gate for API routes that require a signed-in user. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' })
  next()
}

export { randomUUID }
