import { useState, useCallback, useRef } from 'react'
import { AudioRecorder, RecordingResult } from '../lib/audio'

type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped'

export interface UseRecorderReturn {
  state: RecorderState
  audioBlob: Blob | null
  duration: number
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<RecordingResult | null>
  reset: () => void
}

export function useRecorder(): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<AudioRecorder | null>(null)
  const timerRef = useRef<number | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setState('requesting')
      setError(null)

      const recorder = new AudioRecorder()
      recorderRef.current = recorder

      await recorder.start()

      setState('recording')
      setDuration(0)

      // Start duration timer
      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    } catch (err) {
      setState('idle')
      setError(err instanceof Error ? err.message : 'Failed to start recording')
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (!recorderRef.current) return null

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      const result = await recorderRef.current.stop()
      setAudioBlob(result.blob)
      setState('stopped')
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording')
      setState('idle')
      return null
    }
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setState('idle')
    setAudioBlob(null)
    setDuration(0)
    setError(null)
    recorderRef.current = null
  }, [])

  return {
    state,
    audioBlob,
    duration,
    error,
    startRecording,
    stopRecording,
    reset
  }
}
