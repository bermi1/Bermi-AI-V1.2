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

function isHttps(req) {
  return Boolean(
    req?.secure || String(req?.headers['x-forwarded-proto'] || '').split(',')[0] === 'https',
  )
}

/**
 * Cookie flags follow the actual protocol, not NODE_ENV: `Secure` on plain
 * HTTP makes browsers silently drop the cookie (the classic "signup succeeds
 * but you are never logged in" failure). On HTTPS we use SameSite=None so
 * embedded/proxied contexts work too.
 */
export function setSessionCookie(res, token, req) {
  const secure = isHttps(req)
  const attrs = secure ? 'SameSite=None; Secure' : 'SameSite=Lax'
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; ${attrs}; Max-Age=${SESSION_DAYS * 86400}`,
  )
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

export async function createSessionFor(userId, days = SESSION_DAYS) {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  await storage.createSession({
    token,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + days * 86400_000).toISOString(),
  })
  return token
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    is_guest: Boolean(user.is_guest) || String(user.email || '').endsWith('@guest.bermi.ai'),
  }
}

/**
 * Resolves the session cookie to req.user (or null). Kept cheap: one session
 * lookup + one user lookup per request.
 */
export async function attachUser(req, _res, next) {
  try {
    req.user = null
    // Cookie first; Authorization: Bearer and ?token= are fallbacks for
    // contexts where cookies are blocked (iframes, some mobile webviews).
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null
    const token =
      parseCookies(req)[SESSION_COOKIE] ||
      bearer ||
      (typeof req.query?.token === 'string' ? req.query.token : null)
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

/**
 * Gate for routes that need a verified email. Only enforced while an email
 * transport is configured, so removing email config never locks users out.
 */
export function requireVerified(emailEnabled) {
  return (req, res, next) => {
    if (emailEnabled() && !req.user.email_verified) {
      return res.status(403).json({ error: 'Email not verified', code: 'unverified' })
    }
    next()
  }
}

export { randomUUID }
