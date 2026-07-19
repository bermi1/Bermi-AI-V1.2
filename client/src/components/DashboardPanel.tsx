import { Download, FileText, Plus, Trash2, X } from 'lucide-react'
import type { DocumentSummary } from '../lib/types'
import { documentPdfUrl } from '../lib/api'

interface DashboardPanelProps {
  open: boolean
  onClose: () => void
  documents: DocumentSummary[]
  onNewInvoice: () => void
  onOpenDocument: (id: string) => void
  onDeleteDocument: (id: string) => void
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
}: DashboardPanelProps) {
  if (!open) return null

  return (
    <>
      {/* Mobile scrim — panel becomes a bottom sheet on small screens */}
      <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      <section
        className={
          'fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-edge bg-surface-sunken ' +
          'md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-l md:border-t-0 lg:w-96'
        }
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-edge-strong md:hidden" aria-hidden />
        <header className="flex items-center justify-between px-4 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Documents</h2>
            <p className="text-xs text-ink-faint">Generated documents live here, versioned.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised"
            aria-label="Close documents panel"
          >
            <X size={17} />
          </button>
        </header>

        <div className="px-4 pb-3">
          <button
            onClick={onNewInvoice}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge-strong px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary-soft"
          >
            <Plus size={15} />
            New invoice
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6">
          {documents.length === 0 && (
            <div className="rounded-xl border border-edge bg-surface px-4 py-8 text-center">
              <FileText size={22} className="mx-auto mb-2 text-ink-faint" />
              <p className="text-sm text-ink-muted">No documents yet.</p>
              <p className="mt-1 text-xs text-ink-faint">
                Generate an invoice and it will appear here as a card.
              </p>
            </div>
          )}
          {documents.map((doc) => (
            <article
              key={doc.id}
              className="group cursor-pointer rounded-xl border border-edge bg-surface-raised p-3.5 shadow-sm transition-colors hover:border-primary/40"
              onClick={() => onOpenDocument(doc.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[13.5px] font-medium leading-snug">
                      {doc.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      v{doc.version} · edited {timeAgo(doc.updated_at)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
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
      </section>
    </>
  )
}
