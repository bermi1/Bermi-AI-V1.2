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
  Message,
  ModelOption,
  Profile,
  SettingsInfo,
} from './types'

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
  fetch('/api/auth/me').then((r) =>
    json<{ user: AuthUser; verificationRequired: boolean }>(r),
  )

export const verifyEmail = (code: string) =>
  fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then((r) => json<{ user: AuthUser }>(r))

export const resendVerification = (email?: string) =>
  fetch('/api/auth/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email } : {}),
  }).then((r) => json<{ ok: true }>(r))

export const signup = (name: string, email: string, password: string) =>
  fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  }).then((r) =>
    json<{ user?: AuthUser; needsConfirmation?: boolean; email?: string }>(r),
  )

export const login = (email: string, password: string) =>
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => json<{ user: AuthUser }>(r))

export const logout = () =>
  fetch('/api/auth/logout', { method: 'POST' }).then((r) => json<{ ok: true }>(r))

// ---------- File extraction (chat uploads) ----------

export const extractFile = (file: File): Promise<Attachment> => {
  const form = new FormData()
  form.append('file', file)
  return fetch('/api/extract', { method: 'POST', body: form }).then((r) => json<Attachment>(r))
}

// ---------- Conversations ----------

export const listConversations = () =>
  fetch('/api/conversations').then((r) => json<Conversation[]>(r))

export const getMessages = (conversationId: string) =>
  fetch(`/api/conversations/${conversationId}/messages`).then((r) => json<Message[]>(r))

export const deleteConversation = (conversationId: string) =>
  fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' }).then((r) =>
    json<{ ok: true }>(r),
  )

export const renameConversation = (conversationId: string, title: string) =>
  fetch(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }).then((r) => json<Conversation>(r))

// ---------- Models & settings ----------

export const listModels = () => fetch('/api/models').then((r) => json<ModelOption[]>(r))

export const getSettings = () => fetch('/api/settings').then((r) => json<SettingsInfo>(r))

export const saveApiKey = (apiKey: string) =>
  fetch('/api/settings/api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  }).then((r) => json<SettingsInfo>(r))

export const clearApiKey = () =>
  fetch('/api/settings/api-key', { method: 'DELETE' }).then((r) => json<SettingsInfo>(r))

export const saveProfile = (profile: Profile) =>
  fetch('/api/settings/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }).then((r) => json<{ profile: Profile }>(r))

export const addCustomModel = (id: string, label?: string) =>
  fetch('/api/models/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, label }),
  }).then((r) => json<ModelOption[]>(r))

export const removeCustomModel = (id: string) =>
  fetch(`/api/models/custom?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) =>
    json<ModelOption[]>(r),
  )

// ---------- Brains ----------

export const listBrains = () => fetch('/api/brains').then((r) => json<Brain[]>(r))

export const saveBrain = (id: string, content: string, enabled: boolean) =>
  fetch(`/api/brains/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, enabled }),
  }).then((r) => json<Brain>(r))

// ---------- Connectors ----------

export const listConnectors = () => fetch('/api/connectors').then((r) => json<Connector[]>(r))

export const disconnectConnector = (id: string) =>
  fetch(`/api/connectors/${id}/disconnect`, { method: 'POST' }).then((r) => json<{ ok: true }>(r))

export const googleAuthUrl = () => '/api/connectors/google/auth'

export const fetchGmailMessages = () =>
  fetch('/api/connectors/google/gmail/messages').then((r) => json<GmailMessage[]>(r))

// ---------- Chat streaming ----------

export interface ChatStreamCallbacks {
  onConversation: (conversation: Conversation) => void
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (message: string) => void
}

/**
 * Streams a chat completion over SSE. The full history lives server-side per
 * conversation; the server replays it to OpenRouter on every request (the LLM
 * API itself is stateless).
 */
export async function streamChat(
  params: { conversationId: string | null; message: string; model: string },
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let full = ''
  try {
    const res = await fetch('/api/chat', {
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
        }
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        if (parsed.type === 'conversation' && parsed.conversation) {
          callbacks.onConversation(parsed.conversation)
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

export const listDocuments = () => fetch('/api/documents').then((r) => json<DocumentSummary[]>(r))

export const getDocument = (id: string, version?: number) =>
  fetch(`/api/documents/${id}${version ? `?version=${version}` : ''}`).then((r) =>
    json<DocumentDetail>(r),
  )

export const listDocumentVersions = (id: string) =>
  fetch(`/api/documents/${id}/versions`).then((r) => json<DocumentVersion[]>(r))

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
  fetch('/api/documents/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => json<DocumentDetail>(r))

export const updateDocument = (id: string, data: InvoiceData, status?: 'draft' | 'final') =>
  fetch(`/api/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, status }),
  }).then((r) => json<DocumentDetail>(r))

export const deleteDocument = (id: string) =>
  fetch(`/api/documents/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

export const documentPdfUrl = (id: string, version?: number) =>
  `/api/documents/${id}/pdf${version ? `?version=${version}` : ''}`
