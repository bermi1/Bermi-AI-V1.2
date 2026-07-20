import { useRef, useState } from 'react'
import { Building2, GraduationCap, Loader2, RotateCcw, Upload, User } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, primaryBtnCls } from './Modal'
import { extractFile, resetVibeBrain, saveBrain } from '../lib/api'
import type { Brain } from '../lib/types'

interface BrainEditorProps {
  brain: Brain
  onClose: () => void
  onSaved: () => void
}

const ICONS: Record<Brain['id'], typeof Building2> = {
  company: Building2,
  personal: User,
  vibecoding: GraduationCap,
}

const PLACEHOLDERS: Record<Brain['id'], string> = {
  company:
    'Everything Bermi should know about your company:\n\n' +
    '• Company name, what you do, who your clients are\n' +
    '• Products, services, and pricing\n' +
    '• Brand voice, boilerplate, payment details for invoices\n' +
    '• Key people and how to refer to them',
  personal:
    'Everything Bermi should know about you:\n\n' +
    '• Your role and responsibilities\n' +
    '• How you like to work and communicate\n' +
    '• Ongoing projects and priorities\n' +
    '• Anything you are tired of repeating in every chat',
  vibecoding:
    'Teaching knowledge for the Vibe Coding Instructor.\n\n' +
    'Upload guides, articles, and notes about vibe coding — they are added\n' +
    'here and used in every conversation.',
}

const ACCEPT = '.txt,.md,.markdown,.csv,.json,.xml,.yml,.yaml,.log,.pdf,.docx'

export function BrainEditor({ brain, onClose, onSaved }: BrainEditorProps) {
  const [content, setContent] = useState(brain.content)
  const [enabled, setEnabled] = useState(brain.enabled)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const Icon = ICONS[brain.id] ?? Building2

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveBrain(brain.id, content, enabled)
      onSaved()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const addFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const extracted = await extractFile(file)
      setContent(
        (cur) =>
          `${cur.trimEnd()}\n\n## Knowledge from ${extracted.name}${
            extracted.truncated ? ' (truncated)' : ''
          }\n\n${extracted.text}\n`,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const restoreDefault = async () => {
    setBusy(true)
    setError(null)
    try {
      const fresh = await resetVibeBrain()
      setContent(fresh.content)
      setEnabled(fresh.enabled)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={brain.name}
      subtitle="Persistent knowledge, injected into every conversation while enabled"
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon size={15} />
            </div>
            <span className="text-sm font-medium">
              {enabled ? 'Active in conversations' : 'Paused'}
            </span>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            role="switch"
            aria-checked={enabled}
            aria-label={`Toggle ${brain.name}`}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              enabled ? 'bg-primary' : 'bg-edge-strong'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                enabled ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Feed knowledge from files */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) addFile(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-edge-strong px-3 py-2 text-[13px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary-soft disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Extracting knowledge…' : 'Add knowledge from file'}
          </button>
          <span className="text-[11.5px] text-ink-faint">
            .txt, .md, .csv, .json, .docx, .pdf — text is extracted and appended below
          </span>
          {brain.id === 'vibecoding' && (
            <button
              onClick={restoreDefault}
              disabled={busy}
              className="ml-auto flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken"
              title="Restore the built-in vibe coding curriculum"
            >
              <RotateCcw size={13} />
              Restore default curriculum
            </button>
          )}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={PLACEHOLDERS[brain.id]}
          className={inputCls + ' min-h-[300px] resize-y font-mono text-[13px] leading-relaxed'}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-faint">
            {content.trim() ? `${content.trim().split(/\s+/).length} words` : 'Empty'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className={ghostBtnCls} disabled={busy}>
              Cancel
            </button>
            <button onClick={save} className={primaryBtnCls} disabled={busy || uploading}>
              {busy ? 'Saving…' : 'Save brain'}
            </button>
          </div>
        </div>
        {error && <p className="text-[13px] text-red-500">{error}</p>}
      </div>
    </Modal>
  )
}
