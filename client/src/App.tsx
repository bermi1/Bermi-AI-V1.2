import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutGrid, Loader2, Menu, MessageSquare, SquarePen } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { InputBar } from './components/InputBar'
import { VoiceMode } from './components/VoiceMode'
import { DashboardPage } from './components/DashboardPage'
import { SettingsDialog } from './components/SettingsDialog'
import { InvoiceForm } from './components/InvoiceForm'
import { DocumentEditor } from './components/DocumentEditor'
import { StudioModal } from './components/StudioModal'
import { StudioViewer } from './components/StudioViewer'
import { NicheModal } from './components/NicheModal'
import { BrainEditor } from './components/BrainEditor'
import { AuthPage } from './components/AuthPage'
import { VerifyEmailPage } from './components/VerifyEmailPage'
import { LearnPortal } from './learn/LearnPortal'
import { AdminDashboard } from './admin/AdminDashboard'
import { StudyHud, StudyToast } from './components/StudyHud'
import { BermiMark } from './components/Logo'
import * as api from './lib/api'
import type { StudyAwardEvent } from './lib/api'
import type {
  Attachment,
  AuthUser,
  Brain,
  Conversation,
  DocumentSummary,
  Message,
  ModelOption,
  StudyStats,
} from './lib/types'

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [verificationRequired, setVerificationRequired] = useState(false)

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const { user, verificationRequired } = await api.authMe()
      setUser(user)
      setVerificationRequired(verificationRequired)
      return true
    } catch {
      setUser(null)
      return false
    } finally {
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    // Google sign-in lands with the session token in the URL fragment so it
    // works even where the cookie was blocked.
    const match = window.location.hash.match(/bermi_token=([a-f0-9]+)/)
    if (match) {
      api.setSessionToken(match[1])
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    checkAuth()
  }, [checkAuth])

  const signOut = useCallback(() => {
    api.logout().finally(() => setUser(null))
  }, [])

  if (!authChecked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface">
        <BermiMark size={48} className="text-primary" />
        <Loader2 size={18} className="animate-spin text-ink-faint" />
      </div>
    )
  }

  if (!user) return <AuthPage onAuthed={checkAuth} />

  if (verificationRequired && !user.email_verified) {
    return <VerifyEmailPage user={user} onVerified={setUser} onSignOut={signOut} />
  }

  return <Router user={user} onSignedOut={() => setUser(null)} />
}

// The Learn portal is a separate destination under /learn with its own landing
// page and navigation; everything else is the chat workspace. We watch the
// pathname so entering/leaving the portal swaps the whole shell.
function Router({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((to: string) => {
    window.history.pushState(null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  if (path.startsWith('/portal') || path.startsWith('/learn')) {
    return <LearnPortal user={user} onExit={() => go('/')} />
  }
  if (path.startsWith('/admin')) {
    return <AdminDashboard onExit={() => go('/')} selfEmail={user.email} />
  }
  return <Workspace user={user} onSignedOut={onSignedOut} />
}

function Workspace({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const [view, setView] = useState<'chat' | 'dashboard'>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('bermi-model') || '',
  )
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [brains, setBrains] = useState<Brain[]>([])
  const [userName, setUserName] = useState(user.name)

  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'profile' | 'connectors'>('profile')
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [openStudioId, setOpenStudioId] = useState<string | null>(null)
  const [editingBrain, setEditingBrain] = useState<Brain | null>(null)
  const [newBrainOpen, setNewBrainOpen] = useState(false)
  const [nicheOpen, setNicheOpen] = useState(false)

  const [chatSteps, setChatSteps] = useState<string[]>([])
  const [study, setStudy] = useState(() => localStorage.getItem('bermi-study') === '1')
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null)
  const [studyToast, setStudyToast] = useState<StudyAwardEvent | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState<{ message: string; retryAfter: number | null } | null>(null)
  const [quota, setQuota] = useState<api.ChatQuota | null>(null)
  const [voiceModeOpen, setVoiceModeOpen] = useState(false)
  const [voiceSpeaking, setVoiceSpeaking] = useState(false)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // A live mirror of voiceModeOpen for the streaming callbacks below: those
  // closures are created when send() is called and can outlive a state
  // change (e.g. the user hangs up mid-reply), so onDone must check current
  // reality via this ref, not the value it happened to close over at call
  // time — otherwise closing Voice Mode mid-response still auto-plays audio
  // after the fact.
  const voiceModeOpenRef = useRef(false)
  useEffect(() => {
    voiceModeOpenRef.current = voiceModeOpen
  }, [voiceModeOpen])

  // Voice Mode's spoken half: once a reply finishes streaming (see onDone in
  // `send` below), read it aloud automatically — the whole point of hands-free
  // mode is never touching the screen between turns. Strips Markdown/code
  // fences first so the voice reads prose, not literal punctuation.
  const playVoiceReply = useCallback(async (text: string) => {
    const speakable = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*_`>~-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    if (!speakable) return
    try {
      setVoiceSpeaking(true)
      const voice = localStorage.getItem('bermi-tts-voice') || undefined
      const blob = await api.synthesizeSpeech(speakable.slice(0, 2000), { voice })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      voiceAudioRef.current = audio
      audio.onended = () => setVoiceSpeaking(false)
      audio.onerror = () => setVoiceSpeaking(false)
      await audio.play()
    } catch {
      setVoiceSpeaking(false)
    }
  }, [])

  const closeVoiceMode = useCallback(() => {
    voiceAudioRef.current?.pause()
    setVoiceSpeaking(false)
    setVoiceModeOpen(false)
  }, [])

  // The shared hourly AI-message pool this user is drawing from (see
  // server routes/chat.js#quotaGate) — refreshed after every send so the
  // "X left, resets in Y" indicator near the composer stays live.
  const refreshQuota = useCallback(() => {
    api.getChatQuota().then(setQuota).catch(() => {})
  }, [])
  useEffect(() => {
    refreshQuota()
  }, [refreshQuota])

  // Local-first cache: mirror the conversation list into this browser so the
  // workspace loads instantly and survives offline — the user's data lives
  // with them, like an installed app.
  const cacheKey = `bermi-cache-conversations-${user.id}`
  const refreshConversations = useCallback(
    () =>
      api
        .listConversations()
        .then((list) => {
          setConversations(list)
          try {
            localStorage.setItem(cacheKey, JSON.stringify(list))
          } catch {
            /* quota — ignore */
          }
        })
        .catch(() => {
          try {
            const cached = localStorage.getItem(cacheKey)
            if (cached) setConversations(JSON.parse(cached))
          } catch {
            /* ignore */
          }
        }),
    [cacheKey],
  )
  const refreshDocuments = useCallback(
    () => api.listDocuments().then(setDocuments).catch(() => {}),
    [],
  )
  const refreshBrains = useCallback(
    () => api.listBrains().then(setBrains).catch(() => {}),
    [],
  )
  const refreshModels = useCallback(
    () =>
      api
        .listModels()
        .then((list) => {
          setModels(list)
          setSelectedModel((cur) =>
            cur && list.some((m) => m.id === cur) ? cur : (list[0]?.id ?? ''),
          )
        })
        .catch(() => {}),
    [],
  )

  useEffect(() => {
    refreshConversations()
    refreshDocuments()
    refreshBrains()
    refreshModels()
    api
      .getSettings()
      .then((s) => setUserName(s.profile.name || user.name))
      .catch(() => {})

    // Returning from a connector OAuth flow: land on the relevant settings tab.
    const params = new URLSearchParams(window.location.search)
    if (params.has('connected') || params.has('connector_error')) {
      setSettingsTab('connectors')
      setSettingsOpen(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [refreshConversations, refreshDocuments, refreshBrains, refreshModels, user.name])

  useEffect(() => {
    if (selectedModel) localStorage.setItem('bermi-model', selectedModel)
  }, [selectedModel])

  useEffect(() => {
    localStorage.setItem('bermi-study', study ? '1' : '0')
    if (study && !studyStats) api.getStudyStats().then(setStudyStats).catch(() => {})
  }, [study, studyStats])

  const selectConversation = useCallback((id: string) => {
    abortRef.current?.abort()
    setView('chat')
    setActiveId(id)
    setChatError(null)
    setMessages([])
    api.getMessages(id).then(setMessages).catch(() => {})
    if (!isDesktop()) setSidebarOpen(false)
  }, [])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    setView('chat')
    setActiveId(null)
    setMessages([])
    setChatError(null)
    if (!isDesktop()) setSidebarOpen(false)
  }, [])

  const deleteConversation = useCallback(
    (id: string) => {
      api.deleteConversation(id).then(() => {
        refreshConversations()
        if (id === activeId) {
          setActiveId(null)
          setMessages([])
        }
      })
    },
    [activeId, refreshConversations],
  )

  const send = useCallback(
    (text: string, opts: { web?: boolean; study?: boolean; attachments?: Attachment[] } = {}) => {
      const { web = false, study: studyReq = false, attachments } = opts
      setChatError(null)
      setChatSteps([])
      const now = new Date().toISOString()
      // Show only a compact chip for attachments; their full (OCR'd) text is
      // sent as context for the model to read internally, never displayed.
      const tags = attachments?.length
        ? '\n\n' + attachments.map((a) => `📎 ${a.name}`).join('\n')
        : ''
      const displayText = text + tags
      const userMsg: Message = {
        id: `local-${Date.now()}-u`,
        role: 'user',
        content: displayText,
        created_at: now,
      }
      const assistantMsg: Message = {
        id: `local-${Date.now()}-a`,
        role: 'assistant',
        content: '',
        model: selectedModel,
        created_at: now,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setStreaming(true)

      const abort = new AbortController()
      abortRef.current = abort

      api.streamChat(
        {
          conversationId: activeId,
          message: displayText,
          model: selectedModel,
          web,
          study: studyReq,
          attachments: attachments?.map((a) => ({ name: a.name, text: a.text })),
        },
        {
          onConversation: (conversation) => {
            setActiveId(conversation.id)
            refreshConversations()
          },
          onStatus: (label) => {
            if (label === null) setChatSteps([])
            else setChatSteps((prev) => (prev.includes(label) ? prev : [...prev, label]))
          },
          onStudy: (award) => {
            setStudyStats(award.stats)
            setStudyToast(award)
            setTimeout(() => setStudyToast(null), 4000)
          },
          // The system just enrolled the learner in a course from this very
          // message — switch Study Mode on automatically so teaching/XP
          // tracking kicks in right away, no separate manual toggle needed.
          // Programs/events/resources are guided in ordinary chat instead —
          // Study Mode's gamified "lesson mastery" framing doesn't fit a
          // bank's application steps or an event RSVP, so only courses
          // trigger it. Progress still records either way (see chat.js).
          onEnrolled: (info) => {
            if (!info.kind || info.kind === 'course') setStudy(true)
          },
          onToken: (token) => {
            setChatSteps([])
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + token }
              }
              return next
            })
          },
          onCitations: (items) => {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                const sources =
                  '\n\n---\n**Sources**\n' +
                  items.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join('\n')
                next[next.length - 1] = { ...last, content: last.content + sources }
              }
              return next
            })
          },
          onDone: (fullText) => {
            setStreaming(false)
            setChatSteps([])
            refreshConversations()
            refreshQuota()
            if (voiceModeOpenRef.current && fullText.trim()) playVoiceReply(fullText)
          },
          onError: (message, retryAfter) => {
            setStreaming(false)
            setChatSteps([])
            setChatError({ message, retryAfter: retryAfter ?? null })
            refreshQuota()
            setMessages((prev) =>
              prev[prev.length - 1]?.role === 'assistant' &&
              prev[prev.length - 1]?.content === ''
                ? prev.slice(0, -1)
                : prev,
            )
          },
        },
        abort.signal,
      )
    },
    [activeId, selectedModel, refreshConversations, refreshQuota, playVoiceReply],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setChatSteps([])
  }, [])

  // Resume/continue anything from "My activity" entirely inside Bermi AI
  // chat — never the portal. Only a course forces Study Mode's gamified
  // teaching UI; a program/event/resource is guided in ordinary chat.
  const studyCourse = useCallback(
    (title: string, kind: 'course' | 'program' | 'event' | 'resource' = 'course') => {
      setView('chat')
      const prompt =
        kind === 'event'
          ? `Tell me more about the event "${title}" and confirm my registration status.`
          : kind === 'resource'
            ? `Show me the resource "${title}" again.`
            : `Let's continue the ${kind} "${title}". Pick up where I left off and guide me through the next part.`
      if (kind === 'course') setStudy(true)
      send(prompt, { study: kind === 'course' })
    },
    [send],
  )

  // Study handoff from the Learn portal: a lesson/course was opened "in Bermi
  // AI", so start a fresh Study Mode chat pre-loaded with that material.
  const handoffDone = useRef(false)
  useEffect(() => {
    if (handoffDone.current || !selectedModel || streaming) return
    let payload: { prompt?: string } | null = null
    try {
      const raw = localStorage.getItem('bermi-study-handoff')
      if (raw) payload = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    if (!payload?.prompt) return
    handoffDone.current = true
    localStorage.removeItem('bermi-study-handoff')
    setStudy(true)
    setView('chat')
    setActiveId(null)
    setMessages([])
    const prompt = payload.prompt
    setTimeout(() => send(prompt, { study: true }), 60)
  }, [selectedModel, streaming, send])

  const deleteDocument = useCallback(
    (id: string) => {
      api.deleteDocument(id).then(refreshDocuments)
    },
    [refreshDocuments],
  )

  const openSettings = useCallback((tab: 'profile' | 'connectors' = 'profile') => {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }, [])

  const signOut = useCallback(() => {
    api.logout().finally(onSignedOut)
  }, [onSignedOut])

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={view === 'chat' ? activeId : null}
        onSelect={selectConversation}
        onNewChat={newChat}
        onDelete={deleteConversation}
        onOpenSettings={() => openSettings('profile')}
        userName={userName}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {user.is_guest && (
          <div className="flex items-center justify-center gap-2 bg-primary-soft px-4 py-1.5 text-center text-[12.5px] text-primary">
            <span>You're using Bermi as a guest — free for one day.</span>
            <button onClick={signOut} className="font-semibold underline underline-offset-2">
              Create a free account to keep your work
            </button>
          </div>
        )}
        <header className="flex items-center justify-between border-b border-edge px-3 py-2.5 md:px-4">
          <div className="flex min-w-0 items-center gap-1">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
            <button
              onClick={newChat}
              className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken md:hidden"
              aria-label="New chat"
            >
              <SquarePen size={18} />
            </button>
            <span className="ml-1 truncate text-sm font-medium text-ink-muted">
              {view === 'dashboard'
                ? 'Dashboard'
                : (conversations.find((c) => c.id === activeId)?.title ?? 'New chat')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('chat')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                view === 'chat'
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-muted hover:bg-surface-sunken'
              }`}
              aria-label="Chat view"
            >
              <MessageSquare size={15} />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                view === 'dashboard'
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-muted hover:bg-surface-sunken'
              }`}
              aria-label="Dashboard view"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Dashboard</span>
              {documents.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10.5px] font-semibold text-white">
                  {documents.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {view === 'chat' ? (
          <>
            {study && studyStats && <StudyHud stats={studyStats} />}
            <ChatPanel
              messages={messages}
              streaming={streaming}
              steps={chatSteps}
              error={chatError}
              userName={userName}
              onStudyCourse={studyCourse}
            />
            <InputBar
              models={models}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onSend={send}
              onStop={stop}
              streaming={streaming}
              study={study}
              onToggleStudy={setStudy}
              quota={quota}
              onOpenVoiceMode={() => setVoiceModeOpen(true)}
            />
            {voiceModeOpen && (
              <VoiceMode
                onClose={closeVoiceMode}
                onTranscript={(text) => send(text)}
                thinking={streaming}
                speaking={voiceSpeaking}
                lastAssistantText={
                  messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1].content : ''
                }
              />
            )}
          </>
        ) : (
          <DashboardPage
            userName={userName}
            documents={documents}
            brains={brains}
            conversations={conversations}
            onNewInvoice={() => setInvoiceFormOpen(true)}
            onNewStudio={() => setStudioOpen(true)}
            onOpenDocument={(id) => {
              const doc = documents.find((d) => d.id === id)
              if (doc?.type === 'studio') setOpenStudioId(id)
              else setOpenDocId(id)
            }}
            onDeleteDocument={deleteDocument}
            onEditBrain={setEditingBrain}
            onNewBrain={() => setNewBrainOpen(true)}
            onRefreshBrains={refreshBrains}
            onOpenConversation={selectConversation}
            onNewChat={newChat}
            onOpenConnectors={() => openSettings('connectors')}
            onOpenProfile={() => openSettings('profile')}
            onOpenNiche={() => setNicheOpen(true)}
            onStartStudy={() => {
              setStudy(true)
              setView('chat')
              if (!activeId) newChat()
            }}
            onStudyCourse={studyCourse}
          />
        )}
      </main>

      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          initialTab={settingsTab}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onModelsChanged={refreshModels}
          onProfileSaved={(p) => setUserName(p.name || user.name)}
          onSignOut={signOut}
        />
      )}

      {invoiceFormOpen && (
        <InvoiceForm
          onClose={() => setInvoiceFormOpen(false)}
          onCreated={(doc) => {
            setInvoiceFormOpen(false)
            refreshDocuments()
            setView('dashboard')
            setOpenDocId(doc.id)
          }}
        />
      )}

      {openDocId && (
        <DocumentEditor
          documentId={openDocId}
          onClose={() => setOpenDocId(null)}
          onSaved={refreshDocuments}
        />
      )}

      {studioOpen && (
        <StudioModal
          onClose={() => setStudioOpen(false)}
          onSaved={() => {
            refreshDocuments()
            setView('dashboard')
          }}
        />
      )}

      {openStudioId && (
        <StudioViewer
          documentId={openStudioId}
          onClose={() => setOpenStudioId(null)}
          onSaved={refreshDocuments}
        />
      )}

      {(editingBrain || newBrainOpen) && (
        <BrainEditor
          brain={editingBrain}
          onClose={() => {
            setEditingBrain(null)
            setNewBrainOpen(false)
          }}
          onSaved={refreshBrains}
        />
      )}

      {nicheOpen && <NicheModal onClose={() => setNicheOpen(false)} onSaved={refreshBrains} />}

      {studyToast && (
        <StudyToast
          gained={studyToast.gained}
          leveledUp={studyToast.leveledUp}
          level={studyToast.stats.level}
          badges={studyToast.newBadges}
        />
      )}
    </div>
  )
}
