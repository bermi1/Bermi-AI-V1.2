import { useEffect, useMemo, useState } from 'react'
import {
  Brain as BrainIcon,
  Building2,
  Download,
  FileText,
  Inbox,
  Plug,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react'
import type { Brain, Connector, DocumentSummary, GmailMessage } from '../lib/types'
import * as api from '../lib/api'
import { documentPdfUrl } from '../lib/api'

type DashTab = 'documents' | 'brains' | 'apps'

interface DashboardPanelProps {
  open: boolean
  onClose: () => void
  documents: DocumentSummary[]
  onNewInvoice: () => void
  onOpenDocument: (id: string) => void
  onDeleteDocument: (id: string) => void
  onEditBrain: (brain: Brain) => void
  brains: Brain[]
  onRefreshBrains: () => void
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

export function DashboardPanel({
  open,
  onClose,
  documents,
  onNewInvoice,
  onOpenDocument,
  onDeleteDocument,
  onEditBrain,
  brains,
  onRefreshBrains,
}: DashboardPanelProps) {
  const [tab, setTab] = useState<DashTab>('documents')
  const [query, setQuery] = useState('')
  const [connectors, setConnectors] = useState<Connector[]>([])

  useEffect(() => {
    if (open) api.listConnectors().then(setConnectors).catch(() => {})
  }, [open])

  const filteredDocs = useMemo(
    () =>
      query
        ? documents.filter((d) => d.title.toLowerCase().includes(query.toLowerCase()))
        : documents,
    [documents, query],
  )

  if (!open) return null

  const drafts = documents.filter((d) => d.status === 'draft').length
  const activeBrains = brains.filter((b) => b.enabled && b.content.trim()).length
  const connectedApps = connectors.filter((c) => c.status === 'connected').length

  return (
    <>
      {/* Mobile scrim — panel becomes a bottom sheet on small screens */}
      <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      <section
        className={
          'fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-edge bg-surface-sunken ' +
          'md:static md:z-auto md:max-h-none md:w-[22rem] md:shrink-0 md:rounded-none md:border-l md:border-t-0 lg:w-[24rem]'
        }
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-edge-strong md:hidden" aria-hidden />
        <header className="flex items-center justify-between px-4 pb-1 pt-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight">Dashboard</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised"
            aria-label="Close dashboard"
          >
            <X size={17} />
          </button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
          {[
            { label: 'Documents', value: documents.length, sub: `${drafts} draft${drafts === 1 ? '' : 's'}` },
            { label: 'Brains', value: activeBrains, sub: 'active' },
            { label: 'Apps', value: connectedApps, sub: 'connected' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-edge bg-surface-raised px-3 py-2">
              <div className="text-lg font-semibold leading-tight text-primary">{s.value}</div>
              <div className="text-[11px] font-medium text-ink-muted">{s.label}</div>
              <div className="text-[10.5px] text-ink-faint">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-2">
          {(
            [
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'brains', label: 'Brains', icon: BrainIcon },
              { id: 'apps', label: 'Apps', icon: Plug },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === id ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-raised'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {tab === 'documents' && (
            <DocumentsTab
              documents={filteredDocs}
              query={query}
              setQuery={setQuery}
              onNewInvoice={onNewInvoice}
              onOpenDocument={onOpenDocument}
              onDeleteDocument={onDeleteDocument}
            />
          )}
          {tab === 'brains' && (
            <BrainsTab brains={brains} onEditBrain={onEditBrain} onRefreshBrains={onRefreshBrains} />
          )}
          {tab === 'apps' && <AppsTab connectors={connectors} />}
        </div>
      </section>
    </>
  )
}

// ---------------- Documents ----------------

function DocumentsTab({
  documents,
  query,
  setQuery,
  onNewInvoice,
  onOpenDocument,
  onDeleteDocument,
}: {
  documents: DocumentSummary[]
  query: string
  setQuery: (q: string) => void
  onNewInvoice: () => void
  onOpenDocument: (id: string) => void
  onDeleteDocument: (id: string) => void
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 py-1.5">
          <Search size={13} className="shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
        </div>
        <button
          onClick={onNewInvoice}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={13} />
          Invoice
        </button>
      </div>

      {documents.length === 0 && (
        <div className="rounded-xl border border-edge bg-surface px-4 py-10 text-center">
          <FileText size={22} className="mx-auto mb-2 text-ink-faint" />
          <p className="text-sm text-ink-muted">
            {query ? 'No documents match.' : 'No documents yet.'}
          </p>
          {!query && (
            <p className="mt-1 text-xs text-ink-faint">
              Generate an invoice and it will appear here, versioned.
            </p>
          )}
        </div>
      )}

      {documents.map((doc) => (
        <article
          key={doc.id}
          className="group cursor-pointer rounded-xl border border-edge bg-surface-raised p-3.5 shadow-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md"
          onClick={() => onOpenDocument(doc.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FileText size={15} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[13.5px] font-semibold leading-snug">{doc.title}</h3>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Invoice · v{doc.version} · {timeAgo(doc.updated_at)}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                doc.status === 'final'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-primary-soft text-primary'
              }`}
            >
              {doc.status}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-edge pt-2.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenDocument(doc.id)
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
            >
              Open / edit
            </button>
            <a
              href={documentPdfUrl(doc.id)}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
            >
              <Download size={12} />
              PDF
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteDocument(doc.id)
              }}
              className="ml-auto rounded-lg p-1 text-ink-faint opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              aria-label="Delete document"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

// ---------------- Brains ----------------

function BrainsTab({
  brains,
  onEditBrain,
  onRefreshBrains,
}: {
  brains: Brain[]
  onEditBrain: (brain: Brain) => void
  onRefreshBrains: () => void
}) {
  const toggle = (brain: Brain) =>
    api.saveBrain(brain.id, brain.content, !brain.enabled).then(onRefreshBrains)

  return (
    <div className="space-y-2.5">
      <p className="px-0.5 text-xs leading-relaxed text-ink-faint">
        Brains are persistent knowledge Bermi carries into every conversation — company facts in
        one, personal context in the other.
      </p>
      {brains.map((brain) => {
        const Icon = brain.id === 'company' ? Building2 : User
        const active = brain.enabled && brain.content.trim()
        return (
          <article
            key={brain.id}
            className="cursor-pointer rounded-xl border border-edge bg-surface-raised p-3.5 shadow-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md"
            onClick={() => onEditBrain(brain)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-ink-faint'
                  }`}
                >
                  <Icon size={15} />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-semibold leading-snug">{brain.name}</h3>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {brain.content.trim()
                      ? `${brain.content.trim().split(/\s+/).length} words · ${
                          brain.updated_at ? timeAgo(brain.updated_at) : ''
                        }`
                      : 'Empty — click to add knowledge'}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(brain)
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
              <p className="mt-2.5 line-clamp-2 border-t border-edge pt-2.5 text-xs leading-relaxed text-ink-muted">
                {brain.content.trim()}
              </p>
            )}
          </article>
        )
      })}
      <div className="flex items-start gap-2 rounded-xl bg-primary-soft/60 px-3.5 py-3 text-xs leading-relaxed text-ink-muted">
        <Sparkles size={13} className="mt-0.5 shrink-0 text-primary" />
        Enabled brains ride along with every message, so Bermi always knows your business and
        your preferences.
      </div>
    </div>
  )
}

// ---------------- Apps ----------------

function AppsTab({ connectors }: { connectors: Connector[] }) {
  const google = connectors.find((c) => c.id === 'google')
  const [mail, setMail] = useState<GmailMessage[] | null>(null)
  const [mailError, setMailError] = useState<string | null>(null)

  useEffect(() => {
    if (google?.status === 'connected') {
      api
        .fetchGmailMessages()
        .then(setMail)
        .catch((e) => setMailError((e as Error).message))
    }
  }, [google?.status])

  return (
    <div className="space-y-2.5">
      {connectors.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-xl border border-edge bg-surface-raised px-3.5 py-3"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                c.status === 'connected'
                  ? 'bg-primary-soft text-primary'
                  : 'bg-surface-sunken text-ink-faint'
              }`}
            >
              <Plug size={14} />
            </div>
            <div>
              <div className="text-[13px] font-semibold">{c.label}</div>
              <div className="text-[11px] text-ink-faint">{c.account ?? c.description}</div>
            </div>
          </div>
          {c.status === 'available' && c.id === 'google' ? (
            <a
              href={api.googleAuthUrl()}
              className="rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-primary-hover"
            >
              Connect
            </a>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                c.status === 'connected'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-surface-sunken text-ink-faint'
              }`}
            >
              {c.status === 'connected'
                ? 'Connected'
                : c.status === 'setup_required'
                  ? 'Setup'
                  : 'Soon'}
            </span>
          )}
        </div>
      ))}

      {google?.status === 'connected' && (
        <div className="rounded-xl border border-edge bg-surface-raised p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <Inbox size={14} className="text-primary" />
            Recent Gmail
          </div>
          {mailError && <p className="text-xs text-red-500">{mailError}</p>}
          {!mail && !mailError && <p className="text-xs text-ink-faint">Loading…</p>}
          {mail?.map((m) => (
            <div key={m.id} className="border-t border-edge py-2 first:border-t-0">
              <div className="truncate text-[12.5px] font-medium">{m.subject || '(no subject)'}</div>
              <div className="truncate text-[11px] text-ink-faint">
                {m.from} · {m.snippet}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="px-0.5 text-[11.5px] leading-relaxed text-ink-faint">
        Manage connections and OAuth setup in Settings → Connectors.
      </p>
    </div>
  )
}
