import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Presentation } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, primaryBtnCls } from './Modal'
import { Markdown } from './Markdown'
import * as api from '../lib/api'
import type { StudioDoc, StudioFormat } from '../lib/types'

const FORMATS: { id: StudioFormat; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'docx', label: 'Word', icon: FileText },
  { id: 'pptx', label: 'PowerPoint', icon: Presentation },
]

export function StudioViewer({
  documentId,
  onClose,
  onSaved,
}: {
  documentId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [doc, setDoc] = useState<StudioDoc | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getStudioDoc(documentId)
      .then((d) => {
        setDoc(d)
        setMarkdown(d.data.markdown)
      })
      .catch((e) => setError((e as Error).message))
  }, [documentId])

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await api.updateStudioDoc(documentId, { markdown })
      setDoc(next)
      setMarkdown(next.data.markdown)
      setEditing(false)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!doc) {
    return (
      <Modal title="Loading…" onClose={onClose} wide>
        <p className="py-8 text-center text-sm text-ink-faint">{error ?? 'Loading…'}</p>
      </Modal>
    )
  }

  return (
    <Modal title={doc.data.title} subtitle={`Version ${doc.version} · download in any format`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {FORMATS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={api.studioDownloadUrl(doc.id, id)}
              className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Download size={14} />
              {label}
              <Icon size={13} className="opacity-70" />
            </a>
          ))}
          <button
            onClick={() => setEditing((v) => !v)}
            className={ghostBtnCls + ' ml-auto'}
          >
            {editing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className={inputCls + ' min-h-[45vh] resize-y font-mono text-[13px] leading-relaxed'}
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-edge bg-surface p-5">
            <Markdown>{markdown}</Markdown>
          </div>
        )}

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-edge pt-4">
          <button onClick={onClose} className={ghostBtnCls}>
            Close
          </button>
          {editing && (
            <button onClick={save} disabled={busy} className={primaryBtnCls + ' flex items-center gap-2'}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              Save new version
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
