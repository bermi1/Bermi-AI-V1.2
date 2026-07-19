import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutGrid, Menu, SquarePen } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { InputBar } from './components/InputBar'
import { DashboardPanel } from './components/DashboardPanel'
import { SettingsModal } from './components/SettingsModal'
import { InvoiceForm } from './components/InvoiceForm'
import { DocumentEditor } from './components/DocumentEditor'
import * as api from './lib/api'
import type { Conversation, DocumentSummary, Message, ModelOption } from './lib/types'

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('bermi-model') || '',
  )
  const [documents, setDocuments] = useState<DocumentSummary[]>([])

  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [openDocId, setOpenDocId] = useState<string | null>(null)

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

  useEffect(() => {
    refreshConversations()
    refreshDocuments()
    api
      .listModels()
      .then((list) => {
        setModels(list)
        setSelectedModel((cur) =>
          cur && list.some((m) => m.id === cur) ? cur : (list[0]?.id ?? ''),
        )
      })
      .catch(() => {})
  }, [refreshConversations, refreshDocuments])

  useEffect(() => {
    if (selectedModel) localStorage.setItem('bermi-model', selectedModel)
  }, [selectedModel])

  const selectConversation = useCallback((id: string) => {
    abortRef.current?.abort()
    setActiveId(id)
    setChatError(null)
    setMessages([])
    api.getMessages(id).then(setMessages).catch(() => {})
    if (!isDesktop()) setSidebarOpen(false)
  }, [])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
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

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNewChat={newChat}
        onDelete={deleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-edge px-3 py-2.5 md:px-4">
          <div className="flex items-center gap-1">
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
              {conversations.find((c) => c.id === activeId)?.title ?? 'New chat'}
            </span>
          </div>
          <button
            onClick={() => setDashboardOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
              dashboardOpen
                ? 'bg-primary-soft text-primary'
                : 'text-ink-muted hover:bg-surface-sunken'
            }`}
            aria-label="Toggle documents panel"
          >
            <LayoutGrid size={15} />
            <span className="hidden sm:inline">Documents</span>
            {documents.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10.5px] font-semibold text-white">
                {documents.length}
              </span>
            )}
          </button>
        </header>

        <ChatPanel messages={messages} streaming={streaming} error={chatError} />

        <InputBar
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onSend={send}
          onStop={stop}
          streaming={streaming}
        />
      </main>

      <DashboardPanel
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        documents={documents}
        onNewInvoice={() => setInvoiceFormOpen(true)}
        onOpenDocument={setOpenDocId}
        onDeleteDocument={deleteDocument}
      />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
      )}

      {invoiceFormOpen && (
        <InvoiceForm
          onClose={() => setInvoiceFormOpen(false)}
          onCreated={(doc) => {
            setInvoiceFormOpen(false)
            refreshDocuments()
            setDashboardOpen(true)
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
    </div>
  )
}
