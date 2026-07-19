import { useEffect, useMemo, useState } from 'react'
import { Download, History, Plus, Trash2 } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, labelCls, primaryBtnCls } from './Modal'
import {
  documentPdfUrl,
  getDocument,
  listDocumentVersions,
  updateDocument,
} from '../lib/api'
import type { DocumentDetail, DocumentVersion, InvoiceData, InvoiceItem } from '../lib/types'

interface DocumentEditorProps {
  documentId: string
  onClose: () => void
  onSaved: (doc: DocumentDetail) => void
}

export function DocumentEditor({ documentId, onClose, onSaved }: DocumentEditorProps) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [data, setData] = useState<InvoiceData | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [viewingVersion, setViewingVersion] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getDocument(documentId), listDocumentVersions(documentId)])
      .then(([d, v]) => {
        setDoc(d)
        setData(d.data)
        setVersions(v)
        setViewingVersion(d.version)
      })
      .catch((e) => setError((e as Error).message))
  }, [documentId])

  const loadVersion = async (version: number) => {
    try {
      const d = await getDocument(documentId, version)
      setData(d.data)
      setViewingVersion(version)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const dirty = useMemo(
    () => doc && data && JSON.stringify(data) !== JSON.stringify(doc.data),
    [doc, data],
  )

  const save = async (status?: 'draft' | 'final') => {
    if (!data) return
    setBusy(true)
    setError(null)
    try {
      // Saving always creates a new version server-side — nothing is overwritten.
      const next = await updateDocument(documentId, data, status)
      setDoc(next)
      setData(next.data)
      setVersions(await listDocumentVersions(documentId))
      setViewingVersion(next.version)
      onSaved(next)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!doc || !data) {
    return (
      <Modal title="Loading document…" onClose={onClose} wide>
        <p className="py-8 text-center text-sm text-ink-faint">
          {error ?? 'Loading…'}
        </p>
      </Modal>
    )
  }

  const set = (patch: Partial<InvoiceData>) => setData((d) => (d ? { ...d, ...patch } : d))
  const setItem = (i: number, patch: Partial<InvoiceItem>) =>
    setData((d) =>
      d ? { ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) } : d,
    )

  const subtotal = data.items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
  const total = subtotal * (1 + data.tax_rate / 100)
  const isOldVersion = viewingVersion !== null && viewingVersion !== doc.version

  return (
    <Modal
      title={doc.title}
      subtitle={`Version ${viewingVersion} of ${doc.version} · ${doc.status}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {versions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2">
            <History size={13} className="mr-1 text-ink-faint" />
            {versions.map((v) => (
              <button
                key={v.version}
                onClick={() => loadVersion(v.version)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  v.version === viewingVersion
                    ? 'bg-primary text-white'
                    : 'text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                v{v.version}
              </button>
            ))}
            {isOldVersion && (
              <span className="ml-auto text-xs text-ink-faint">
                Viewing an older version — saving creates a new one on top.
              </span>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>Invoice number</label>
            <input
              className={inputCls}
              value={data.invoice_number}
              onChange={(e) => set({ invoice_number: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Issue date</label>
            <input
              type="date"
              className={inputCls}
              value={data.issue_date}
              onChange={(e) => set({ issue_date: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Due date</label>
            <input
              type="date"
              className={inputCls}
              value={data.due_date}
              onChange={(e) => set({ due_date: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>From</label>
            <input
              className={inputCls + ' mb-2'}
              value={data.from_name}
              onChange={(e) => set({ from_name: e.target.value })}
            />
            <textarea
              className={inputCls + ' min-h-[60px] resize-y'}
              value={data.from_details}
              onChange={(e) => set({ from_details: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Billed to</label>
            <input
              className={inputCls + ' mb-2'}
              value={data.client_name}
              onChange={(e) => set({ client_name: e.target.value })}
            />
            <textarea
              className={inputCls + ' min-h-[60px] resize-y'}
              value={data.client_details}
              onChange={(e) => set({ client_details: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Line items</label>
          <div className="space-y-2">
            {data.items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputCls + ' flex-1'}
                  value={it.description}
                  onChange={(e) => setItem(i, { description: e.target.value })}
                />
                <input
                  className={inputCls + ' w-16 text-right md:w-20'}
                  value={it.quantity}
                  onChange={(e) => setItem(i, { quantity: Number(e.target.value) || 0 })}
                  inputMode="decimal"
                />
                <input
                  className={inputCls + ' w-24 text-right md:w-28'}
                  value={it.unit_price}
                  onChange={(e) => setItem(i, { unit_price: Number(e.target.value) || 0 })}
                  inputMode="decimal"
                />
                <button
                  onClick={() =>
                    setData((d) =>
                      d ? { ...d, items: d.items.filter((_, idx) => idx !== i) } : d,
                    )
                  }
                  disabled={data.items.length === 1}
                  className="shrink-0 rounded-lg p-2 text-ink-faint hover:text-red-500 disabled:opacity-30"
                  aria-label="Remove line item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() =>
                setData((d) =>
                  d
                    ? {
                        ...d,
                        items: [...d.items, { description: '', quantity: 1, unit_price: 0 }],
                      }
                    : d,
                )
              }
              className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              <Plus size={13} />
              Add line item
            </button>
            <span className="text-sm text-ink-muted">
              Total:{' '}
              <span className="font-semibold text-ink">
                {data.currency} {total.toFixed(2)}
              </span>{' '}
              <span className="text-xs text-ink-faint">(incl. {data.tax_rate}% tax)</span>
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>Payment terms</label>
            <textarea
              className={inputCls + ' min-h-[70px] resize-y'}
              value={data.terms}
              onChange={(e) => set({ terms: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={inputCls + ' min-h-[70px] resize-y'}
              value={data.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </div>

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-4">
          <a
            href={documentPdfUrl(documentId, viewingVersion ?? undefined)}
            className={ghostBtnCls + ' flex items-center gap-1.5'}
          >
            <Download size={14} />
            Export PDF
          </a>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={ghostBtnCls} disabled={busy}>
              Close
            </button>
            <button
              onClick={() => save('final')}
              className={ghostBtnCls}
              disabled={busy || (doc.status === 'final' && !dirty && !isOldVersion)}
            >
              {busy ? 'Saving…' : 'Save as final'}
            </button>
            <button
              onClick={() => save('draft')}
              className={primaryBtnCls}
              disabled={busy || (!dirty && !isOldVersion)}
            >
              {busy ? 'Saving…' : 'Save new version'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
