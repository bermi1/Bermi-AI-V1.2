import { useState } from 'react'
import { Building2, User } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, primaryBtnCls } from './Modal'
import { saveBrain } from '../lib/api'
import type { Brain } from '../lib/types'

interface BrainEditorProps {
  brain: Brain
  onClose: () => void
  onSaved: () => void
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
}

export function BrainEditor({ brain, onClose, onSaved }: BrainEditorProps) {
  const [content, setContent] = useState(brain.content)
  const [enabled, setEnabled] = useState(brain.enabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const Icon = brain.id === 'company' ? Building2 : User

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
            <button onClick={save} className={primaryBtnCls} disabled={busy}>
              {busy ? 'Saving…' : 'Save brain'}
            </button>
          </div>
        </div>
        {error && <p className="text-[13px] text-red-500">{error}</p>}
      </div>
    </Modal>
  )
}
