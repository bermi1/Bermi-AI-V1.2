import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Paperclip, Square } from 'lucide-react'
import type { ModelOption } from '../lib/types'

interface InputBarProps {
  models: ModelOption[]
  selectedModel: string
  onSelectModel: (id: string) => void
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
}

export function InputBar({
  models,
  selectedModel,
  onSelectModel,
  onSend,
  onStop,
  streaming,
}: InputBarProps) {
  const [text, setText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

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

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-surface via-surface to-transparent px-4 pb-4 pt-2 md:px-6 md:pb-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-edge bg-surface-raised shadow-[0_2px_16px_rgba(0,0,0,0.06)] focus-within:border-primary/40">
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
              <button
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-muted"
                title="Attach file (coming soon)"
                aria-label="Attach file"
              >
                <Paperclip size={17} />
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
                disabled={!text.trim()}
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
