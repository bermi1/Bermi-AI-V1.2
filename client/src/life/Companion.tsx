import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarClock, Check, Flag, ListTodo, Mic, MessageSquare, PiggyBank, Send, Square } from 'lucide-react'
import { lifeApi, LifeError, todayYmd, type Proposal, type ProposedAction } from './api'
import { btn, field, notifyLifeChanged, Sheet, Spinner, useToast, fmtDateShort, fmtMoney, fmtTime } from './ui'
import { newIdemKey } from './hooks'
import { useOptionalTheme } from '../lib/theme'
import { transcribeAudio } from '../lib/api'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'

// The assistant never touches data directly. It turns plain words into a
// *proposal*; the server validates it and checks conflicts deterministically;
// nothing changes until the person taps Confirm.

interface Ctl {
  open: (prefill?: string) => void
}
const CompanionCtx = createContext<Ctl>({ open: () => {} })
export const useCompanion = () => useContext(CompanionCtx)

const SUGGESTIONS = [
  'Study for 2 hours tomorrow afternoon',
  'Lecture Monday 10:00 to 12:00',
  'Save TZS 40,000 in two weeks',
  'Remind me to call mum at 6pm',
]

type SR = {
  new (): {
    lang: string
    interimResults: boolean
    continuous: boolean
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onerror: ((e: { error: string }) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
  }
}
const speechCtor = (): SR | null => {
  const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function CompanionProvider({ children, onOpenChat }: { children: ReactNode; onOpenChat: (text?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState('')
  const ctl = useMemo<Ctl>(
    () => ({
      open: (text) => {
        setPrefill(text ?? '')
        setOpen(true)
      },
    }),
    [],
  )
  return (
    <CompanionCtx.Provider value={ctl}>
      {children}
      <CompanionSheet open={open} prefill={prefill} onClose={() => setOpen(false)} onOpenChat={onOpenChat} />
    </CompanionCtx.Provider>
  )
}

function describe(a: ProposedAction): { icon: ReactNode; title: string; detail: string } {
  const d = a.data as Record<string, any>
  switch (a.type) {
    case 'event':
      return {
        icon: <CalendarClock size={16} />,
        title: String(d.title),
        detail: `${fmtDateShort(d.date)} · ${fmtTime(d.start)}–${fmtTime(d.end)}${d.place ? ` · ${d.place}` : ''}${d.recurring && d.recurring !== 'none' ? ` · repeats ${d.recurring}` : ''}`,
      }
    case 'task':
      return {
        icon: <ListTodo size={16} />,
        title: String(d.title),
        detail: d.date ? `${fmtDateShort(d.date)}${d.time ? ` · ${fmtTime(d.time)}` : ''}${d.durationMin ? ` · ${d.durationMin} min` : ''}` : 'No date — goes to your inbox',
      }
    case 'saving':
      return {
        icon: <PiggyBank size={16} />,
        title: String(d.title),
        detail: `Plan to set aside ${fmtMoney(Number(d.targetAmount), String(d.currency || 'TZS'))} by ${fmtDateShort(d.dueDate)} — planning only, no money moves`,
      }
    default:
      return { icon: <Flag size={16} />, title: String(d.title), detail: d.dueDate ? `Due ${fmtDateShort(d.dueDate)}` : 'Goal' }
  }
}

function Orb({ state, style }: { state: 'idle' | 'listening' | 'thinking'; style: 'orb' | 'wave' }) {
  const theme = useOptionalTheme()
  const calm = theme?.reducedMotion
  const active = state !== 'idle' && !calm
  if (style === 'wave') {
    return (
      <div className="flex h-14 items-center justify-center gap-1" aria-hidden>
        {[0.5, 0.8, 1, 0.7, 0.9, 0.6, 0.45].map((h, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-primary"
            style={{
              height: `${h * (active ? 100 : 55)}%`,
              opacity: state === 'idle' ? 0.55 : 1,
              animation: active ? `bermi-bar 1.1s ease-in-out ${i * 0.09}s infinite alternate` : undefined,
              transition: 'height .3s',
            }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="relative mx-auto h-14 w-14" aria-hidden>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--primary) 35%, white), var(--primary) 62%)',
          boxShadow: '0 6px 26px color-mix(in srgb, var(--primary) 45%, transparent)',
          animation: active ? 'bermi-orb 1.8s ease-in-out infinite' : undefined,
        }}
      />
    </div>
  )
}

function CompanionSheet({ open, prefill, onClose, onOpenChat }: { open: boolean; prefill: string; onClose: () => void; onOpenChat: (t?: string) => void }) {
  const toast = useToast()
  const theme = useOptionalTheme()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [error, setError] = useState<{ message: string; refunded?: boolean } | null>(null)
  const [applying, setApplying] = useState(false)
  const idem = useRef(newIdemKey())
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setText(prefill)
      setProposal(null)
      setError(null)
      idem.current = newIdemKey()
    }
  }, [open, prefill])

  // Voice: the browser's own recogniser when there is one (fast, on-device in
  // many browsers); otherwise record a clip and use Bermi's transcription.
  const [listening, setListening] = useState(false)
  const recRef = useRef<InstanceType<SR> | null>(null)
  const clip = useVoiceRecorder(async (blob) => {
    const t = await transcribeAudio(blob)
    if (t) setText((cur) => (cur ? `${cur} ${t}` : t))
  })
  const canNative = typeof window !== 'undefined' && !!speechCtor()
  const canClip = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  const voiceOk = canNative || canClip

  const toggleVoice = () => {
    if (canNative) {
      if (listening) {
        recRef.current?.stop()
        return
      }
      const Ctor = speechCtor()!
      const rec = new Ctor()
      rec.lang = navigator.language || 'en-US'
      rec.interimResults = false
      rec.continuous = false
      rec.onresult = (e) => {
        const t = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim()
        if (t) setText((cur) => (cur ? `${cur} ${t}` : t))
      }
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Microphone access is blocked. You can still type.', 'error')
        else if (e.error !== 'aborted' && e.error !== 'no-speech') toast("Couldn't hear that — try again or type it.", 'error')
      }
      rec.onend = () => setListening(false)
      recRef.current = rec
      setListening(true)
      rec.start()
    } else if (clip.phase === 'recording') clip.stop()
    else clip.start()
  }
  useEffect(() => () => recRef.current?.stop(), [])
  useEffect(() => {
    if (clip.error) toast(clip.error, 'error')
  }, [clip.error, toast])

  const state = busy ? 'thinking' : listening || clip.phase === 'recording' ? 'listening' : 'idle'

  const submit = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    setError(null)
    setProposal(null)
    try {
      const now = new Date()
      const p = await lifeApi.plan({ text: t, date: todayYmd(now), time: now.toTimeString().slice(0, 5), idemKey: idem.current })
      setProposal(p)
      idem.current = newIdemKey()
    } catch (e) {
      const le = e as LifeError
      setError({ message: le.message, refunded: le.refunded })
      // The same words after a failure are a fresh attempt.
      idem.current = newIdemKey()
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!proposal?.actions.length) return
    setApplying(true)
    try {
      const r = await lifeApi.apply(proposal.actions)
      const failed = r.results.filter((x) => !x.ok)
      if (failed.length) toast(`${r.applied} added, ${failed.length} couldn't be saved: ${failed[0].error ?? 'invalid'}`, 'error')
      else toast(r.applied === 1 ? 'Added' : `${r.applied} things added`)
      notifyLifeChanged()
      if (r.applied > 0) {
        setProposal(null)
        setText('')
        onClose()
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Bermi" side>
      <div className="flex min-h-full flex-col">
        <Orb state={state} style={theme?.prefs.assistant ?? 'orb'} />
        <p className="mt-3 text-center text-[13.5px] text-ink-muted" aria-live="polite">
          {state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Working out a plan…' : 'Tell me what to plan. I’ll show you before anything changes.'}
        </p>

        <div className="mt-4">
          <label htmlFor="companion-input" className="sr-only">What would you like to plan?</label>
          <textarea
            id="companion-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            rows={3}
            maxLength={600}
            placeholder="e.g. Study maths for 2 hours tomorrow after my lecture"
            className={`${field} resize-none`}
          />
          <div className="mt-2 flex items-center gap-2">
            {voiceOk && (
              <button
                type="button"
                onClick={toggleVoice}
                aria-pressed={state === 'listening'}
                aria-label={state === 'listening' ? 'Stop listening' : 'Speak instead of typing'}
                disabled={clip.phase === 'processing'}
                className={`${btn.ghost} !px-3 ${state === 'listening' ? '!border-primary !text-primary' : ''}`}
              >
                {clip.phase === 'processing' ? <Spinner /> : state === 'listening' ? <Square size={15} /> : <Mic size={16} />}
                <span className="hidden sm:inline">{state === 'listening' ? 'Stop' : 'Speak'}</span>
              </button>
            )}
            <button type="button" onClick={submit} disabled={!text.trim() || busy} className={`${btn.primary} ml-auto`}>
              {busy ? <Spinner /> : <Send size={15} />} Plan it
            </button>
          </div>
          {!voiceOk && <p className="mt-2 text-[12px] text-ink-faint">Voice input isn’t available in this browser — typing works everywhere.</p>}
        </div>

        {!proposal && !error && !busy && (
          <div className="mt-5">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Try</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => { setText(s); inputRef.current?.focus() }} className="min-h-[34px] rounded-full bg-surface-sunken px-3.5 text-[13px] text-ink-muted hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-2xl border border-edge bg-surface-sunken p-4 text-[13.5px]">
            <p className="font-medium">{error.message}</p>
            {error.refunded && <p className="mt-1 text-ink-muted">Nothing was charged.</p>}
          </div>
        )}

        {proposal && (
          <div className="mt-5" aria-live="polite">
            <p className="text-[14px] font-medium">{proposal.summary || 'Here’s what I’d add:'}</p>
            {proposal.actions.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-ink-muted">{proposal.message || 'I couldn’t turn that into something to add. Try giving a day and a time.'}</p>
            ) : (
              <ul className="mt-3 divide-y divide-edge rounded-2xl border border-edge">
                {proposal.actions.map((a) => {
                  const d = describe(a)
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-3.5 py-3">
                      <span className="mt-0.5 text-primary">{d.icon}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">{d.title}</p>
                        <p className="text-[12.5px] text-ink-muted">{d.detail}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {proposal.conflicts.length > 0 && (
              <div role="alert" className="mt-3 flex gap-2.5 rounded-2xl bg-primary-soft p-3.5 text-[13px]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="font-semibold text-primary">Heads up — this overlaps something</p>
                  <ul className="mt-1 space-y-0.5 text-ink-muted">
                    {proposal.conflicts.slice(0, 4).map((c, i) => (
                      <li key={i}>
                        {fmtDateShort(c.date)}: “{c.aTitle}” and “{c.bTitle}” clash for {c.overlap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {proposal.actions.length > 0 && (
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={confirm} disabled={applying} className={`${btn.primary} flex-1`}>
                  {applying ? <Spinner /> : <Check size={16} />} Confirm
                </button>
                <button type="button" onClick={() => setProposal(null)} className={btn.ghost}>Discard</button>
              </div>
            )}
            {typeof proposal.creditsUsed === 'number' && proposal.creditsUsed > 0 && (
              <p className="mt-3 text-[12px] text-ink-faint">
                Used {proposal.creditsUsed} AI credit{proposal.creditsUsed === 1 ? '' : 's'}
                {typeof proposal.balance === 'number' ? ` · ${proposal.balance} left this month` : ''}. Credits are not money.
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={() => { onClose(); onOpenChat(text.trim() || undefined) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <MessageSquare size={15} /> Open the full chat instead
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function useCompanionShortcut() {
  const { open } = useCompanion()
  const cb = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open()
      }
    },
    [open],
  )
  useEffect(() => {
    window.addEventListener('keydown', cb)
    return () => window.removeEventListener('keydown', cb)
  }, [cb])
}
