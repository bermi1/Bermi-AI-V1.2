import { useEffect } from 'react'
import { Loader2, Mic, Square, X } from 'lucide-react'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'
import { transcribeAudio } from '../lib/api'
import { BermiMark } from './Logo'

interface VoiceModeProps {
  onClose: () => void
  /** Sends the transcribed text through the normal chat pipeline. */
  onTranscript: (text: string) => void
  /** True while the assistant is streaming a reply. */
  thinking: boolean
  /** True while the reply's synthesized speech is playing. */
  speaking: boolean
  lastAssistantText: string
}

/**
 * A hands-free, full-screen "phone call with Bermi": tap to speak, release
 * to send, listen to the spoken reply, tap again for the next turn. Distinct
 * from the inline dictation mic in InputBar (which fills the composer for
 * the user to review) — here the transcript is sent immediately, since the
 * whole point is not touching the keyboard.
 */
export function VoiceMode({ onClose, onTranscript, thinking, speaking, lastAssistantText }: VoiceModeProps) {
  const mic = useVoiceRecorder(async (blob) => {
    const text = await transcribeAudio(blob)
    if (text.trim()) onTranscript(text.trim())
  })

  // Stop mid-recording cleanly if the overlay is closed while listening.
  useEffect(() => {
    return () => {
      if (mic.phase === 'recording') mic.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = thinking || speaking || mic.phase === 'processing'
  const phase = mic.phase === 'recording' ? 'recording' : thinking ? 'thinking' : speaking ? 'speaking' : mic.phase === 'processing' ? 'transcribing' : 'idle'

  const label = {
    idle: 'Tap to speak',
    recording: 'Listening — tap to send',
    transcribing: 'Transcribing…',
    thinking: 'Bermi is thinking…',
    speaking: 'Bermi is speaking…',
  }[phase]

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface/97 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full p-2.5 text-ink-muted hover:bg-surface-sunken"
        aria-label="Close voice mode"
      >
        <X size={20} />
      </button>

      <BermiMark size={36} className={`mb-6 text-primary ${phase === 'speaking' ? 'animate-pulse' : ''}`} />

      <div className="mb-10 max-w-sm px-6 text-center">
        <p className="text-[16px] font-medium text-ink">{label}</p>
        {lastAssistantText && phase !== 'recording' && (
          <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-ink-faint">{lastAssistantText}</p>
        )}
        {mic.error && <p className="mt-2 text-[13px] text-rose-500">{mic.error}</p>}
      </div>

      <button
        onClick={() => (phase === 'recording' ? mic.stop() : phase === 'idle' ? mic.start() : undefined)}
        disabled={busy && phase !== 'recording'}
        className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-all ${
          phase === 'recording'
            ? 'scale-110 bg-rose-500 text-white'
            : busy
              ? 'bg-surface-sunken text-ink-faint'
              : 'bg-primary text-white hover:bg-primary-hover'
        }`}
        aria-label={phase === 'recording' ? 'Stop and send' : 'Start speaking'}
      >
        {busy && phase !== 'recording' ? (
          <Loader2 size={30} className="animate-spin" />
        ) : phase === 'recording' ? (
          <Square size={26} fill="currentColor" />
        ) : (
          <Mic size={30} />
        )}
      </button>
    </div>
  )
}
