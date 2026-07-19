import type {
  Conversation,
  DocumentDetail,
  DocumentSummary,
  DocumentVersion,
  InvoiceData,
  Message,
  ModelOption,
  SettingsInfo,
} from './types'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.error || detail
    } catch {
      /* not json */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
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
