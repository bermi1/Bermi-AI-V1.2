import { useEffect, useRef, useState } from 'react'
import { Loader2, PhoneOff } from 'lucide-react'
import { useLiveVoiceRecorder } from '../lib/useLiveVoiceRecorder'
import { transcribeAudio, ttsStatus } from '../lib/api'
import { BermiMark } from './Logo'

interface VoiceModeProps {
  onClose: () => void
  /** Sends the transcribed text through the normal chat pipeline. */
  onTranscript: (text: string) => void
  /** True while the assistant is streaming a reply. */
  thinking: boolean
  /** True while the reply's synthesized speech is playing. */
  speaking: boolean
  /** Set when the parent's attempt to speak the last reply failed — surfaced
   * here instead of failing silently, since a "call" with no audible reply
   * and no explanation just looks broken. */
  voiceError: string | null
  lastAssistantText: string
}

/**
 * A hands-free "phone call with Bermi": opening it starts listening right
 * away, silence detection decides when you've finished a turn (no tap-to-
 * send), and once Bermi's spoken reply finishes it automatically starts
 * listening for the next turn — a continuous loop, like a live agent call,
 * until you hang up. Distinct from the inline dictation mic in InputBar
 * (manual stop, fills the composer for review) — this sends immediately by
 * design, since the whole point is never touching the screen mid-call.
 */
export function VoiceMode({ onClose, onTranscript, thinking, speaking, voiceError, lastAssistantText }: VoiceModeProps) {
  const mic = useLiveVoiceRecorder(async (blob) => {
    const text = await transcribeAudio(blob)
    if (text.trim()) onTranscript(text.trim())
  })

  // Checked once up front so "Bermi never talks back" has an immediate,
  // visible explanation instead of only surfacing after the first turn (via
  // voiceError) — most likely to matter the very first time someone opens a
  // call before any provider key has been configured for TTS.
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    ttsStatus()
      .then((s) => setTtsAvailable(s.available))
      .catch(() => setTtsAvailable(null))
  }, [])

  // Answer the "call" immediately on open — no tap required to begin.
  const started = useRef(false)
  useEffect(() => {
    if (!started.current) {
      started.current = true
      mic.start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The loop: the moment Bermi finishes speaking, start listening again
  // automatically — this is what makes it feel like a call instead of a
  // manual record → transcribe → send cycle repeated by hand.
  const wasBusy = useRef(false)
  useEffect(() => {
    const busyNow = thinking || speaking
    if (wasBusy.current && !busyNow && mic.phase === 'idle') {
      mic.start()
    }
    wasBusy.current = busyNow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking, speaking])

  useEffect(() => {
    return () => mic.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phase = mic.phase === 'listening' ? 'listening' : thinking ? 'thinking' : speaking ? 'speaking' : mic.phase === 'processing' ? 'transcribing' : 'idle'

  const label = {
    idle: 'One moment…',
    listening: "Listening — just talk, I'll know when you're done",
    transcribing: 'Got it, one sec…',
    thinking: 'Bermi is thinking…',
    speaking: 'Bermi is speaking…',
  }[phase]

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface/97 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full p-2.5 text-ink-muted hover:bg-surface-sunken"
        aria-label="End call"
      >
        <PhoneOff size={20} />
      </button>

      <div className="relative mb-6">
        <BermiMark size={40} className={`text-primary ${phase === 'speaking' ? 'animate-pulse' : ''}`} />
        {phase === 'listening' && (
          <span className="absolute -inset-3 -z-10 animate-ping rounded-full bg-primary-soft" />
        )}
      </div>

      <div className="mb-10 max-w-sm px-6 text-center">
        <p className="text-[16px] font-medium text-ink">{label}</p>
        {lastAssistantText && phase !== 'listening' && (
          <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-ink-faint">{lastAssistantText}</p>
        )}
        {mic.error && <p className="mt-2 text-[13px] text-rose-500">{mic.error}</p>}
        {voiceError && <p className="mt-2 text-[13px] text-rose-500">{voiceError}</p>}
        {ttsAvailable === false && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-600 dark:text-amber-400">
            Bermi can still hear you, but can't talk back yet — no text-to-speech provider is set up. An admin can
            add one in Admin → AI Providers (a Groq key enables free voices automatically).
          </p>
        )}
      </div>

      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-all ${
          phase === 'listening'
            ? 'scale-110 bg-primary text-white'
            : phase === 'speaking'
              ? 'bg-primary/80 text-white'
              : 'bg-surface-sunken text-ink-faint'
        }`}
      >
        {phase === 'thinking' || phase === 'transcribing' ? (
          <Loader2 size={30} className="animate-spin" />
        ) : (
          <BermiMark size={30} />
        )}
      </div>

      <button onClick={onClose} className="mt-10 text-[13px] font-medium text-ink-faint hover:text-ink-muted">
        End call
      </button>
    </div>
  )
}
