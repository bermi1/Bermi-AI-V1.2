import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  ChevronDown,
  FileText,
  Globe,
  GraduationCap,
  Loader2,
  Mic,
  Paperclip,
  Square,
  X,
} from 'lucide-react'
import type { Attachment, ModelOption } from '../lib/types'
import { extractFile, transcribeAudio, type ChatQuota } from '../lib/api'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'

interface InputBarProps {
  models: ModelOption[]
  selectedModel: string
  onSelectModel: (id: string) => void
  onSend: (text: string, opts: { web: boolean; study: boolean; attachments?: Attachment[] }) => void
  onStop: () => void
  streaming: boolean
  study: boolean
  onToggleStudy: (v: boolean) => void
  quota?: ChatQuota | null
}

function formatResetIn(resetAt: number): string {
  const ms = resetAt - Date.now()
  if (ms <= 0) return 'now'
  const mins = Math.ceil(ms / 60_000)
  return mins <= 1 ? 'under a minute' : `${mins} minutes`
}

// Only surfaced once a user has burned through a meaningful chunk of their
// shared hourly quota — a constant "X left" badge on every message would be
// noise for the common case where nobody is anywhere near the limit. This is
// the "avoid reaching the limit" warning: it appears with time to spare, and
// gets louder the closer the reset gets.
function QuotaBadge({ quota }: { quota: ChatQuota }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  if (quota.max <= 0 || quota.remaining > quota.max * 0.5) return null
  const critical = quota.remaining <= Math.max(1, Math.ceil(quota.max * 0.15))
  return (
    <div
      className={`mb-1.5 text-center text-[11px] ${
        critical ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-ink-faint'
      }`}
    >
      {quota.remaining} of {quota.max} shared AI messages left this hour · resets in {formatResetIn(quota.resetAt)}
    </div>
  )
}

const ACCEPT =
  '.txt,.md,.markdown,.csv,.json,.xml,.yml,.yaml,.log,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,' +
  'text/plain,application/pdf,image/*'

export function InputBar({
  models,
  selectedModel,
  onSelectModel,
  onSend,
  onStop,
  streaming,
  study,
  onToggleStudy,
  quota,
}: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Web search is on by default — it's always there for current info.
  const [web, setWeb] = useState(() => localStorage.getItem('bermi-web') !== '0')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Dictation: record a clip, transcribe it, drop the text straight into the
  // composer for the user to review/edit before sending — deliberately NOT
  // auto-sent, since a misheard word here is just a normal typo to fix, not
  // an accidental message.
  const mic = useVoiceRecorder(async (blob) => {
    const transcript = await transcribeAudio(blob)
    if (transcript.trim()) setText((t) => (t.trim() ? `${t.trim()} ${transcript}` : transcript))
  })

  const current = models.find((m) => m.id === selectedModel)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  const pickFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const attachment = await extractFile(file)
      setAttachments((prev) => [...prev, attachment])
    } catch (e) {
      setUploadError((e as Error).message)
      setTimeout(() => setUploadError(null), 5000)
    } finally {
      setUploading(false)
    }
  }

  const submit = () => {
    const trimmed = text.trim()
    if ((!trimmed && attachments.length === 0) || streaming || uploading) return
    // The document text is sent as context for the model to read internally —
    // it is NOT dumped into the visible message.
    onSend(trimmed || 'Please review the attached document.', {
      web,
      study,
      attachments: attachments.length ? attachments : undefined,
    })
    setText('')
    setAttachments([])
  }

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-surface via-surface to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:px-6 md:pb-6">
      <div className="mx-auto w-full max-w-3xl">
        {quota && <QuotaBadge quota={quota} />}
        {study && (
          <div className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-primary-soft px-3 py-1.5 text-[12.5px] font-medium text-primary">
            <GraduationCap size={14} />
            Study Mode on — Bermi will teach you step by step and you'll earn XP.
          </div>
        )}
        <div
          className={`rounded-2xl border bg-surface-raised shadow-[0_2px_16px_rgba(0,0,0,0.06)] focus-within:border-primary/40 ${
            study ? 'border-primary/50' : 'border-edge'
          }`}
        >
          {(attachments.length > 0 || uploading || uploadError || mic.error) && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
              {attachments.map((a, i) => (
                <span
                  key={`${a.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-lg border border-edge bg-surface-sunken px-2.5 py-1.5 text-[12px] font-medium"
                >
                  <FileText size={12} className="text-primary" />
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-ink-faint hover:text-red-500"
                    aria-label={`Remove ${a.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {uploading && (
                <span className="flex items-center gap-1.5 rounded-lg border border-edge bg-surface-sunken px-2.5 py-1.5 text-[12px] text-ink-muted">
                  <Loader2 size={12} className="animate-spin" />
                  Reading file…
                </span>
              )}
              {uploadError && (
                <span className="text-[12px] text-red-500">{uploadError}</span>
              )}
              {mic.error && <span className="text-[12px] text-red-500">{mic.error}</span>}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder="Message Bermi…"
            className="w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-ink-faint"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) pickFile(file)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-muted disabled:opacity-40"
                title="Attach a file (.txt, .md, .csv, .json, .pdf, image)"
                aria-label="Attach file"
              >
                <Paperclip size={17} />
              </button>
              <button
                onClick={() => (mic.phase === 'recording' ? mic.stop() : mic.start())}
                disabled={mic.phase === 'processing'}
                className={`rounded-lg p-2 transition-colors hover:bg-surface-sunken disabled:opacity-40 ${
                  mic.phase === 'recording' ? 'text-rose-500' : 'text-ink-faint hover:text-ink-muted'
                }`}
                title={mic.phase === 'recording' ? 'Stop recording' : 'Speak your message'}
                aria-label={mic.phase === 'recording' ? 'Stop recording' : 'Speak your message'}
                aria-pressed={mic.phase === 'recording'}
              >
                {mic.phase === 'processing' ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Mic size={17} className={mic.phase === 'recording' ? 'animate-pulse' : ''} />
                )}
              </button>
              <button
                onClick={() =>
                  setWeb((v) => {
                    localStorage.setItem('bermi-web', v ? '0' : '1')
                    return !v
                  })
                }
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  web
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-faint hover:bg-surface-sunken hover:text-ink-muted'
                }`}
                title={web ? 'Web search is on — Bermi searches the internet' : 'Turn on web search'}
                aria-pressed={web}
              >
                <Globe size={16} />
                <span className="hidden sm:inline">Search</span>
              </button>
              <button
                onClick={() => onToggleStudy(!study)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  study
                    ? 'bg-primary text-white'
                    : 'text-ink-faint hover:bg-surface-sunken hover:text-ink-muted'
                }`}
                title="Study Mode — learn step by step and earn XP"
                aria-pressed={study}
              >
                <GraduationCap size={16} />
                <span className="hidden sm:inline">Study</span>
              </button>
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken"
                >
                  {current?.label ?? selectedModel}
                  <ChevronDown size={13} className="opacity-60" />
                </button>
                {pickerOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-xl border border-edge bg-surface-raised py-1.5 shadow-lg">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onSelectModel(m.id)
                          setPickerOpen(false)
                        }}
                        className={`block w-full px-3.5 py-2 text-left hover:bg-surface-sunken ${
                          m.id === selectedModel ? 'bg-primary-soft' : ''
                        }`}
                      >
                        <div className="text-[13.5px] font-medium">{m.label}</div>
                        {m.description && (
                          <div className="text-xs text-ink-faint">{m.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {streaming ? (
              <button
                onClick={onStop}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-surface transition-opacity hover:opacity-80"
                aria-label="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={(!text.trim() && attachments.length === 0) || uploading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-30"
                aria-label="Send message"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 hidden text-center text-xs text-ink-faint md:block">
          Bermi AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}
