import { useEffect, useMemo, useState } from 'react'
import {
  Brain as BrainIcon,
  Building2,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  Inbox,
  MessageSquare,
  Plug,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import type {
  Brain,
  Connector,
  Conversation,
  DocumentSummary,
  GmailMessage,
} from '../lib/types'
import * as api from '../lib/api'
import { documentPdfUrl } from '../lib/api'

interface DashboardPageProps {
  userName: string
  documents: DocumentSummary[]
  brains: Brain[]
  conversations: Conversation[]
  onNewInvoice: () => void
  onOpenDocument: (id: string) => void
  onDeleteDocument: (id: string) => void
  onEditBrain: (brain: Brain) => void
  onRefreshBrains: () => void
  onOpenConversation: (id: string) => void
  onNewChat: () => void
  onOpenConnectors: () => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function DashboardPage({
  userName,
  documents,
  brains,
  conversations,
  onNewInvoice,
  onOpenDocument,
  onDeleteDocument,
  onEditBrain,
  onRefreshBrains,
  onOpenConversation,
  onNewChat,
  onOpenConnectors,
}: DashboardPageProps) {
  const [query, setQuery] = useState('')
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [mail, setMail] = useState<GmailMessage[] | null>(null)

  useEffect(() => {
    api.listConnectors().then(setConnectors).catch(() => {})
  }, [])

  const google = connectors.find((c) => c.id === 'google')
  useEffect(() => {
    if (google?.status === 'connected') {
      api.fetchGmailMessages().then(setMail).catch(() => setMail(null))
    }
  }, [google?.status])

  const filteredDocs = useMemo(
    () =>
      query
        ? documents.filter((d) => d.title.toLowerCase().includes(query.toLowerCase()))
        : documents,
    [documents, query],
  )

  const drafts = documents.filter((d) => d.status === 'draft').length
  const finals = documents.length - drafts
  const activeBrains = brains.filter((b) => b.enabled && b.content.trim()).length
  const connectedApps = connectors.filter((c) => c.status === 'connected').length

  const stats = [
    { label: 'Documents', value: documents.length, sub: 'all time', icon: FileText },
    { label: 'Finalized', value: finals, sub: `${drafts} in draft`, icon: FileCheck2 },
    {
      label: 'Active brains',
      value: activeBrains,
      sub: `of ${brains.length} available`,
      icon: BrainIcon,
    },
    { label: 'Connected apps', value: connectedApps, sub: `${connectors.length} available`, icon: Plug },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-10">
        {/* Header */}
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[26px] font-medium tracking-tight md:text-[32px]">
              {userName ? `${userName.split(' ')[0]}'s workspace` : 'Your workspace'}
            </h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              Documents, brains, and connected apps — everything Bermi manages for you.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNewChat}
              className="flex items-center gap-1.5 rounded-xl border border-edge bg-surface-raised px-3.5 py-2 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken"
            >
              <MessageSquare size={14} />
              New chat
            </button>
            <button
              onClick={onNewInvoice}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
            >
              <Plus size={15} />
              New invoice
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, sub, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-ink-muted">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight">
                {value}
              </div>
              <div className="mt-1.5 text-[11.5px] text-ink-faint">{sub}</div>
            </div>
          ))}
        </div>

        {/* Documents */}
        <section className="mb-10">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight">Documents</h2>
            <div className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-edge bg-surface-raised px-3 py-2">
              <Search size={14} className="shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <button
              onClick={onNewInvoice}
              className="flex w-full flex-col items-center rounded-2xl border border-dashed border-edge-strong bg-surface-raised px-6 py-12 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <FileText size={26} className="mb-3 text-ink-faint" />
              <span className="text-[14.5px] font-medium">
                {query ? 'No documents match your search' : 'Generate your first invoice'}
              </span>
              {!query && (
                <span className="mt-1 text-[12.5px] text-ink-faint">
                  AI drafts the copy — you review, edit, and export to PDF. Every edit is a
                  new version.
                </span>
              )}
            </button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredDocs.map((doc) => (
                <article
                  key={doc.id}
                  className="group cursor-pointer rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  onClick={() => onOpenDocument(doc.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <FileText size={17} />
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        doc.status === 'final'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-primary-soft text-primary'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                  <h3 className="mt-3 truncate text-[14px] font-semibold leading-snug">
                    {doc.title}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-ink-faint">
                    Invoice · v{doc.version} · {timeAgo(doc.updated_at)}
                  </p>
                  <div className="mt-3 flex items-center gap-1 border-t border-edge pt-3">
                    <span className="rounded-lg px-2 py-1 text-[12px] font-medium text-primary">
                      Open / edit
                    </span>
                    <a
                      href={documentPdfUrl(doc.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-muted hover:bg-surface-sunken"
                    >
                      <Download size={12} />
                      PDF
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteDocument(doc.id)
                      }}
                      className="ml-auto rounded-lg p-1.5 text-ink-faint opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      aria-label="Delete document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Brains */}
          <section>
            <h2 className="mb-3.5 text-[17px] font-semibold tracking-tight">Brains</h2>
            <div className="space-y-3">
              {brains.map((brain) => {
                const Icon =
                  brain.id === 'company'
                    ? Building2
                    : brain.id === 'vibecoding'
                      ? GraduationCap
                      : User
                const active = brain.enabled && brain.content.trim()
                return (
                  <article
                    key={brain.id}
                    className="cursor-pointer rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    onClick={() => onEditBrain(brain)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            active
                              ? 'bg-primary-soft text-primary'
                              : 'bg-surface-sunken text-ink-faint'
                          }`}
                        >
                          <Icon size={17} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold">{brain.name}</h3>
                          <p className="mt-0.5 text-[12px] text-ink-faint">
                            {brain.content.trim()
                              ? `${brain.content.trim().split(/\s+/).length} words${
                                  brain.updated_at ? ` · updated ${timeAgo(brain.updated_at)}` : ''
                                }`
                              : 'Empty — click to teach Bermi'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          api.saveBrain(brain.id, brain.content, !brain.enabled).then(onRefreshBrains)
                        }}
                        role="switch"
                        aria-checked={brain.enabled}
                        aria-label={`Toggle ${brain.name}`}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          brain.enabled ? 'bg-primary' : 'bg-edge-strong'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                            brain.enabled ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    {brain.content.trim() && (
                      <p className="mt-3 line-clamp-2 border-t border-edge pt-3 text-[12.5px] leading-relaxed text-ink-muted">
                        {brain.content.trim()}
                      </p>
                    )}
                  </article>
                )
              })}
              <div className="flex items-start gap-2.5 rounded-2xl bg-primary-soft/60 px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-muted">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
                Enabled brains ride along with every message, so Bermi always knows your
                company and your preferences.
              </div>
            </div>
          </section>

          {/* Apps & connectors */}
          <section>
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold tracking-tight">Apps</h2>
              <button
                onClick={onOpenConnectors}
                className="text-[12.5px] font-medium text-primary hover:underline"
              >
                Manage connectors
              </button>
            </div>
            <div className="space-y-3">
              {connectors.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-2xl border border-edge bg-surface-raised px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        c.status === 'connected'
                          ? 'bg-primary-soft text-primary'
                          : 'bg-surface-sunken text-ink-faint'
                      }`}
                    >
                      <Plug size={16} />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold">{c.label}</div>
                      <div className="text-[12px] text-ink-faint">
                        {c.account ?? c.description}
                      </div>
                    </div>
                  </div>
                  {c.status === 'available' && c.id === 'google' ? (
                    <a
                      href={api.googleAuthUrl()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white hover:bg-primary-hover"
                    >
                      Connect
                    </a>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        c.status === 'connected'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-surface-sunken text-ink-faint'
                      }`}
                    >
                      {c.status === 'connected'
                        ? 'Connected'
                        : c.status === 'setup_required'
                          ? 'Setup required'
                          : 'Coming soon'}
                    </span>
                  )}
                </div>
              ))}

              {google?.status === 'connected' && mail && mail.length > 0 && (
                <div className="rounded-2xl border border-edge bg-surface-raised p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
                    <Inbox size={14} className="text-primary" />
                    Recent Gmail
                  </div>
                  {mail.slice(0, 5).map((m) => (
                    <div key={m.id} className="border-t border-edge py-2 first:border-t-0">
                      <div className="truncate text-[12.5px] font-medium">
                        {m.subject || '(no subject)'}
                      </div>
                      <div className="truncate text-[11px] text-ink-faint">
                        {m.from} · {m.snippet}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3.5 text-[17px] font-semibold tracking-tight">
              Recent conversations
            </h2>
            <div className="overflow-hidden rounded-2xl border border-edge bg-surface-raised shadow-sm">
              {conversations.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenConversation(c.id)}
                  className="flex w-full items-center gap-3 border-t border-edge px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-surface-sunken"
                >
                  <MessageSquare size={14} className="shrink-0 text-ink-faint" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    {c.title}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-ink-faint">
                    {timeAgo(c.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
