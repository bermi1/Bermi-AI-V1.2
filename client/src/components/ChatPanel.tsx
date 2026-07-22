import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { Message } from '../lib/types'
import { Markdown } from './Markdown'
import { BermiMark } from './Logo'

interface ChatPanelProps {
  messages: Message[]
  streaming: boolean
  status: string | null
  error: string | null
  userName?: string
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function ChatPanel({ messages, streaming, status, error, userName }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
    }
  }, [messages, streaming])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <BermiMark size={44} className="mx-auto mb-5 text-primary" />
          <h1 className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
            {greeting()}
            {userName ? `, ${userName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            Ask anything, or open the Dashboard to generate documents, teach your brains,
            and connect your apps.
          </p>
        </div>
      </div>
    )
  }

  const last = messages[messages.length - 1]

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1
          const showCursor = streaming && isLast && m.role === 'assistant'
          return m.role === 'user' ? (
            <div key={m.id} className="mb-6 flex justify-end animate-fade-up">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-2.5 text-[15px] leading-relaxed text-ink md:max-w-[75%]">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="mb-6 flex gap-3 animate-fade-up">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <BermiMark size={17} className="text-primary" />
              </div>
              <div className={`min-w-0 flex-1 ${showCursor && m.content ? 'streaming-cursor' : ''}`}>
                {m.content ? (
                  <Markdown>{m.content}</Markdown>
                ) : showCursor && status ? (
                  <ThinkingLoop label={status} />
                ) : (
                  showCursor && <span className="streaming-cursor text-ink-faint">&nbsp;</span>
                )}
              </div>
            </div>
          )
        })}
        {error && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        {streaming && last?.role === 'user' && (
          <div className="mb-6 flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
              <BermiMark size={17} className="text-primary" />
            </div>
            {status ? (
              <ThinkingLoop label={status} />
            ) : (
              <span className="streaming-cursor text-ink-faint">&nbsp;</span>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

/** The visible "triangulating" work — searching, reading, synthesizing. */
function ThinkingLoop({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-edge bg-surface-sunken px-3 py-2 text-[13px] text-ink-muted animate-fade-up">
      <Loader2 size={14} className="animate-spin text-primary" />
      <span className="relative overflow-hidden">
        <span className="bg-gradient-to-r from-ink-muted via-ink to-ink-muted bg-[length:200%_100%] bg-clip-text text-transparent">
          {label}…
        </span>
      </span>
    </div>
  )
}
