import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SignInButton, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useRecorder } from '@/hooks/useRecorder'
import { usePreferences } from '@/context/PreferencesContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import { useTTS } from '@/context/TTSContext'
import { createSession, evaluateExplanation, transcribeAudio, getUserSubjects, getLoops, type Analysis, type SourceType, type SubjectWithWorkspace, type LearningLoop } from '@/lib/api'
import { personaConfig, type Persona } from '@/lib/personas'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Spinner } from '@/components/ui/Spinner'
import { ChatPanel } from '@/components/ChatPanel'
import { SpeechMetrics } from '@/components/SpeechMetrics'
import { analyzeSpeech } from '@/lib/speechAnalysis'

type SessionStep = 'input' | 'record' | 'processing' | 'results' | 'error'
type ProcessingStage = 'transcribing' | 'evaluating' | 'saving'

const DRAFT_KEY = 'rt_draft_v1'

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong'
}

function fillScore(text: string, score: number): string {
  return text.split('{score}').join(String(score))
}

interface LocationState {
  sourceText?: string
  fromLearn?: boolean
}

export default function AppPage() {
  const location = useLocation()
  const locationState = location.state as LocationState | null
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { selectedPersona, setSelectedPersona, isPaid } = usePreferences()
  const { currentSubject } = useWorkspace()
  const { enabled: ttsEnabled, speak, speakSequence, stop: stopSpeaking } = useTTS()

  const [step, setStep] = useState<SessionStep>('input')
  const [sourceText, setSourceText] = useState(() => {
    // Check if source text was passed from Learn page
    if (locationState?.sourceText) {
      return locationState.sourceText
    }
    try {
      return localStorage.getItem(DRAFT_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [sourceType, setSourceType] = useState<SourceType>('article')
  const [subjects, setSubjects] = useState<SubjectWithWorkspace[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(() => currentSubject?.id ?? null)
  const [completedLoops, setCompletedLoops] = useState<LearningLoop[]>([])
  const [transcript, setTranscript] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('transcribing')
  const [error, setError] = useState<string | null>(null)
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const { state: recorderState, duration, startRecording, stopRecording, reset: resetRecorder, error: recorderError } =
    useRecorder()

  const hasWelcomedRef = useRef(false)
  const hasSpokenResultsRef = useRef<string | null>(null)
  const autoStopFiredRef = useRef(false)

  const wordCount = useMemo(() => sourceText.trim().split(/\s+/).filter(Boolean).length, [sourceText])
  const isLongText = wordCount > 1500
  const canStart = isLoaded && isSignedIn && wordCount >= 10

  const speechAnalysis = useMemo(() => {
    if (!transcript || recordingDuration === 0) return null
    return analyzeSpeech(transcript, recordingDuration)
  }, [transcript, recordingDuration])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, sourceText)
    } catch {
      // Ignore localStorage failures
    }
  }, [sourceText])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    getUserSubjects()
      .then(setSubjects)
      .catch(() => {
        // Non-fatal: user can still train without subjects
      })

    // Fetch mastered loops for "Test from learned topics"
    getLoops('mastered', currentSubject?.id)
      .then(setCompletedLoops)
      .catch(() => {
        // Non-fatal: user can still test manually
      })
  }, [isLoaded, isSignedIn, currentSubject?.id])

  // Sync selected subject from sidebar context
  useEffect(() => {
    if (currentSubject) {
      setSelectedSubjectId(currentSubject.id)
    }
  }, [currentSubject])

  useEffect(() => {
    if (step !== 'record') {
      autoStopFiredRef.current = false
    }
  }, [step])

  useEffect(() => {
    if (step !== 'input') return
    if (!ttsEnabled) return
    if (hasWelcomedRef.current) return

    hasWelcomedRef.current = true
    void speak(personaConfig[selectedPersona].welcomeMessage)
  }, [selectedPersona, speak, step, ttsEnabled])

  const resetSession = useCallback(() => {
    setTranscript('')
    setScore(null)
    setAnalysis(null)
    setSavedSessionId(null)
    setError(null)
    setProcessingStage('transcribing')
    hasSpokenResultsRef.current = null
    stopSpeaking()
  }, [stopSpeaking])

  const startNewText = useCallback(() => {
    resetSession()
    resetRecorder()
    setSourceText('')
    setStep('input')
    hasWelcomedRef.current = false
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Ignore localStorage failures
    }
  }, [resetRecorder, resetSession])

  const startTryAgain = useCallback(() => {
    resetSession()
    resetRecorder()
    setStep('record')
    void speak(personaConfig[selectedPersona].readyToRecordMessage)
  }, [resetRecorder, resetSession, selectedPersona, speak])

  const speakResults = useCallback(
    async (nextScore: number, nextAnalysis: Analysis) => {
      if (!ttsEnabled) return
      if (!nextAnalysis.tts_script) return

      const script = nextAnalysis.tts_script
      await speakSequence([
        script.intro,
        fillScore(script.score_announcement, nextScore),
        script.covered_summary,
        script.missed_summary,
        script.closing,
      ])
    },
    [speakSequence, ttsEnabled],
  )

  const runEvaluation = useCallback(
    async (audioBlob: Blob, finalDuration: number) => {
      try {
        setError(null)
        setSavedSessionId(null)
        setRecordingDuration(finalDuration)
        setProcessingStage('transcribing')
        setStep('processing')

        if (ttsEnabled) {
          void speak(personaConfig[selectedPersona].processingMessage)
        }

        const nextTranscript = await transcribeAudio(audioBlob)
        setTranscript(nextTranscript)

        setProcessingStage('evaluating')
        const result = await evaluateExplanation(sourceText, nextTranscript, selectedPersona)
        setScore(result.score)
        setAnalysis(result.analysis)

        setProcessingStage('saving')
        try {
          const created = await createSession({
            sourceText,
            sourceType,
            subjectId: selectedSubjectId ?? undefined,
            transcript: nextTranscript,
            score: result.score,
            persona: selectedPersona,
            analysis: result.analysis,
          })
          setSavedSessionId(created.id)
        } catch {
          // Non-fatal: user still gets results.
        }

        setStep('results')
        hasSpokenResultsRef.current = `${selectedPersona}:${result.score}:${result.analysis.tts_script?.score_announcement ?? ''}`
        void speakResults(result.score, result.analysis)
      } catch (err) {
        setError(toErrorMessage(err))
        setStep('error')
      }
    },
    [selectedPersona, selectedSubjectId, sourceText, sourceType, speak, speakResults, ttsEnabled],
  )

  const handleStop = useCallback(async () => {
    const finalDuration = duration
    const result = await stopRecording()
    if (!result) {
      setError('No recording available')
      setStep('error')
      return
    }
    await runEvaluation(result.blob, finalDuration)
  }, [duration, runEvaluation, stopRecording])

  useEffect(() => {
    if (step !== 'record') return
    if (recorderState !== 'recording') return
    if (duration < 180) return
    if (autoStopFiredRef.current) return

    autoStopFiredRef.current = true
    void handleStop()
  }, [duration, handleStop, recorderState, step])

  useEffect(() => {
    if (step !== 'results') return
    if (!analysis?.tts_script) return
    if (!ttsEnabled) return
    if (score === null) return

    const signature = `${selectedPersona}:${score}:${analysis.tts_script.score_announcement}`
    if (hasSpokenResultsRef.current === signature) return

    hasSpokenResultsRef.current = signature
    void speakResults(score, analysis)
  }, [analysis, score, selectedPersona, speakResults, step, ttsEnabled])

  const stepLabel = useMemo(() => {
    if (step === 'input') return 'Paste'
    if (step === 'record') return 'Record'
    if (step === 'processing') return 'Processing'
    if (step === 'results') return 'Results'
    return 'Error'
  }, [step])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Test</h1>
          <Badge variant="info">{personaConfig[selectedPersona].name}</Badge>
          <Badge variant="neutral">{stepLabel}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-neutral-500" htmlFor="persona">
              Persona
            </label>
            <select
              id="persona"
              value={selectedPersona}
              onChange={(e) => void setSelectedPersona(e.target.value as Persona)}
              className="h-10 border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-2"
            >
              {(['coach', 'professor', 'sergeant', 'hype', 'chill'] as Persona[]).map((id) => {
                const config = personaConfig[id]
                const locked = config.isPaid && !isPaid
                return (
                  <option key={id} value={id} disabled={locked}>
                    {config.name} — {config.description}
                    {config.isPaid ? ' (Paid)' : ''}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        <p className="text-sm text-neutral-500">Paste → explain out loud → get scored on what you retained.</p>
      </div>

      {!isSignedIn && (
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to use transcription + scoring</div>
              <p className="mt-1 text-sm text-neutral-500">
                The API is protected by Clerk auth, so you&apos;ll need to sign in to run a session.
              </p>
            </div>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        </Card>
      )}

      {step === 'input' && locationState?.fromLearn && (
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">🎯</span>
            <div>
              <div className="text-sm font-medium text-emerald-700">Ready to test what you learned</div>
              <p className="mt-0.5 text-sm text-emerald-600">This material is from your completed learning loop. See how much you retained!</p>
            </div>
          </div>
        </Card>
      )}

      {step === 'input' && completedLoops.length > 0 && !locationState?.fromLearn && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-neutral-900">Test from learned topics</div>
              <p className="mt-0.5 text-sm text-neutral-500">Review material you've already mastered</p>
            </div>
            <Badge variant="success">{completedLoops.length} mastered</Badge>
          </div>

          <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
            {completedLoops.slice(0, 5).map((loop) => (
              <button
                key={loop.id}
                type="button"
                onClick={() => setSourceText(loop.sourceText)}
                className="w-full p-4 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {loop.title || 'Untitled'}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                      {loop.sourceText.substring(0, 120)}...
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {new Date(loop.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {completedLoops.length > 5 && (
            <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3 text-center">
              <span className="text-sm text-neutral-500">
                +{completedLoops.length - 5} more topics available
              </span>
            </div>
          )}
        </Card>
      )}

      {step === 'input' && (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-neutral-900">Source text</div>
                <p className="mt-1 text-sm text-neutral-500">Paste what you just read. Then explain it back without looking.</p>
              </div>
              <Badge variant={isLongText ? 'warning' : 'neutral'}>{wordCount} words</Badge>
            </div>

            <div className="mt-4">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste your text here…"
                className={cn(
                  'h-72 w-full resize-none border bg-white p-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-2',
                  isLongText ? 'border-amber-400' : 'border-neutral-200',
                )}
              />
              <p className="mt-3 text-xs text-neutral-400">
                Tip: ~1500 words is a good target. Longer text is fine, but feedback may be less precise.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                disabled={!canStart}
                size="lg"
                onClick={() => {
                  resetSession()
                  resetRecorder()
                  setStep('record')
                  void speak(personaConfig[selectedPersona].readyToRecordMessage)
                }}
              >
                Start recording
              </Button>
              <Button variant="secondary" size="lg" onClick={startNewText} disabled={sourceText.length === 0}>
                Clear
              </Button>
            </div>
            {isSignedIn && wordCount < 10 && (
              <p className="mt-2 text-xs text-neutral-400">Paste at least 10 words to enable recording.</p>
            )}
          </Card>

          <Card className="p-6">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-medium text-neutral-900">Source type</div>
                <p className="mt-1 text-sm text-neutral-500">What are you retaining?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    { id: 'article', label: 'Article', icon: '📄' },
                    { id: 'meeting', label: 'Meeting', icon: '👥' },
                    { id: 'podcast', label: 'Podcast', icon: '🎙️' },
                    { id: 'video', label: 'Video', icon: '🎬' },
                    { id: 'book', label: 'Book', icon: '📚' },
                    { id: 'lecture', label: 'Lecture', icon: '🎓' },
                  ] as const).map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSourceType(type.id)}
                      className={cn(
                        'flex items-center gap-2 border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
                        sourceType === type.id
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      )}
                    >
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {subjects.length > 0 && (
                <div className="border-t border-neutral-100 pt-5">
                  <div className="text-sm font-medium text-neutral-900">Subject (optional)</div>
                  <p className="mt-1 text-sm text-neutral-500">Link to a subject for tracking</p>
                  <select
                    value={selectedSubjectId ?? ''}
                    onChange={(e) => setSelectedSubjectId(e.target.value || null)}
                    className="mt-3 h-10 w-full border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/20"
                  >
                    <option value="">No subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.workspaceName} / {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t border-neutral-100 pt-5">
                <div className="text-sm font-medium text-neutral-900">How it works</div>
                <ol className="mt-3 space-y-2 text-sm text-neutral-500">
                  <li><span className="font-medium text-neutral-700">1.</span> Paste what you consumed</li>
                  <li><span className="font-medium text-neutral-700">2.</span> Explain it out loud</li>
                  <li><span className="font-medium text-neutral-700">3.</span> See what you missed</li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      )}

      {step === 'record' && (
        <Card className="p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">Explain it back</div>
                <p className="mt-1 text-sm text-neutral-500">Aim for clarity. Don&apos;t reread. Don&apos;t worry about perfection.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={recorderState === 'recording' ? 'danger' : 'neutral'}>
                  {recorderState === 'requesting' ? 'Requesting mic…' : recorderState === 'recording' ? 'Recording' : 'Ready'}
                </Badge>
                <Badge variant={duration >= 120 ? 'warning' : 'neutral'}>{formatDuration(duration)}</Badge>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="border border-neutral-200 bg-neutral-50 p-6">
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div
                    className={cn(
                      'grid h-28 w-28 place-items-center border transition',
                      recorderState === 'recording'
                        ? 'border-red-300 bg-red-50'
                        : 'border-neutral-200 bg-white',
                    )}
                  >
                    <svg className="h-12 w-12 text-neutral-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>

                  <div className="text-3xl font-bold tracking-tight text-neutral-900">{formatDuration(duration)}</div>
                  <div className="text-sm text-neutral-400">Soft warning at 2:00. Auto-stop at 3:00.</div>

                  {recorderError && (
                    <div className="mt-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {recorderError}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {duration >= 120 && duration < 180 && (
                  <Card className="border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-medium text-amber-700">2 minute mark</div>
                    <p className="mt-1 text-sm text-amber-600">Wrap up your main points. You&apos;ve got ~1 minute left.</p>
                  </Card>
                )}

                <Card className="p-4">
                  <div className="text-xs font-medium text-neutral-500">Controls</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {recorderState !== 'recording' ? (
                      <Button
                        size="lg"
                        onClick={() => void startRecording()}
                        disabled={!isSignedIn || recorderState === 'requesting'}
                      >
                        {recorderState === 'requesting' ? (
                          <>
                            <Spinner className="border-white/30 border-t-white" />
                            Starting…
                          </>
                        ) : (
                          'Start recording'
                        )}
                      </Button>
                    ) : (
                      <Button size="lg" variant="danger" onClick={() => void handleStop()}>
                        Stop &amp; score
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => {
                        resetRecorder()
                        setStep('input')
                        stopSpeaking()
                      }}
                    >
                      Back to text
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 'processing' && (
        <Card className="p-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
              <Spinner size="lg" />
              {processingStage === 'transcribing' && 'Transcribing audio…'}
              {processingStage === 'evaluating' && 'Evaluating your explanation…'}
              {processingStage === 'saving' && 'Saving session…'}
            </div>
            <div className="mt-6 border border-neutral-100 bg-neutral-50 p-4 text-sm text-neutral-600">
              {personaConfig[selectedPersona].processingMessage}
            </div>
          </div>
        </Card>
      )}

      {step === 'results' && score !== null && analysis && (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">Your score</div>
                <p className="mt-1 text-sm text-neutral-500">Coverage matters most. Accuracy matters too.</p>
              </div>
              {savedSessionId ? <Badge variant="success">Saved</Badge> : <Badge variant="neutral">Local</Badge>}
            </div>

            <div className="mt-6 flex justify-center">
              <ScoreRing value={score} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Card className="bg-neutral-50 p-4">
                <div className="text-xs font-medium text-neutral-500">Coverage</div>
                <div className="mt-1 text-lg font-bold text-neutral-900">{Math.round(analysis.coverage * 100)}%</div>
              </Card>
              <Card className="bg-neutral-50 p-4">
                <div className="text-xs font-medium text-neutral-500">Accuracy</div>
                <div className="mt-1 text-lg font-bold text-neutral-900">{Math.round(analysis.accuracy * 100)}%</div>
              </Card>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button size="lg" onClick={startTryAgain}>
                Try again (same text)
              </Button>
              <Button variant="secondary" size="lg" onClick={startNewText}>
                New text
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (score === null || !analysis.tts_script) return
                  void speakResults(score, analysis)
                }}
                disabled={!ttsEnabled}
              >
                Replay voice
              </Button>
              <Button variant="ghost" size="sm" onClick={stopSpeaking} disabled={!ttsEnabled}>
                Stop voice
              </Button>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-neutral-900">Feedback</div>
                  <p className="mt-1 text-sm text-neutral-500">The point isn&apos;t a perfect score—it's seeing the gaps.</p>
                </div>
                <Badge variant="neutral">{personaConfig[selectedPersona].name}</Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-700">{analysis.feedback}</p>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-emerald-200 bg-emerald-50 p-6">
                <div className="text-sm font-medium text-emerald-700">Covered</div>
                <ul className="mt-3 space-y-2 text-sm text-emerald-600">
                  {analysis.covered_points.length === 0 && <li className="text-emerald-500">None detected.</li>}
                  {analysis.covered_points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden>✓</span>
                      <span className="min-w-0">{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="border-amber-200 bg-amber-50 p-6">
                <div className="text-sm font-medium text-amber-700">Missed</div>
                <ul className="mt-3 space-y-2 text-sm text-amber-600">
                  {analysis.missed_points.length === 0 && <li className="text-amber-500">Nothing major missed.</li>}
                  {analysis.missed_points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span className="min-w-0">{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {speechAnalysis && <SpeechMetrics analysis={speechAnalysis} />}

            <Card className="p-6">
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900">
                  <span className="inline-flex items-center gap-2">
                    Transcript
                    <span className="text-xs font-medium text-neutral-400">(expand)</span>
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-600">{transcript}</p>
              </details>
            </Card>

            {savedSessionId && (
              <ChatPanel
                sessionId={savedSessionId}
                persona={selectedPersona}
                missedPoints={analysis.missed_points}
              />
            )}
          </div>
        </div>
      )}

      {step === 'error' && (
        <Card className="border-red-200 bg-red-50 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-medium text-red-700">Something went wrong</div>
              <p className="mt-1 text-sm text-red-600">{error ?? 'Please try again.'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button onClick={startTryAgain} disabled={!isSignedIn}>
                Try again
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
