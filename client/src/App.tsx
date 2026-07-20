import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutGrid, Loader2, Menu, MessageSquare, SquarePen } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { InputBar } from './components/InputBar'
import { DashboardPage } from './components/DashboardPage'
import { SettingsDialog } from './components/SettingsDialog'
import { InvoiceForm } from './components/InvoiceForm'
import { DocumentEditor } from './components/DocumentEditor'
import { BrainEditor } from './components/BrainEditor'
import { AuthPage } from './components/AuthPage'
import { VerifyEmailPage } from './components/VerifyEmailPage'
import { BermiMark } from './components/Logo'
import * as api from './lib/api'
import type {
  AuthUser,
  Brain,
  Conversation,
  DocumentSummary,
  Message,
  ModelOption,
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

  return <Workspace user={user} onSignedOut={() => setUser(null)} />
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
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [editingBrain, setEditingBrain] = useState<Brain | null>(null)

  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refreshConversations = useCallback(
    () => api.listConversations().then(setConversations).catch(() => {}),
    [],
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
    (text: string) => {
      setChatError(null)
      const now = new Date().toISOString()
      const userMsg: Message = {
        id: `local-${Date.now()}-u`,
        role: 'user',
        content: text,
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
        { conversationId: activeId, message: text, model: selectedModel },
        {
          onConversation: (conversation) => {
            setActiveId(conversation.id)
            refreshConversations()
          },
          onToken: (token) => {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + token }
              }
              return next
            })
          },
          onDone: () => {
            setStreaming(false)
            refreshConversations()
          },
          onError: (message) => {
            setStreaming(false)
            setChatError(message)
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
    [activeId, selectedModel, refreshConversations],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

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
            <ChatPanel
              messages={messages}
              streaming={streaming}
              error={chatError}
              userName={userName}
            />
            <InputBar
              models={models}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onSend={send}
              onStop={stop}
              streaming={streaming}
            />
          </>
        ) : (
          <DashboardPage
            userName={userName}
            documents={documents}
            brains={brains}
            conversations={conversations}
            onNewInvoice={() => setInvoiceFormOpen(true)}
            onOpenDocument={setOpenDocId}
            onDeleteDocument={deleteDocument}
            onEditBrain={setEditingBrain}
            onRefreshBrains={refreshBrains}
            onOpenConversation={selectConversation}
            onNewChat={newChat}
            onOpenConnectors={() => openSettings('connectors')}
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

      {editingBrain && (
        <BrainEditor
          brain={editingBrain}
          onClose={() => setEditingBrain(null)}
          onSaved={refreshBrains}
        />
      )}
    </div>
  )
}
