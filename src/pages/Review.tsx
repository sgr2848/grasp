import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useRecorder } from '@/hooks/useRecorder'
import { usePreferences } from '@/context/PreferencesContext'
import { useTTS } from '@/context/TTSContext'
import {
  getLoop,
  submitAttempt,
  transcribeAudio,
  type LoopWithDetails,
  type LoopAttempt,
} from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { analyzeSpeech } from '@/lib/speechAnalysis'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Spinner } from '@/components/ui/Spinner'

type ReviewPhase = 'loading' | 'intro' | 'record' | 'processing' | 'results' | 'error'

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong'
}

export default function Review() {
  const { loopId } = useParams()
  const navigate = useNavigate()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { selectedPersona } = usePreferences()
  const { enabled: ttsEnabled, speak } = useTTS()

  const [phase, setPhase] = useState<ReviewPhase>('loading')
  const [loop, setLoop] = useState<LoopWithDetails | null>(null)
  const [result, setResult] = useState<LoopAttempt | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { state: recorderState, duration, startRecording, stopRecording, error: recorderError } =
    useRecorder()

  const autoStopFiredRef = useRef(false)

  // Load loop
  useEffect(() => {
    if (!loopId || !isLoaded || !isSignedIn) return

    let cancelled = false

    getLoop(loopId)
      .then((data) => {
        if (cancelled) return
        setLoop(data)
        setPhase('intro')

        if (ttsEnabled) {
          const title = data.title || 'what you learned'
          void speak(`Quick review time! Remember this one about ${title}? Give me the gist in 60 seconds.`)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(toErrorMessage(err))
        setPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [loopId, isLoaded, isSignedIn, speak, ttsEnabled])

  // Auto-stop at 60 seconds for quick review
  useEffect(() => {
    if (phase !== 'record') return
    if (recorderState !== 'recording') return
    if (duration < 60) return
    if (autoStopFiredRef.current) return

    autoStopFiredRef.current = true
    void handleStop()
  }, [phase, recorderState, duration])

  const handleStart = useCallback(() => {
    setPhase('record')
    autoStopFiredRef.current = false
    if (ttsEnabled) {
      void speak("Go!")
    }
  }, [speak, ttsEnabled])

  const handleStop = useCallback(async () => {
    const finalDuration = duration
    const blob = await stopRecording()

    if (!blob || !loop) {
      setError('No recording available')
      setPhase('error')
      return
    }

    setPhase('processing')

    if (ttsEnabled) {
      void speak("Let's see how much stuck...")
    }

    try {
      // Transcribe
      const transcript = await transcribeAudio(blob.blob)

      // Analyze speech
      const speechAnalysis = analyzeSpeech(transcript, finalDuration)

      // Submit attempt
      const attemptResult = await submitAttempt(loop.id, {
        transcript,
        durationSeconds: finalDuration,
        attemptType: 'quick_review',
        persona: selectedPersona,
        speechMetrics: speechAnalysis as unknown as Record<string, unknown>,
      })

      setResult(attemptResult.attempt)
      setPhase('results')

      // Speak results
      if (ttsEnabled) {
        const score = attemptResult.attempt.score
        if (score >= 80) {
          await speak(`${score}! Still got it. See you in a while.`)
        } else if (score >= 60) {
          await speak(`${score}. Most of it stuck, but might want to revisit soon.`)
        } else {
          await speak(`${score}. Looks like this one needs a refresh. Want to do a full session?`)
        }
      }
    } catch (err) {
      setError(toErrorMessage(err))
      setPhase('error')
    }
  }, [duration, stopRecording, loop, selectedPersona, speak, ttsEnabled])

  const keyConcepts = useMemo(() => {
    if (!loop?.keyConcepts) return []
    return loop.keyConcepts.slice(0, 5)
  }, [loop])

  if (phase === 'loading') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="p-10">
          <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
            <Spinner size="lg" />
            Loading review...
          </div>
        </Card>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="border-red-200 bg-red-50 p-6">
          <div className="text-sm font-medium text-red-700">Something went wrong</div>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate('/learn')}>
              Back to Learn
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Quick Review</h1>
          <Badge variant="warning">60 seconds</Badge>
        </div>
        <p className="text-sm text-neutral-500">Rapid recall to reinforce your learning.</p>
      </div>

      {/* Intro Phase */}
      {phase === 'intro' && loop && (
        <Card className="p-6">
          <div className="text-center space-y-6">
            <div className="text-5xl">🔄</div>

            <div>
              <h2 className="text-xl font-bold text-neutral-900">{loop.title || 'Quick Review'}</h2>
              <p className="mt-2 text-neutral-500">60 seconds. Just the key points. Let's see what stuck.</p>
            </div>

            <div className="bg-neutral-50 border border-neutral-100 p-4 text-left">
              <div className="text-xs font-medium text-neutral-500 mb-2">Source Material</div>
              <p className="text-sm text-neutral-600 line-clamp-3">{loop.sourceText}</p>
            </div>

            {keyConcepts.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-4 text-left">
                <div className="text-xs font-medium text-blue-700 mb-2">Key Concepts to Recall</div>
                <ul className="space-y-1">
                  {keyConcepts.map((concept, index) => (
                    <li key={index} className="text-sm text-blue-600 flex items-start gap-2">
                      <span>•</span>
                      <span>{concept.concept}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button size="lg" onClick={handleStart}>
              I'm Ready
            </Button>
          </div>
        </Card>
      )}

      {/* Recording Phase */}
      {phase === 'record' && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-6 py-8">
            <div
              className={cn(
                'grid h-32 w-32 place-items-center border transition',
                recorderState === 'recording' ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'
              )}
            >
              <svg
                className={cn('h-16 w-16', recorderState === 'recording' ? 'text-red-500' : 'text-neutral-400')}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-neutral-900">{formatDuration(duration)}</div>
              <div className="mt-1 text-sm text-neutral-400">
                {duration < 60 ? `${60 - duration}s remaining` : 'Time!'}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-xs">
              <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-1000',
                    duration >= 50 ? 'bg-red-500' : duration >= 30 ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min((duration / 60) * 100, 100)}%` }}
                />
              </div>
            </div>

            {recorderError && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{recorderError}</div>
            )}

            <div className="flex gap-3">
              {recorderState !== 'recording' ? (
                <Button size="lg" onClick={() => void startRecording()} disabled={recorderState === 'requesting'}>
                  {recorderState === 'requesting' ? (
                    <>
                      <Spinner className="border-white/30 border-t-white" />
                      Starting...
                    </>
                  ) : (
                    'Start'
                  )}
                </Button>
              ) : (
                <Button size="lg" variant="danger" onClick={() => void handleStop()}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Processing Phase */}
      {phase === 'processing' && (
        <Card className="p-10">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <div className="text-sm text-neutral-600">Evaluating your recall...</div>
          </div>
        </Card>
      )}

      {/* Results Phase */}
      {phase === 'results' && result && (
        <Card className="p-6">
          <div className="text-center space-y-6">
            <ScoreRing value={result.score} />

            <div>
              <p className="text-lg text-neutral-700">{result.analysis.feedback}</p>
            </div>

            {/* Covered/Missed summary */}
            <div className="grid gap-4 sm:grid-cols-2 text-left">
              <div className="bg-emerald-50 border border-emerald-200 p-4">
                <div className="text-xs font-medium text-emerald-700 mb-2">Remembered</div>
                <ul className="space-y-1">
                  {result.analysis.covered_points.slice(0, 3).map((point, index) => (
                    <li key={index} className="text-sm text-emerald-600 flex items-start gap-2">
                      <span>✓</span>
                      <span className="line-clamp-1">{point}</span>
                    </li>
                  ))}
                  {result.analysis.covered_points.length === 0 && (
                    <li className="text-sm text-emerald-500">None detected</li>
                  )}
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4">
                <div className="text-xs font-medium text-amber-700 mb-2">Forgot</div>
                <ul className="space-y-1">
                  {result.analysis.missed_points.slice(0, 3).map((point, index) => (
                    <li key={index} className="text-sm text-amber-600 flex items-start gap-2">
                      <span>•</span>
                      <span className="line-clamp-1">{point}</span>
                    </li>
                  ))}
                  {result.analysis.missed_points.length === 0 && (
                    <li className="text-sm text-amber-500">Nothing major!</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {result.score < 70 && (
                <Button variant="secondary" onClick={() => navigate(`/learn/${loopId}`)}>
                  Do Full Review
                </Button>
              )}
              <Button onClick={() => navigate('/learn')}>Done</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
