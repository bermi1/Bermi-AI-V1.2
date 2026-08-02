import type {
  Attachment,
  AuthUser,
  Brain,
  Certificate,
  Connector,
  Conversation,
  Course,
  DocumentDetail,
  DocumentSummary,
  DocumentVersion,
  Enrollment,
  GmailMessage,
  Institution,
  InstitutionAnalytics,
  InstitutionLearner,
  InvoiceData,
  InsightsReport,
  Lesson,
  Message,
  ModelOption,
  NicheQuestion,
  NicheReport,
  OfferingKind,
  OrgType,
  Profile,
  QuizQuestion,
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

export const resetVibeBrain = () =>
  apiFetch('/api/brains/vibecoding/reset', { method: 'POST' }).then((r) => json<Brain>(r))

export const fetchGmailMessages = () =>
  apiFetch('/api/connectors/google/gmail/messages').then((r) => json<GmailMessage[]>(r))

// ---------- Message feedback (like / dislike) ----------

export const sendFeedback = (messageId: string, value: 'up' | 'down' | null) =>
  apiFetch('/api/chat/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, value }),
  })
    .then((r) => json<{ ok: true }>(r))
    .catch(() => ({ ok: true as const }))

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
  onEnrolled?: (info: { courseId: string; courseTitle: string; kind?: string }) => void
  onDone: (fullText: string) => void
  onError: (message: string, retryAfter?: number | null) => void
}

export interface ChatQuota {
  used: number
  max: number
  remaining: number
  resetAt: number
}

/** The current user's slice of the shared hourly AI-message pool. */
export const getChatQuota = () => apiFetch('/api/chat/quota').then((r) => json<ChatQuota>(r))

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
    attachments?: { name: string; text: string }[]
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
      let retryAfter: number | null = null
      try {
        const body = await res.json()
        detail = body.error || detail
        if (typeof body.retryAfter === 'number') retryAfter = body.retryAfter
      } catch {
        /* ignore */
      }
      callbacks.onError(detail, retryAfter)
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
          courseId?: string
          courseTitle?: string
          kind?: string
          retryAfter?: number | null
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
        } else if (parsed.type === 'enrolled' && parsed.courseId && parsed.courseTitle) {
          callbacks.onEnrolled?.({ courseId: parsed.courseId, courseTitle: parsed.courseTitle, kind: parsed.kind })
        } else if (parsed.type === 'token' && parsed.token != null) {
          full += parsed.token
          callbacks.onToken(parsed.token)
        } else if (parsed.type === 'error') {
          callbacks.onError(parsed.error || 'Unknown streaming error', parsed.retryAfter)
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

// ---------- Admin ----------

export interface AdminUser {
  id: string
  name: string
  email: string
  email_verified: boolean
  created_at: string
}

export interface AdminStats {
  users: number
  conversations: number
  messages: number
  documents: number
  institutions: number
  courses: number
  enrollments: number
  certificates: number
}

export const adminMe = () =>
  apiFetch('/api/admin/me')
    .then((r) => json<{ isAdmin: boolean }>(r))
    .catch(() => ({ isAdmin: false }))

export const adminOverview = () =>
  apiFetch('/api/admin/overview').then((r) => json<{ stats: AdminStats; users: AdminUser[] }>(r))

export const adminUpdateUser = (id: string, patch: { email_verified?: boolean; name?: string }) =>
  apiFetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => json<AdminUser>(r))

export const adminResetPassword = (id: string, password: string) =>
  apiFetch(`/api/admin/users/${id}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((r) => json<{ ok: true }>(r))

export const adminDeleteUser = (id: string) =>
  apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

export interface ProviderHealth {
  id: string
  totalKeys: number
  coolingKeys: number
  nextRetryInSeconds: number | null
}

export const adminProviders = () =>
  apiFetch('/api/admin/providers').then((r) => json<ProviderHealth[]>(r))

export interface TtsProviderInfo {
  id: string
  label: string
  configured: boolean
  managed: boolean
  languages: string
}

export interface ManagedKeyProviderInfo {
  id: string
  label: string
  envKeys: number
  storedKeys: string[]
}

export interface AdminProviderKeys {
  chat: ManagedKeyProviderInfo[]
  search: ManagedKeyProviderInfo[]
  tts: TtsProviderInfo[]
}

export const adminProviderKeys = () =>
  apiFetch('/api/admin/provider-keys').then((r) => json<AdminProviderKeys>(r))

export const adminAddProviderKey = (provider: string, key: string) =>
  apiFetch('/api/admin/provider-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key }),
  }).then((r) => json<{ ok: true; count: number }>(r))

export const adminGetQuota = () =>
  apiFetch('/api/admin/quota').then((r) => json<{ perHour: number; isDefault: boolean }>(r))

export const adminSetQuota = (perHour: number) =>
  apiFetch('/api/admin/quota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ perHour }),
  }).then((r) => json<{ ok: true; perHour: number }>(r))

export const adminDeleteProviderKey = (provider: string, index: number) =>
  apiFetch(`/api/admin/provider-keys/${provider}/${index}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

// ---------- Text-to-speech ----------

export const ttsStatus = () =>
  apiFetch('/api/tts/status').then((r) => json<{ available: boolean; providers: TtsProviderInfo[] }>(r))

export async function synthesizeSpeech(text: string, opts?: { voice?: string; language?: string }): Promise<Blob> {
  const res = await apiFetch(
    '/api/tts',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...opts }),
    },
    30_000,
  )
  if (!res.ok) {
    const err = new ApiError(res.statusText)
    try {
      const body = await res.json()
      err.message = body.error || err.message
    } catch {
      /* not json */
    }
    throw err
  }
  return res.blob()
}

// ---------- Speech-to-text (voice input) ----------

export const sttStatus = () => apiFetch('/api/stt/status').then((r) => json<{ available: boolean }>(r))

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('audio', blob, 'clip.webm')
  const res = await apiFetch('/api/stt/transcribe', { method: 'POST', body: form }, 30_000)
  const body = await json<{ text: string }>(res)
  return body.text
}

// ---------- Voice cloning ----------

export interface VoiceClone {
  id: string
  fishModelId: string
  title: string
  createdAt: string
}

export const listVoiceClones = () => apiFetch('/api/voices').then((r) => json<VoiceClone[]>(r))

export const requestVoiceConsentPhrase = () =>
  apiFetch('/api/voices/consent-phrase', { method: 'POST' }).then((r) =>
    json<{ phrase: string; expiresInSeconds: number }>(r),
  )

export async function createVoiceClone(params: { title: string; consent: Blob; sample?: Blob }): Promise<VoiceClone> {
  const form = new FormData()
  form.append('title', params.title)
  form.append('consent', params.consent, 'consent.webm')
  if (params.sample) form.append('sample', params.sample, 'sample.webm')
  const res = await apiFetch('/api/voices', { method: 'POST', body: form }, 60_000)
  return json<VoiceClone>(res)
}

export const deleteVoiceClone = (id: string) =>
  apiFetch(`/api/voices/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

// ---------- Bermi Learn (LMS) ----------

// Public catalog + course browsing
export const learnCatalog = () =>
  apiFetch('/api/learn/catalog').then((r) =>
    json<{ institutions: Institution[]; courses: Course[] }>(r),
  )

export const learnInstitutionBySlug = (slug: string) =>
  apiFetch(`/api/learn/institutions/${slug}`).then((r) =>
    json<{ institution: Institution; courses: Course[] }>(r),
  )

export const learnCourse = (id: string) =>
  apiFetch(`/api/learn/courses/${id}`).then((r) =>
    json<{
      course: Course
      institution: { name: string; slug: string; about: string } | null
      lessons: Lesson[]
      enrollment: Enrollment | null
    }>(r),
  )

// Learner
export const learnMyEnrollments = () =>
  apiFetch('/api/learn/my/enrollments').then((r) => json<Enrollment[]>(r))

export const learnEnroll = (courseId: string) =>
  apiFetch(`/api/learn/courses/${courseId}/enroll`, { method: 'POST' }).then((r) =>
    json<Enrollment>(r),
  )

export const learnLessonStudy = (lessonId: string) =>
  apiFetch(`/api/learn/lessons/${lessonId}/study`).then((r) =>
    json<{ lesson: Lesson; enrollment: Enrollment }>(r),
  )

// Correct answers are never sent to the client — grading happens server-side
// via applyLessonCompletion.
export const learnLessonQuiz = (lessonId: string) =>
  apiFetch(`/api/learn/lessons/${lessonId}/quiz`, undefined, 45_000).then((r) =>
    json<{ questions: QuizQuestion[] }>(r),
  )

export const learnCompleteLesson = (lessonId: string, score?: number) =>
  apiFetch(`/api/learn/lessons/${lessonId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(score != null ? { score } : {}),
  }).then((r) => json<{ enrollment: Enrollment; certificate: Certificate | null }>(r))

export const learnCertificate = (code: string) =>
  apiFetch(`/api/learn/certificates/${code}`).then((r) => json<Certificate>(r))

export const learnCertificatePdfUrl = (code: string) => {
  const token = getSessionToken()
  return `/api/learn/certificates/${code}/pdf${token ? `?token=${token}` : ''}`
}

// Institution management (owner)
export const learnMyInstitutions = () =>
  apiFetch('/api/learn/my/institutions').then((r) => json<Institution[]>(r))

export const learnCreateInstitution = (input: {
  name: string
  about?: string
  website?: string
  org_type?: OrgType
}) =>
  apiFetch('/api/learn/institutions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => json<Institution>(r))

// Build-your-own: any individual can create a personal course/module without
// registering an organization — from the common dashboard, never the
// institutional portal.
export const learnMyCourses = () =>
  apiFetch('/api/learn/my/courses').then((r) => json<{ institution: Institution | null; courses: Course[] }>(r))

export const learnQuickCreateCourse = (input: {
  topic: string
  audience?: string
  level?: string
  kind?: OfferingKind
  objectives?: string
  material?: string
  avoid?: string
  event_at?: string
  event_location?: string
  title?: string
}) =>
  apiFetch(
    '/api/learn/my/courses/quick',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    90_000,
  ).then((r) => json<{ institution: Institution; course: Course; lessons: Lesson[] }>(r))

export const learnUpdateInstitution = (
  id: string,
  patch: Partial<{ name: string; about: string; website: string; logo_url: string; published: boolean; org_type: OrgType }>,
) =>
  apiFetch(`/api/learn/institutions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => json<Institution>(r))

export const learnInstitutionCourses = (institutionId: string) =>
  apiFetch(`/api/learn/institutions/${institutionId}/courses`).then((r) => json<Course[]>(r))

// AI-generated full offering for an organization — say what it's for; Bermi
// drafts the whole thing (course lessons + quiz-ready evaluation, or a
// program's steps, an event's agenda, or a resource's sections).
export const learnInstitutionQuickCreateCourse = (
  institutionId: string,
  input: {
    topic: string
    audience?: string
    level?: string
    category?: string
    kind?: OfferingKind
    objectives?: string
    material?: string
    avoid?: string
    event_at?: string
    event_location?: string
    title?: string
  },
) =>
  apiFetch(
    `/api/learn/institutions/${institutionId}/courses/quick`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    90_000,
  ).then((r) => json<{ course: Course; lessons: Lesson[] }>(r))

export const learnCreateCourse = (
  institutionId: string,
  input: {
    title: string
    summary?: string
    description?: string
    cover_emoji?: string
    level?: string
    category?: string
    kind?: OfferingKind
    event_at?: string
    event_location?: string
    objectives?: string
    evaluation?: string
    tracking?: string
  },
) =>
  apiFetch(`/api/learn/institutions/${institutionId}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => json<Course>(r))

export const learnUpdateCourse = (
  id: string,
  patch: Partial<{
    title: string
    summary: string
    description: string
    cover_emoji: string
    level: string
    category: string
    published: boolean
    enrollment: 'open' | 'approval'
    kind: OfferingKind
    event_at: string | null
    event_location: string
    objectives: string
    evaluation: string
    tracking: string
  }>,
) =>
  apiFetch(`/api/learn/courses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => json<Course>(r))

export const learnDeleteCourse = (id: string) =>
  apiFetch(`/api/learn/courses/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

// Lessons (owner)
export const learnManageLessons = (courseId: string) =>
  apiFetch(`/api/learn/courses/${courseId}/lessons/manage`).then((r) => json<Lesson[]>(r))

export const learnCreateLesson = (
  courseId: string,
  input: { title: string; content?: string; material?: string; video_url?: string; attachment_url?: string },
) =>
  apiFetch(`/api/learn/courses/${courseId}/lessons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => json<Lesson>(r))

export const learnUpdateLesson = (
  id: string,
  patch: Partial<{ title: string; content: string; material: string; video_url: string; attachment_url: string; ordinal: number }>,
) =>
  apiFetch(`/api/learn/lessons/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => json<Lesson>(r))

export const learnDeleteLesson = (id: string) =>
  apiFetch(`/api/learn/lessons/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r))

export const learnAiDraftLesson = (id: string, material?: string) =>
  apiFetch(
    `/api/learn/lessons/${id}/ai-draft`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material != null ? { material } : {}),
    },
    90_000,
  ).then((r) => json<Lesson>(r))

// Analytics
export const learnInstitutionAnalytics = (institutionId: string) =>
  apiFetch(`/api/learn/institutions/${institutionId}/analytics`).then((r) =>
    json<InstitutionAnalytics>(r),
  )

export const learnInstitutionLearners = (institutionId: string, q?: string) =>
  apiFetch(
    `/api/learn/institutions/${institutionId}/learners${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  ).then((r) => json<InstitutionLearner[]>(r))

export const learnLearnersExportUrl = (institutionId: string) => {
  const token = getSessionToken()
  return `/api/learn/institutions/${institutionId}/analytics/export.csv${token ? `?token=${token}` : ''}`
}
