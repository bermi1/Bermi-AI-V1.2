import { useEffect, useRef, useState } from 'react'

export type LivePhase = 'idle' | 'listening' | 'processing' | 'error'

// Tuned conservatively for typical laptop/phone mic gain and a quiet-ish
// room; not real voice-activity-detection ML, just an amplitude gate, but
// that's enough to tell "still talking" from "done talking" without asking
// the user to press anything.
const VOLUME_THRESHOLD = 14 // 0–255 scale from the analyser
const SILENCE_MS = 1100 // how long they must be quiet before a turn ends
const MIN_SPEECH_MS = 300 // ignore brief blips/clicks as if they were speech
const MAX_TURN_MS = 30_000 // hard safety cap so a stuck turn can't run forever

/**
 * The recorder behind Voice Mode's "live call" feel: once started it listens
 * continuously and decides FOR ITSELF when the user has stopped talking
 * (via simple mic-volume monitoring), then hands off the clip — no manual
 * "stop and send" tap required. This is deliberately separate from
 * useVoiceRecorder (the InputBar dictation mic), which stays manual-stop by
 * design since that flow is "review before sending", not a live back-and-forth.
 */
export function useLiveVoiceRecorder(onStop: (blob: Blob) => Promise<void> | void) {
  const [phase, setPhase] = useState<LivePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const abortedRef = useRef(false)

  const teardownAudio = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => teardownAudio, [])

  const start = async () => {
    setError(null)
    abortedRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        teardownAudio()
        // Hanging up mid-turn should discard the in-progress clip, not
        // transcribe and send it after the user already left the call.
        if (abortedRef.current) return
        setPhase('processing')
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          await onStop(blob)
          setPhase('idle')
        } catch (e) {
          setError((e as Error).message)
          setPhase('error')
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setPhase('listening')

      const turnStart = Date.now()
      let silenceStart: number | null = Date.now()
      let speechStart: number | null = null

      const tick = () => {
        if (recorderRef.current?.state !== 'recording') return
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const avg = sum / data.length
        const now = Date.now()

        if (avg > VOLUME_THRESHOLD) {
          if (speechStart == null) speechStart = now
          silenceStart = null
        } else if (silenceStart == null) {
          silenceStart = now
        }

        const spokeEnough = speechStart != null && now - speechStart >= MIN_SPEECH_MS
        const quietEnough = silenceStart != null && now - silenceStart >= SILENCE_MS
        const tooLong = now - turnStart >= MAX_TURN_MS

        if ((spokeEnough && quietEnough) || tooLong) {
          recorderRef.current.stop()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setError('Microphone access was blocked or unavailable.')
      setPhase('error')
    }
  }

  /** Cuts the current turn short instead of waiting for silence detection —
   * an escape hatch, not the normal path. Still transcribes and sends
   * whatever was captured. */
  const stop = () => recorderRef.current?.stop()

  /** Hangs up: discards whatever was captured so far instead of sending it. */
  const abort = () => {
    abortedRef.current = true
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    else teardownAudio()
    setPhase('idle')
  }

  return { phase, error, start, stop, abort }
}
