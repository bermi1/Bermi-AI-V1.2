import type {
  Attachment,
  AuthUser,
  Brain,
  Connector,
  Conversation,
  DocumentDetail,
  DocumentSummary,
  DocumentVersion,
  GmailMessage,
  InvoiceData,
  InsightsReport,
  Message,
  ModelOption,
  NicheQuestion,
  NicheReport,
  Profile,
  SettingsInfo,
  StudioDoc,
  StudioFormat,
  StudyStats,
} from './types'


// ---------- Session token fallback ----------
// The httpOnly cookie is the primary session carrier. Where cookies are
// blocked (iframes, some webviews, http->https proxies), auth responses also
// return the token; we keep it and send it as a Bearer header.

const TOKEN_KEY = 'bermi-session-token'

export const getSessionToken = () => localStorage.getItem(TOKEN_KEY)
export const setSessionToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch(
  url: string,
  init?: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const token = getSessionToken()
  const headers = new Headers(init?.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  // Never let a request hang forever: callers that pass their own signal
  // (chat streaming) manage cancellation themselves; everything else times
  // out with an actionable error instead of leaving the UI spinning.
  const signal = init?.signal ?? AbortSignal.timeout(timeoutMs)
  try {
    return await fetch(url, { ...init, headers, signal })
  } catch (err) {
    if (!init?.signal && ((err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError')) {
      throw new ApiError(
        'The server did not respond. Check that the Bermi backend is running and reachable, then try again.',
      )
    }
    if ((err as Error).message === 'Failed to fetch') {
      throw new ApiError('Could not reach the server — check your connection and that the backend is running.')
    }
    throw err
  }
}

export class ApiError extends Error {
  code?: string
  email?: string
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = new ApiError(res.statusText)
    try {
      const body = await res.json()
      err.message = body.error || err.message
      err.code = body.code
      err.email = body.email
    } catch {
      /* not json */
    }
    throw err
  }
  return res.json() as Promise<T>
}

// ---------- Auth ----------

export const authMe = () =>
  apiFetch('/api/auth/me').then((r) =>
    json<{ user: AuthUser; verificationRequired: boolean }>(r),
  )

export const verifyEmail = (code: string) =>
  apiFetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then((r) => json<{ user: AuthUser }>(r))

export const resendVerification = (email?: string) =>
  apiFetch('/api/auth/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email } : {}),
  }).then((r) => json<{ ok: true }>(r))

export const signup = (name: string, email: string, password: string) =>
  apiFetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
    .then((r) =>
      json<{ user?: AuthUser; needsConfirmation?: boolean; email?: string; token?: string }>(r),
    )
    .then((res) => {
      if (res.token) setSessionToken(res.token)
      return res
    })

export const login = (email: string, password: string) =>
  apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
    .then((r) => json<{ user: AuthUser; token?: string }>(r))
    .then((res) => {
      if (res.token) setSessionToken(res.token)
      return res
    })

export const logout = () =>
  apiFetch('/api/auth/logout', { method: 'POST' })
    .then((r) => json<{ ok: true }>(r))
    .finally(() => setSessionToken(null))

export const guestLogin = () =>
  apiFetch('/api/auth/guest', { method: 'POST' })
    .then((r) => json<{ user: AuthUser; token?: string }>(r))
    .then((res) => {
      if (res.token) setSessionToken(res.token)
      return res
    })

// ---------- File extraction (chat uploads) ----------

export const extractFile = (file: File): Promise<Attachment> => {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/api/extract', { method: 'POST', body: form }, 60_000).then((r) =>
    json<Attachment>(r),
  )
}

export const health = () =>
  apiFetch('/api/health', undefined, 6_000).then((r) => json<{ ok: boolean }>(r))

// ---------- Conversations ----------

export const listConversations = () =>
  apiFetch('/api/conversations').then((r) => json<Conversation[]>(r))

export const getMessages = (conversationId: string) =>
  apiFetch(`/api/conversations/${conversationId}/messages`).then((r) => json<Message[]>(r))

export const deleteConversation = (conversationId: string) =>
  apiFetch(`/api/conversations/${conversationId}`, { method: 'DELETE' }).then((r) =>
    json<{ ok: true }>(r),
  )

export const renameConversation = (conversationId: string, title: string) =>
  apiFetch(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }).then((r) => json<Conversation>(r))

// ---------- Models & settings ----------

export const listModels = () => apiFetch('/api/models').then((r) => json<ModelOption[]>(r))

export const getSettings = () => apiFetch('/api/settings').then((r) => json<SettingsInfo>(r))

export const saveApiKey = (apiKey: string) =>
  apiFetch('/api/settings/api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  }).then((r) => json<SettingsInfo>(r))

export const clearApiKey = () =>
  apiFetch('/api/settings/api-key', { method: 'DELETE' }).then((r) => json<SettingsInfo>(r))

export const saveProfile = (profile: Profile) =>
  apiFetch('/api/settings/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }).then((r) => json<{ profile: Profile }>(r))

export const addCustomModel = (id: string, label?: string) =>
  apiFetch('/api/models/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, label }),
  }).then((r) => json<ModelOption[]>(r))

export const removeCustomModel = (id: string) =>
  apiFetch(`/api/models/custom?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) =>
    json<ModelOption[]>(r),
  )

// ---------- Brains ----------

export const listBrains = () => apiFetch('/api/brains').then((r) => json<Brain[]>(r))

export const saveBrain = (id: string, content: string, enabled: boolean, name?: string) =>
  apiFetch(`/api/brains/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, enabled, name }),
  }).then((r) => json<Brain>(r))

export const createBrain = (name: string, content = '') =>
  apiFetch('/api/brains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  }).then((r) => json<Brain>(r))

export const deleteBrain = (id: string) =>
  apiFetch(`/api/brains/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

// ---------- Document Studio ----------

export const generateStudioDoc = (input: {
  title: string
  prompt: string
  kind: string
  format: StudioFormat
}) =>
  apiFetch('/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => json<StudioDoc>(r))

export const getStudioDoc = (id: string) =>
  apiFetch(`/api/studio/${id}`).then((r) => json<StudioDoc>(r))

export const updateStudioDoc = (id: string, patch: { markdown?: string; title?: string }) =>
  apiFetch(`/api/studio/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => json<StudioDoc>(r))

export const studioDownloadUrl = (id: string, format: StudioFormat, version?: number) => {
  const params = new URLSearchParams({ format })
  if (version) params.set('version', String(version))
  const token = getSessionToken()
  if (token) params.set('token', token)
  return `/api/studio/${id}/download?${params.toString()}`
}

// ---------- Insights ----------

export const getInsights = (period: 'day' | 'week') =>
  apiFetch(`/api/insights?period=${period}`).then((r) => json<{ report: InsightsReport | null }>(r))

export const refreshInsights = (period: 'day' | 'week') =>
  apiFetch('/api/insights/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period }),
  }).then((r) => json<{ report: InsightsReport }>(r))

// ---------- Study mode ----------

export const getStudyStats = () =>
  apiFetch('/api/study/stats').then((r) => json<StudyStats>(r))

// ---------- Niche discovery ----------

export const getNicheQuestions = () =>
  apiFetch('/api/niche/questions').then((r) => json<{ questions: NicheQuestion[] }>(r))

export const getNiche = () =>
  apiFetch('/api/niche').then((r) => json<{ report: NicheReport | null }>(r))

export const discoverNiche = (answers: Record<string, string>) =>
  apiFetch('/api/niche/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  }).then((r) => json<{ report: NicheReport }>(r))

// ---------- Data control ----------

export const dataExportUrl = () => {
  const token = getSessionToken()
  return `/api/data/export${token ? `?token=${token}` : ''}`
}

export const wipeData = () =>
  apiFetch('/api/data/wipe', { method: 'POST' }).then((r) => json<{ ok: true }>(r))

export const deleteAccount = () =>
  apiFetch('/api/data/delete-account', { method: 'POST' })
    .then((r) => json<{ ok: true }>(r))
    .finally(() => setSessionToken(null))

// ---------- Connectors ----------

export const listConnectors = () => apiFetch('/api/connectors').then((r) => json<Connector[]>(r))

export const disconnectConnector = (id: string) =>
  apiFetch(`/api/connectors/${id}/disconnect`, { method: 'POST' }).then((r) => json<{ ok: true }>(r))

export const googleAuthUrl = () => '/api/connectors/google/auth'

export const googleLoginUrl = () => '/api/auth/google'

export const authProviders = () =>
  apiFetch('/api/auth/providers').then((r) =>
    json<{ provider: 'internal' | 'supabase'; google: boolean }>(r),
  )

export const resetVibeBrain = () =>
  apiFetch('/api/brains/vibecoding/reset', { method: 'POST' }).then((r) => json<Brain>(r))

export const fetchGmailMessages = () =>
  apiFetch('/api/connectors/google/gmail/messages').then((r) => json<GmailMessage[]>(r))

// ---------- Chat streaming ----------

export interface Citation {
  url: string
  title: string
}

export interface StudyAwardEvent {
  stats: import('./types').StudyStats
  gained: number
  leveledUp: boolean
  newBadges: { id: string; label: string }[]
}

export interface ChatStreamCallbacks {
  onConversation: (conversation: Conversation) => void
  onToken: (token: string) => void
  onStatus?: (label: string | null) => void
  onCitations?: (items: Citation[]) => void
  onStudy?: (award: StudyAwardEvent) => void
  onDone: (fullText: string) => void
  onError: (message: string) => void
}

/**
 * Streams a chat completion over SSE. The full history lives server-side per
 * conversation; the server replays it to OpenRouter on every request (the LLM
 * API itself is stateless).
 */
export async function streamChat(
  params: {
    conversationId: string | null
    message: string
    model: string
    web?: boolean
    study?: boolean
  },
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let full = ''
  try {
    const res = await apiFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    })
    if (!res.ok || !res.body) {
      let detail = `Request failed (${res.status})`
      try {
        const body = await res.json()
        detail = body.error || detail
      } catch {
        /* ignore */
      }
      callbacks.onError(detail)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const dataLine = event
          .split('\n')
          .find((l) => l.startsWith('data: '))
        if (!dataLine) continue
        const payload = dataLine.slice(6)
        if (payload === '[DONE]') continue
        let parsed: {
          type: string
          conversation?: Conversation
          token?: string
          error?: string
          label?: string | null
          items?: Citation[]
          stats?: StudyAwardEvent['stats']
          gained?: number
          leveledUp?: boolean
          newBadges?: { id: string; label: string }[]
        }
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        if (parsed.type === 'conversation' && parsed.conversation) {
          callbacks.onConversation(parsed.conversation)
        } else if (parsed.type === 'status') {
          callbacks.onStatus?.(parsed.label ?? null)
        } else if (parsed.type === 'citations' && parsed.items) {
          callbacks.onCitations?.(parsed.items)
        } else if (parsed.type === 'study' && parsed.stats) {
          callbacks.onStudy?.({
            stats: parsed.stats,
            gained: parsed.gained ?? 0,
            leveledUp: Boolean(parsed.leveledUp),
            newBadges: parsed.newBadges ?? [],
          })
        } else if (parsed.type === 'token' && parsed.token != null) {
          full += parsed.token
          callbacks.onToken(parsed.token)
        } else if (parsed.type === 'error') {
          callbacks.onError(parsed.error || 'Unknown streaming error')
          return
        }
      }
    }
    callbacks.onDone(full)
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onDone(full)
      return
    }
    callbacks.onError((err as Error).message)
  }
}

// ---------- Documents ----------

export const listDocuments = () => apiFetch('/api/documents').then((r) => json<DocumentSummary[]>(r))

export const getDocument = (id: string, version?: number) =>
  apiFetch(`/api/documents/${id}${version ? `?version=${version}` : ''}`).then((r) =>
    json<DocumentDetail>(r),
  )

export const listDocumentVersions = (id: string) =>
  apiFetch(`/api/documents/${id}/versions`).then((r) => json<DocumentVersion[]>(r))

export const createInvoice = (input: {
  client_name: string
  client_details: string
  from_name: string
  from_details: string
  items: { description: string; quantity: number; unit_price: number }[]
  currency: string
  tax_rate: number
  instructions: string
}) =>
  apiFetch('/api/documents/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => json<DocumentDetail>(r))

export const updateDocument = (id: string, data: InvoiceData, status?: 'draft' | 'final') =>
  apiFetch(`/api/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, status }),
  }).then((r) => json<DocumentDetail>(r))

export const deleteDocument = (id: string) =>
  apiFetch(`/api/documents/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

export const documentPdfUrl = (id: string, version?: number) => {
  const params = new URLSearchParams()
  if (version) params.set('version', String(version))
  const token = getSessionToken()
  if (token) params.set('token', token)
  const qs = params.toString()
  return `/api/documents/${id}/pdf${qs ? `?${qs}` : ''}`
}
