import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Globe, GraduationCap, Loader2, Share2, StopCircle, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react'
import type { Enrollment, Message } from '../lib/types'
import { learnMyEnrollments, sendFeedback, synthesizeSpeech } from '../lib/api'
import { Markdown } from './Markdown'
import { BermiMark } from './Logo'

interface ChatPanelProps {
  messages: Message[]
  streaming: boolean
  steps: string[]
  error: string | null
  userName?: string
  onStudyCourse?: (title: string) => void
}

const SOURCES_MARKER = '\n\n---\n**Sources**\n'

interface Source {
  n: string
  title: string
  url: string
}

// Split an assistant message into its prose body and any inline "Sources"
// block (persisted by the server / appended live in the same format).
function splitSources(content: string): { body: string; sources: Source[] } {
  const idx = content.indexOf(SOURCES_MARKER)
  if (idx === -1) return { body: content, sources: [] }
  const body = content.slice(0, idx)
  const raw = content.slice(idx + SOURCES_MARKER.length)
  const sources: Source[] = []
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\d+)\.\s*\[([^\]]+)\]\(([^)]+)\)/)
    if (m) sources.push({ n: m[1], title: m[2], url: m[3] })
  }
  return { body, sources }
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function ChatPanel({ messages, streaming, steps, error, userName, onStudyCourse }: ChatPanelProps) {
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
          <ContinueLearning onStudyCourse={onStudyCourse} />
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
          if (m.role === 'user') {
            return (
              <div key={m.id} className="group mb-6 flex flex-col items-end animate-fade-up">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-2.5 text-[15px] leading-relaxed text-ink md:max-w-[75%]">
                  {m.content}
                </div>
                <div className="opacity-0 transition-opacity group-hover:opacity-100">
                  <MessageActions text={m.content} compact />
                </div>
              </div>
            )
          }
          const { body, sources } = splitSources(m.content)
          const shareText =
            body + (sources.length ? '\n\nSources:\n' + sources.map((s) => `- ${s.title} (${s.url})`).join('\n') : '')
          return (
            <div key={m.id} className="mb-6 flex gap-3 animate-fade-up">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <BermiMark size={17} className="text-primary" />
              </div>
              <div className={`min-w-0 flex-1 ${showCursor && m.content ? 'streaming-cursor' : ''}`}>
                {body ? (
                  <Markdown>{body}</Markdown>
                ) : showCursor && steps.length ? (
                  <ThinkingLoop steps={steps} />
                ) : (
                  showCursor && <span className="streaming-cursor text-ink-faint">&nbsp;</span>
                )}
                {sources.length > 0 && <SourcesPanel sources={sources} />}
                {!showCursor && body && <MessageActions text={shareText} messageId={m.id} rate />}
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
            {steps.length ? (
              <ThinkingLoop steps={steps} />
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

/** Gentle reminder of courses the learner started but hasn't finished. */
function ContinueLearning({ onStudyCourse }: { onStudyCourse?: (title: string) => void }) {
  const [items, setItems] = useState<Enrollment[]>([])

  useEffect(() => {
    learnMyEnrollments()
      .then((list) =>
        setItems(
          list
            .filter((e) => e.status !== 'completed' && e.course)
            .sort((a, b) => {
              const da = Object.values(a.progress || {}).filter((p) => p.done).length
              const db = Object.values(b.progress || {}).filter((p) => p.done).length
              return db - da
            })
            .slice(0, 2),
        ),
      )
      .catch(() => {})
  }, [])

  if (items.length === 0) return null

  return (
    <div className="mt-8 text-left">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
        <GraduationCap size={13} /> Pick up where you left off
      </div>
      <div className="space-y-2">
        {items.map((e) => {
          const done = Object.values(e.progress || {}).filter((p) => p.done).length
          return (
            <button
              key={e.id}
              onClick={() => onStudyCourse?.(e.course!.title)}
              className="flex w-full items-center gap-3 rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xl">
                {e.course!.cover_emoji || '📘'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{e.course!.title}</span>
                <span className="text-[11.5px] text-ink-faint">
                  {done > 0 ? `${done} ${done === 1 ? 'lesson' : 'lessons'} done — resume in chat` : 'Not started — begin in chat'}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-primary">Study →</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Copy / share / rate controls for a message. */
function MessageActions({
  text,
  compact,
  messageId,
  rate,
}: {
  text: string
  compact?: boolean
  messageId?: string
  rate?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [speaking, setSpeaking] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fbKey = messageId ? `bermi-fb-${messageId}` : ''
  const [vote, setVote] = useState<'up' | 'down' | null>(() => {
    if (!fbKey) return null
    const v = localStorage.getItem(fbKey)
    return v === 'up' || v === 'down' ? v : null
  })

  const setRating = (v: 'up' | 'down') => {
    const next = vote === v ? null : v
    setVote(next)
    if (fbKey) {
      if (next) localStorage.setItem(fbKey, next)
      else localStorage.removeItem(fbKey)
    }
    if (messageId) sendFeedback(messageId, next)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  // Strip Markdown syntax and code blocks so the voice reads prose, not
  // literal asterisks and fence markers.
  const speakableText = () =>
    text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*_`>~-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()

  const toggleListen = async () => {
    if (speaking === 'playing') {
      audioRef.current?.pause()
      setSpeaking('idle')
      return
    }
    setSpeaking('loading')
    try {
      const blob = await synthesizeSpeech(speakableText().slice(0, 2000))
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setSpeaking('idle')
      audio.onerror = () => setSpeaking('error')
      await audio.play()
      setSpeaking('playing')
    } catch {
      setSpeaking('error')
      setTimeout(() => setSpeaking('idle'), 2500)
    }
  }

  useEffect(() => () => audioRef.current?.pause(), [])

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        /* user cancelled */
      }
    } else {
      await copy()
      setShared(true)
      setTimeout(() => setShared(false), 1500)
    }
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-muted'

  return (
    <div className={`flex items-center gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
      <button onClick={copy} className={btn} aria-label="Copy">
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button onClick={share} className={btn} aria-label="Share">
        <Share2 size={13} />
        {shared ? 'Copied to share' : 'Share'}
      </button>
      <button onClick={toggleListen} className={btn} aria-label="Listen" disabled={speaking === 'loading'}>
        {speaking === 'loading' ? (
          <Loader2 size={13} className="animate-spin" />
        ) : speaking === 'playing' ? (
          <StopCircle size={13} className="text-primary" />
        ) : (
          <Volume2 size={13} />
        )}
        {speaking === 'loading' ? 'Loading…' : speaking === 'playing' ? 'Stop' : speaking === 'error' ? 'Unavailable' : 'Listen'}
      </button>
      {rate && (
        <>
          <span className="mx-0.5 h-4 w-px bg-edge" />
          <button
            onClick={() => setRating('up')}
            className={`rounded-lg p-1.5 transition-colors hover:bg-surface-sunken ${
              vote === 'up' ? 'text-emerald-500' : 'text-ink-faint hover:text-ink-muted'
            }`}
            aria-label="Good response"
            aria-pressed={vote === 'up'}
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => setRating('down')}
            className={`rounded-lg p-1.5 transition-colors hover:bg-surface-sunken ${
              vote === 'down' ? 'text-rose-500' : 'text-ink-faint hover:text-ink-muted'
            }`}
            aria-label="Bad response"
            aria-pressed={vote === 'down'}
          >
            <ThumbsDown size={13} />
          </button>
        </>
      )}
    </div>
  )
}

/** Collapsible list of web sources cited in an answer. */
function SourcesPanel({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-edge bg-surface-sunken px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <Globe size={13} className="text-primary" />
        Sources
        <span className="rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">{sources.length}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5">
          {sources.map((s) => (
            <li key={s.n} className="flex gap-2 text-[13px] leading-snug">
              <span className="mt-px shrink-0 text-ink-faint">{s.n}.</span>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 text-primary hover:underline"
              >
                <span className="line-clamp-1 font-medium">{s.title}</span>
                <span className="line-clamp-1 text-[11.5px] text-ink-faint">{s.url}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** The visible research loop — each step shown, done ones checked, last one live. */
function ThinkingLoop({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-edge bg-surface-sunken px-3.5 py-3 animate-fade-up">
      {steps.map((label, i) => {
        const isLast = i === steps.length - 1
        return (
          <div key={label} className="flex items-center gap-2 text-[13px]">
            {isLast ? (
              <Loader2 size={13} className="shrink-0 animate-spin text-primary" />
            ) : (
              <Check size={13} className="shrink-0 text-emerald-500" />
            )}
            <span className={isLast ? 'font-medium text-ink' : 'text-ink-faint'}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}
