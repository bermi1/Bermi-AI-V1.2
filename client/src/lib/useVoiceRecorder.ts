import { useEffect, useRef, useState } from 'react'

export type RecorderPhase = 'idle' | 'recording' | 'processing' | 'error'

/**
 * Shared mic-recording primitive behind both the inline dictation button
 * (InputBar) and the full-screen Voice Mode overlay — records a clip via
 * MediaRecorder, then hands the raw Blob to `onStop` (transcription, upload,
 * whatever the caller needs) once recording ends.
 */
export function useVoiceRecorder(onStop: (blob: Blob) => Promise<void> | void) {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => stopTracks, [])

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stopTracks()
        setPhase('processing')
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          await onStop(blob)
          setPhase('idle')
        } catch (e) {
          setError((e as Error).message)
          setPhase('error')
          setTimeout(() => setPhase('idle'), 2500)
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setPhase('recording')
    } catch {
      setError('Microphone access was blocked or unavailable.')
      setPhase('error')
      setTimeout(() => setPhase('idle'), 2500)
    }
  }

  const stop = () => recorderRef.current?.stop()

  return { phase, error, start, stop }
}
