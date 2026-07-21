import { useState } from 'react'
import { Download, FileText, Loader2, Presentation, Sparkles, Wand2 } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, labelCls, primaryBtnCls } from './Modal'
import * as api from '../lib/api'
import { Markdown } from './Markdown'
import type { StudioDoc, StudioFormat } from '../lib/types'

interface StudioModalProps {
  onClose: () => void
  onSaved: () => void
}

const KINDS = [
  { id: 'report', label: 'Report' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'letter', label: 'Letter' },
  { id: 'essay', label: 'Essay' },
  { id: 'plan', label: 'Plan' },
  { id: 'notes', label: 'Notes' },
  { id: 'resume', label: 'Resume' },
  { id: 'slides', label: 'Slides' },
]

const FORMATS: { id: StudioFormat; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'docx', label: 'Word', icon: FileText },
  { id: 'pptx', label: 'PowerPoint', icon: Presentation },
]

export function StudioModal({ onClose, onSaved }: StudioModalProps) {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState('report')
  const [format, setFormat] = useState<StudioFormat>('pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<StudioDoc | null>(null)

  const generate = async () => {
    if (!prompt.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.generateStudioDoc({ title, prompt, kind, format })
      setDoc(created)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (doc) {
    return (
      <Modal
        title={doc.data.title}
        subtitle="Your document is ready — download it in any format"
        onClose={onClose}
        wide
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
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
          </div>
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-edge bg-surface p-5">
            <Markdown>{doc.data.markdown}</Markdown>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setDoc(null)} className={ghostBtnCls}>
              Create another
            </button>
            <button onClick={onClose} className={primaryBtnCls}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Create a document"
      subtitle="Describe it — Bermi writes it and gives you Word, PowerPoint, and PDF"
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Document type</label>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  kind === k.id
                    ? 'bg-primary text-white'
                    : 'border border-edge text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Title (optional)</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bermi will pick one if you leave this blank"
          />
        </div>

        <div>
          <label className={labelCls}>What should it contain?</label>
          <textarea
            className={inputCls + ' min-h-[130px] resize-y'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A one-page proposal to CRDB Bank for event media coverage, TZS pricing, 3 packages, professional tone."
          />
        </div>

        <div>
          <label className={labelCls}>Default download format</label>
          <div className="flex gap-2">
            {FORMATS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFormat(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  format === id
                    ? 'border border-primary bg-primary-soft text-primary'
                    : 'border border-edge text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-edge pt-4">
          <button onClick={onClose} className={ghostBtnCls} disabled={busy}>
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={busy || !prompt.trim()}
            className={primaryBtnCls + ' flex items-center gap-2'}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {busy ? 'Writing…' : 'Generate document'}
          </button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-faint">
          <Sparkles size={12} className="text-primary" />
          Powered by Bermi's free models — export to Word, PowerPoint, or PDF.
        </p>
      </div>
    </Modal>
  )
}
