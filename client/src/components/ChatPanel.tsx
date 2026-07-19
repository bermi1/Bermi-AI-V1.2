import { useEffect, useRef } from 'react'
import type { Message } from '../lib/types'
import { Markdown } from './Markdown'

interface ChatPanelProps {
  messages: Message[]
  streaming: boolean
  error: string | null
}

export function ChatPanel({ messages, streaming, error }: ChatPanelProps) {
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
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl font-bold text-primary">
            B
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            How can Bermi help you today?
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            Ask anything, or generate an invoice from the Documents panel — drafts land
            there as editable, exportable cards.
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
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                B
              </div>
              <div className={`min-w-0 flex-1 ${showCursor ? 'streaming-cursor' : ''}`}>
                {m.content ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  showCursor && <span className="text-ink-faint">&nbsp;</span>
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
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
              B
            </div>
            <span className="streaming-cursor text-ink-faint">&nbsp;</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
