import { Router } from 'express'
import { storage } from '../storage/index.js'

export const connectorsRouter = Router()

/**
 * Connector registry. Google is fully implemented (OAuth 2.0 authorization
 * code flow with offline refresh; Gmail/Calendar/Drive read scopes). The
 * others are registered so the UI can present them; each activates once its
 * OAuth credentials are added to the server environment.
 */
const PROVIDERS = {
  google: {
    label: 'Google',
    description: 'Gmail, Calendar, and Drive (read access)',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  },
  slack: {
    label: 'Slack',
    description: 'Channels and messages',
    envVars: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
    comingSoon: true,
  },
  notion: {
    label: 'Notion',
    description: 'Pages and databases',
    envVars: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'],
    comingSoon: true,
  },
  github: {
    label: 'GitHub',
    description: 'Repositories and issues',
    envVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    comingSoon: true,
  },
}

function baseUrl(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
}

function googleCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

connectorsRouter.get('/connectors', async (_req, res, next) => {
  try {
    const connected = await storage.listConnectors()
    const byProvider = new Map(connected.map((c) => [c.provider, c]))
    res.json(
      Object.entries(PROVIDERS).map(([id, def]) => {
        const conn = byProvider.get(id)
        const hasCreds = def.envVars.every((v) => process.env[v])
        return {
          id,
          label: def.label,
          description: def.description,
          status: conn
            ? 'connected'
            : def.comingSoon
              ? 'coming_soon'
              : hasCreds
                ? 'available'
                : 'setup_required',
          account: conn?.account ?? null,
          connected_at: conn?.connected_at ?? null,
        }
      }),
    )
  } catch (err) {
    next(err)
  }
})

// ---- Google OAuth 2.0 (authorization code + refresh token) ----

connectorsRouter.get('/connectors/google/auth', (req, res) => {
  const creds = googleCreds()
  if (!creds) {
    return res
      .status(400)
      .json({ error: 'Google OAuth is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' })
  }
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: `${baseUrl(req)}/api/connectors/google/callback`,
    response_type: 'code',
    scope: PROVIDERS.google.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

connectorsRouter.get('/connectors/google/callback', async (req, res, next) => {
  try {
    const creds = googleCreds()
    const { code, error } = req.query
    if (error || !code || !creds) {
      return res.redirect('/?connector_error=google')
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: `${baseUrl(req)}/api/connectors/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text())
      return res.redirect('/?connector_error=google')
    }
    const tokens = await tokenRes.json()

    let account = null
    try {
      const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (infoRes.ok) account = (await infoRes.json()).email ?? null
    } catch {
      /* account label is cosmetic */
    }

    await storage.upsertConnector({
      provider: 'google',
      status: 'connected',
      account,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      },
      connected_at: new Date().toISOString(),
    })
    res.redirect('/?connected=google')
  } catch (err) {
    next(err)
  }
})

connectorsRouter.post('/connectors/:provider/disconnect', async (req, res, next) => {
  try {
    if (!PROVIDERS[req.params.provider]) {
      return res.status(404).json({ error: 'Unknown connector' })
    }
    await storage.deleteConnector(req.params.provider)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** Returns a valid Google access token, refreshing it if expired. */
async function googleAccessToken() {
  const conn = await storage.getConnector('google')
  if (!conn?.tokens) {
    const err = new Error('Google is not connected')
    err.status = 400
    throw err
  }
  const tokens = typeof conn.tokens === 'string' ? JSON.parse(conn.tokens) : conn.tokens
  if (tokens.expires_at > Date.now() + 30_000) return tokens.access_token

  const creds = googleCreds()
  if (!creds || !tokens.refresh_token) {
    const err = new Error('Google session expired — reconnect the Google connector')
    err.status = 401
    throw err
  }
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!refreshRes.ok) {
    const err = new Error('Google token refresh failed — reconnect the Google connector')
    err.status = 401
    throw err
  }
  const next = await refreshRes.json()
  const updated = {
    ...tokens,
    access_token: next.access_token,
    expires_at: Date.now() + (next.expires_in ?? 3600) * 1000,
  }
  await storage.upsertConnector({ ...conn, provider: 'google', tokens: updated })
  return updated.access_token
}

// Recent Gmail messages (metadata only) — a working proof of the connection.
connectorsRouter.get('/connectors/google/gmail/messages', async (req, res, next) => {
  try {
    const token = await googleAccessToken()
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!listRes.ok) throw new Error(`Gmail API error (${listRes.status})`)
    const { messages = [] } = await listRes.json()
    const details = await Promise.all(
      messages.map(async (m) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!r.ok) return null
        const msg = await r.json()
        const header = (name) =>
          msg.payload?.headers?.find((h) => h.name === name)?.value ?? ''
        return {
          id: m.id,
          subject: header('Subject'),
          from: header('From'),
          date: header('Date'),
          snippet: msg.snippet ?? '',
        }
      }),
    )
    res.json(details.filter(Boolean))
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})
