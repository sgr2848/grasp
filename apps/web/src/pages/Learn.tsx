import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SignInButton, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useRecorder } from '@/hooks/useRecorder'
import { usePreferences } from '@/context/PreferencesContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import { useTTS } from '@/context/TTSContext'
import {
  createLoop,
  getLoop,
  submitAttempt,
  updateLoopPhase,
  startSocraticSession,
  sendSocraticMessage,
  transcribeAudio,
  getUserSubjects,
  submitPriorKnowledge,
  skipPriorKnowledge,
  UsageLimitExceededError,
  FREE_TIER_DAILY_LIMIT,
  type LoopPhase,
  type LoopWithDetails,
  type LoopAttempt,
  type SocraticSession,
  type SourceType,
  type SubjectWithWorkspace,
  type AttemptType,
  type Precision,
  type UsageStats,
} from '@/lib/api'
import { personaConfig } from '@/lib/personas'
import type { SampleContentData } from '@/lib/sampleContent'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { analyzeSpeech, type SpeechAnalysis } from '@/lib/speechAnalysis'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { LoopProgress } from '@/components/LoopProgress'
import { SocraticChat } from '@/components/SocraticChat'
import { SimplifyChallenge } from '@/components/SimplifyChallenge'
import { LoopResultsPanel } from '@/components/LoopResultsPanel'
import { ReviewDashboard } from '@/components/ReviewDashboard'
import { InProgressLoops } from '@/components/InProgressLoops'
import { RecordingEncouragement } from '@/components/RecordingEncouragement'
import { Confetti } from '@/components/Confetti'
import { AnimatedScoreRing } from '@/components/ui/AnimatedScoreRing'

type UIPhase = 'input' | 'loading' | LoopPhase | 'error'

interface LoopState {
  phase: UIPhase
  loop: LoopWithDetails | null
  currentAttempt: LoopAttempt | null
  socraticSession: SocraticSession | null
  speechAnalysis: SpeechAnalysis | null
}

const DRAFT_KEY = 'rt_loop_draft_v1'

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong'
}

export default function Learn() {
  const { loopId } = useParams()
  const navigate = useNavigate()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { selectedPersona } = usePreferences()
  const { currentSubject } = useWorkspace()
  const { enabled: ttsEnabled, speak, speakSequence, stop: stopSpeaking } = useTTS()

  const [state, setState] = useState<LoopState>({
    phase: loopId ? 'loading' : 'input',
    loop: null,
    currentAttempt: null,
    socraticSession: null,
    speechAnalysis: null,
  })

  const [sourceText, setSourceText] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [sourceType, setSourceType] = useState<SourceType>('article')
  const [precision, setPrecision] = useState<Precision>('balanced')
  const [title, setTitle] = useState('')
  const [subjects, setSubjects] = useState<SubjectWithWorkspace[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(() => currentSubject?.id ?? null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usageLimitReached, setUsageLimitReached] = useState<UsageStats | null>(null)

  const { state: recorderState, duration, startRecording, stopRecording, reset: resetRecorder, error: recorderError } =
    useRecorder()

  const autoStopFiredRef = useRef(false)
  const hasWelcomedRef = useRef(false)

  const wordCount = useMemo(() => sourceText.trim().split(/\s+/).filter(Boolean).length, [sourceText])
  const isLongText = wordCount > 1500
  const canStart = isLoaded && isSignedIn && wordCount >= 10

  // Check for sample content from onboarding
  useEffect(() => {
    try {
      const sampleData = sessionStorage.getItem('rt_sample_content')
      if (sampleData) {
        const sample: SampleContentData = JSON.parse(sampleData)
        setTitle(sample.title)
        setSourceText(sample.content)
        setSourceType(sample.sourceType)
        sessionStorage.removeItem('rt_sample_content')
      }
    } catch {
      // Ignore parsing errors
    }
  }, [])

  // Save draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, sourceText)
    } catch {
      // Ignore localStorage failures
    }
  }, [sourceText])

  // Load subjects
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    getUserSubjects().then(setSubjects).catch(() => {})
  }, [isLoaded, isSignedIn])

  // Sync selected subject from sidebar context
  useEffect(() => {
    if (currentSubject) {
      setSelectedSubjectId(currentSubject.id)
    }
  }, [currentSubject])

  // Load existing loop
  useEffect(() => {
    if (!loopId || !isLoaded || !isSignedIn) return

    let cancelled = false
    setIsProcessing(true)

    getLoop(loopId)
      .then((loop) => {
        if (cancelled) return
        setState({
          phase: loop.currentPhase,
          loop,
          currentAttempt: loop.attempts[loop.attempts.length - 1] || null,
          socraticSession: loop.currentSocraticSession,
          speechAnalysis: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setError(toErrorMessage(err))
        setState((prev) => ({ ...prev, phase: 'error' }))
      })
      .finally(() => {
        if (cancelled) return
        setIsProcessing(false)
      })

    return () => {
      cancelled = true
    }
  }, [loopId, isLoaded, isSignedIn])

  // Reset auto-stop flag when phase changes
  useEffect(() => {
    if (state.phase !== 'prior_knowledge' && state.phase !== 'first_attempt' && state.phase !== 'second_attempt' && state.phase !== 'simplify') {
      autoStopFiredRef.current = false
    }
  }, [state.phase])

  // Welcome message on input phase
  useEffect(() => {
    if (state.phase !== 'input' || !ttsEnabled || hasWelcomedRef.current) return
    hasWelcomedRef.current = true
    void speak("Ready to learn? Paste what you want to remember, then explain it back in your own words.")
  }, [state.phase, speak, ttsEnabled])

  // Create new loop
  const handleSourceSubmit = useCallback(async () => {
    if (!canStart) return

    setIsProcessing(true)
    setError(null)

    try {
      const loop = await createLoop({
        title: title || undefined,
        sourceText,
        sourceType,
        subjectId: selectedSubjectId || undefined,
        precision,
      })

      // Clear draft
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {}

      navigate(`/learn/${loop.id}`, { replace: true })

      const startingPhase = loop.currentPhase

      setState({
        phase: startingPhase,
        loop: { ...loop, attempts: [], currentSocraticSession: null, reviewSchedule: null },
        currentAttempt: null,
        socraticSession: null,
        speechAnalysis: null,
      })

      if (startingPhase === 'prior_knowledge') {
        void speak("Before you start reading, tell me what you already know about this topic.")
      } else {
        void speak("Alright! Now explain what you just read in your own words. Take your time, don't rush.")
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }, [canStart, title, sourceText, sourceType, selectedSubjectId, navigate, speak])

  // Handle recording stop and evaluation
  const handleStopRecording = useCallback(async () => {
    const finalDuration = duration
    const result = await stopRecording()

    if (!result) {
      setError('No recording available')
      return
    }

    setIsProcessing(true)
    stopSpeaking()

    if (ttsEnabled) {
      void speak(personaConfig[selectedPersona].processingMessage)
    }

    try {
      // Transcribe
      const transcript = await transcribeAudio(result.blob)

      // Handle prior knowledge phase separately
      if (state.phase === 'prior_knowledge') {
        const priorResult = await submitPriorKnowledge(state.loop!.id, transcript, finalDuration)

        setState((prev) => ({
          ...prev,
          phase: priorResult.nextPhase,
          loop: prev.loop
            ? {
                ...prev.loop,
                currentPhase: priorResult.nextPhase,
                priorKnowledgeTranscript: transcript,
                priorKnowledgeAnalysis: priorResult.analysis,
                priorKnowledgeScore: priorResult.analysis.confidenceScore,
              }
            : null,
        }))

        // Speak feedback
        if (ttsEnabled && priorResult.analysis.feedback) {
          await speak(priorResult.analysis.feedback + " Now, explain what you've learned in your own words.")
        }

        setIsProcessing(false)
        resetRecorder()
        return
      }

      // Analyze speech
      const speechAnalysis = analyzeSpeech(transcript, finalDuration)

      // Determine attempt type
      const attemptType: AttemptType = state.phase === 'simplify' ? 'simplify_challenge' : 'full_explanation'

      // Submit attempt
      const attemptResult = await submitAttempt(state.loop!.id, {
        transcript,
        durationSeconds: finalDuration,
        attemptType,
        persona: selectedPersona,
        speechMetrics: speechAnalysis as unknown as Record<string, unknown>,
      })

      // Update state
      setState((prev) => ({
        ...prev,
        phase: attemptResult.nextPhase,
        currentAttempt: attemptResult.attempt,
        speechAnalysis,
        loop: prev.loop
          ? {
              ...prev.loop,
              currentPhase: attemptResult.nextPhase,
              attempts: [...prev.loop.attempts, attemptResult.attempt],
            }
          : null,
      }))

      // Speak results
      if (ttsEnabled && attemptResult.evaluation.tts_script) {
        const script = attemptResult.evaluation.tts_script
        await speakSequence([
          script.intro,
          script.score_announcement.replace('{score}', String(attemptResult.attempt.score)),
          script.covered_summary,
          script.missed_summary,
          script.closing,
        ])
      }
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        setUsageLimitReached(err.usage)
      } else {
        setError(toErrorMessage(err))
      }
    } finally {
      setIsProcessing(false)
      resetRecorder()
    }
  }, [
    duration,
    stopRecording,
    stopSpeaking,
    ttsEnabled,
    speak,
    selectedPersona,
    state.phase,
    state.loop,
    speakSequence,
    resetRecorder,
  ])

  // Auto-stop at 3 minutes (2 minutes for prior knowledge)
  useEffect(() => {
    if (!['prior_knowledge', 'first_attempt', 'second_attempt', 'simplify'].includes(state.phase)) return
    if (recorderState !== 'recording') return
    const maxDuration = state.phase === 'prior_knowledge' ? 120 : 180
    if (duration < maxDuration) return
    if (autoStopFiredRef.current) return

    autoStopFiredRef.current = true
    void handleStopRecording()
  }, [state.phase, recorderState, duration, handleStopRecording])

  // Skip prior knowledge assessment
  const handleSkipPriorKnowledge = useCallback(async () => {
    if (!state.loop) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await skipPriorKnowledge(state.loop.id)

      setState((prev) => ({
        ...prev,
        phase: result.nextPhase,
        loop: prev.loop
          ? {
              ...prev.loop,
              currentPhase: result.nextPhase,
              priorKnowledgeScore: 0,
            }
          : null,
      }))

      if (ttsEnabled) {
        void speak("No problem! Let's get started. Explain what you've learned in your own words.")
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }, [state.loop, ttsEnabled, speak])

  // Start Socratic learning
  const handleStartLearning = useCallback(async () => {
    if (!state.loop) return

    setIsProcessing(true)
    setError(null)

    try {
      const { session, message } = await startSocraticSession(state.loop.id, state.currentAttempt?.id)

      setState((prev) => ({
        ...prev,
        phase: 'learning',
        socraticSession: session,
        loop: prev.loop ? { ...prev.loop, currentPhase: 'learning', currentSocraticSession: session } : null,
      }))

      if (ttsEnabled) {
        void speak(message)
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }, [state.loop, state.currentAttempt, ttsEnabled, speak])

  // Handle Socratic message
  const handleSocraticMessage = useCallback(
    async (content: string) => {
      if (!state.loop || !state.socraticSession) return

      try {
        const response = await sendSocraticMessage(state.loop.id, state.socraticSession.id, content)

        setState((prev) => ({
          ...prev,
          socraticSession: response.session,
          phase: response.allAddressed ? 'second_attempt' : prev.phase,
          loop: prev.loop
            ? {
                ...prev.loop,
                currentPhase: response.allAddressed ? 'second_attempt' : prev.loop.currentPhase,
                currentSocraticSession: response.session,
              }
            : null,
        }))

        if (ttsEnabled) {
          void speak(response.message)
        }

        if (response.allAddressed) {
          if (ttsEnabled) {
            void speak("Great work! You've addressed all the gaps. Ready to explain again?")
          }
        }
      } catch (err) {
        setError(toErrorMessage(err))
      }
    },
    [state.loop, state.socraticSession, ttsEnabled, speak]
  )

  // Continue to next phase
  const handleContinue = useCallback(() => {
    const score = state.currentAttempt?.score ?? 0
    let nextPhase: LoopPhase | undefined

    if (state.phase === 'first_results') {
      nextPhase = score >= 85 ? 'simplify' : 'learning'
    } else if (state.phase === 'second_results') {
      nextPhase = score >= 85 ? 'complete' : 'simplify'
    } else if (state.phase === 'simplify_results') {
      nextPhase = 'complete'
    }

    if (nextPhase) {
      setState((prev) => ({ ...prev, phase: nextPhase }))

      if (nextPhase === 'learning') {
        void handleStartLearning()
      } else if (nextPhase === 'simplify') {
        if (state.loop) {
          void updateLoopPhase(state.loop.id, 'simplify')
        }
        void speak("Now for the real test. Explain this like you're teaching a 10-year-old. No jargon allowed!")
      } else if (nextPhase === 'complete') {
        if (state.loop) {
          void updateLoopPhase(state.loop.id, 'complete')
        }
      }
    }
  }, [state.phase, state.loop, state.currentAttempt, handleStartLearning, speak, updateLoopPhase])

  // Skip to second attempt
  const handleSkipToSecondAttempt = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'second_attempt' }))
    void speak("Alright, let's try again. Focus on the gaps from your first attempt.")
  }, [speak])

  // Retry current phase
  const handleRetry = useCallback(() => {
    if (state.phase === 'first_results') {
      setState((prev) => ({ ...prev, phase: 'first_attempt' }))
    } else if (state.phase === 'second_results') {
      setState((prev) => ({ ...prev, phase: 'second_attempt' }))
    } else if (state.phase === 'simplify_results') {
      setState((prev) => ({ ...prev, phase: 'simplify' }))
    }
    resetRecorder()
  }, [state.phase, resetRecorder])

  // Start new loop
  const handleNewLoop = useCallback(() => {
    setState({
      phase: 'input',
      loop: null,
      currentAttempt: null,
      socraticSession: null,
      speechAnalysis: null,
    })
    setSourceText('')
    setTitle('')
    setError(null)
    navigate('/learn', { replace: true })
    hasWelcomedRef.current = false
  }, [navigate])

  // Test yourself with the learned material
  const handleTestYourself = useCallback(() => {
    if (!state.loop) return
    navigate('/app', { state: { sourceText: state.loop.sourceText, fromLearn: true } })
  }, [navigate, state.loop])

  // Get current and previous attempts for comparison
  const previousAttempt = useMemo(() => {
    if (!state.loop || state.loop.attempts.length < 2) return null
    return state.loop.attempts[state.loop.attempts.length - 2]
  }, [state.loop])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Learn</h1>
          <Badge variant="info">{personaConfig[selectedPersona].name}</Badge>
          {state.loop && <Badge variant="neutral">Loop #{state.loop.id.slice(0, 8)}</Badge>}
        </div>
        <p className="text-sm text-neutral-500">
          The Feynman method: explain to learn. Master concepts through iterative explanation.
        </p>
      </div>

      {/* Loop Progress */}
      {state.loop && state.phase !== 'input' && state.phase !== 'loading' && state.phase !== 'error' && (
        <LoopProgress phase={state.phase as LoopPhase} attempts={state.loop.attempts} />
      )}

      {/* Auth Gate */}
      {!isSignedIn && (
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to start learning</div>
              <p className="mt-1 text-sm text-neutral-500">Track your progress and build lasting understanding.</p>
            </div>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {state.phase === 'loading' && (
        <Card className="p-10">
          <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
            <Spinner size="lg" />
            Loading your learning session...
          </div>
        </Card>
      )}

      {/* Due Reviews */}
      {state.phase === 'input' && isSignedIn && (
        <ReviewDashboard />
      )}

      {/* In Progress Loops */}
      {state.phase === 'input' && isSignedIn && (
        <InProgressLoops />
      )}

      {/* Input Phase */}
      {state.phase === 'input' && isSignedIn && (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-neutral-900">What do you want to learn?</div>
                <p className="mt-1 text-sm text-neutral-500">Paste text from an article, book, video transcript, or notes.</p>
              </div>
              <Badge variant={isLongText ? 'warning' : 'neutral'}>{wordCount} words</Badge>
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="mb-3 h-10 w-full border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
              />
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste your text here..."
                className={cn(
                  'h-64 w-full resize-none border bg-white p-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
                  isLongText ? 'border-amber-400' : 'border-neutral-200'
                )}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button size="lg" onClick={handleSourceSubmit} disabled={!canStart || isProcessing}>
                {isProcessing ? (
                  <>
                    <Spinner className="border-white/30 border-t-white" />
                    Creating...
                  </>
                ) : (
                  'Start Learning'
                )}
              </Button>
            </div>
            {wordCount < 10 && (
              <p className="mt-2 text-xs text-neutral-400">Paste at least 10 words to start a learning loop.</p>
            )}
          </Card>

          <Card className="p-6">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-medium text-neutral-900">Source type</div>
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

              <div className="border-t border-neutral-100 pt-5">
                <div className="text-sm font-medium text-neutral-900">Detail level</div>
                <p className="mt-1 text-xs text-neutral-500">How strictly should we evaluate your explanation?</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([
                    { id: 'essential', label: 'Essential', desc: 'Core concepts only' },
                    { id: 'balanced', label: 'Balanced', desc: 'Standard (Recommended)' },
                    { id: 'precise', label: 'Precise', desc: 'Every detail matters' },
                  ] as const).map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setPrecision(level.id)}
                      className={cn(
                        'flex flex-col border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
                        precision === level.id
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      )}
                    >
                      <span className="font-medium">{level.label}</span>
                      <span className={cn(
                        'text-xs',
                        precision === level.id ? 'text-neutral-300' : 'text-neutral-400'
                      )}>{level.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {subjects.length > 0 && (
                <div className="border-t border-neutral-100 pt-5">
                  <div className="text-sm font-medium text-neutral-900">Subject (optional)</div>
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
                <div className="text-sm font-medium text-neutral-900">The Feynman Loop</div>
                <ol className="mt-3 space-y-2 text-sm text-neutral-500">
                  <li>
                    <span className="font-medium text-neutral-700">1.</span> First attempt - explain from memory
                  </li>
                  <li>
                    <span className="font-medium text-neutral-700">2.</span> Fill gaps - guided Q&A on what you missed
                  </li>
                  <li>
                    <span className="font-medium text-neutral-700">3.</span> Second attempt - show your improvement
                  </li>
                  <li>
                    <span className="font-medium text-neutral-700">4.</span> Simplify - explain like teaching a child
                  </li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Prior Knowledge Assessment Phase */}
      {state.phase === 'prior_knowledge' && state.loop && (
        <Card className="p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">What do you already know?</div>
                <p className="mt-1 text-sm text-neutral-500">
                  Before we start, tell us what you already know about this topic. This helps personalize your learning.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={recorderState === 'recording' ? 'danger' : 'neutral'}>
                  {recorderState === 'requesting' ? 'Requesting mic...' : recorderState === 'recording' ? 'Recording' : 'Ready'}
                </Badge>
                <Badge variant={duration >= 90 ? 'warning' : 'neutral'}>{formatDuration(duration)}</Badge>
              </div>
            </div>

            {/* Source preview - collapsed */}
            <details className="border border-neutral-100 bg-neutral-50 p-4">
              <summary className="cursor-pointer text-xs font-medium text-neutral-500">
                Preview source material (click to expand)
              </summary>
              <p className="mt-2 text-sm text-neutral-600">{state.loop.sourceText.substring(0, 500)}...</p>
            </details>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="border border-neutral-200 bg-neutral-50 p-6">
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <div className="relative">
                    {recorderState === 'recording' && (
                      <div className="absolute inset-0 bg-blue-400/20 animate-pulse-ring" />
                    )}
                    <div
                      className={cn(
                        'relative grid h-24 w-24 place-items-center border-2 transition-all duration-300',
                        recorderState === 'recording'
                          ? 'border-blue-500 bg-blue-50 shadow-lg'
                          : 'border-neutral-200 bg-white'
                      )}
                    >
                      <svg
                        className={cn(
                          'h-10 w-10 transition-colors duration-300',
                          recorderState === 'recording' ? 'text-blue-500' : 'text-neutral-400'
                        )}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    </div>
                  </div>

                  <div className="text-5xl font-bold tracking-tight text-neutral-900 tabular-nums">{formatDuration(duration)}</div>
                  <div className="text-sm text-neutral-500">
                    {recorderState === 'recording' ? 'Sharing what you know...' : 'Auto-stop at 2:00'}
                  </div>

                  {recorderError && (
                    <div className="mt-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{recorderError}</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Card className="border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm font-medium text-blue-700">Tips</div>
                  <ul className="mt-2 space-y-1 text-sm text-blue-600">
                    <li>• What concepts are you already familiar with?</li>
                    <li>• What have you heard about this topic before?</li>
                    <li>• Any related experiences or knowledge?</li>
                  </ul>
                </Card>

                <Card className="p-4">
                  <div className="text-xs font-medium text-neutral-500">Controls</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {recorderState !== 'recording' ? (
                      <Button
                        size="lg"
                        onClick={() => void startRecording()}
                        disabled={!isSignedIn || recorderState === 'requesting' || isProcessing}
                      >
                        {recorderState === 'requesting' ? (
                          <>
                            <Spinner className="border-white/30 border-t-white" />
                            Starting...
                          </>
                        ) : (
                          'Start recording'
                        )}
                      </Button>
                    ) : (
                      <Button size="lg" variant="primary" onClick={() => void handleStopRecording()} disabled={isProcessing}>
                        {isProcessing ? (
                          <>
                            <Spinner className="border-white/30 border-t-white" />
                            Analyzing...
                          </>
                        ) : (
                          'Done sharing'
                        )}
                      </Button>
                    )}

                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => void handleSkipPriorKnowledge()}
                      disabled={isProcessing || recorderState === 'recording'}
                    >
                      Skip - I don't know anything yet
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recording Phase (First or Second Attempt) */}
      {(state.phase === 'first_attempt' || state.phase === 'second_attempt') && state.loop && (
        <Card className="p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  {state.phase === 'first_attempt' ? 'First Attempt' : 'Second Attempt'}
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  {state.phase === 'first_attempt'
                    ? "Explain what you read in your own words. Don't look at the text."
                    : "Apply what you learned. Focus on the gaps from your first attempt."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={recorderState === 'recording' ? 'danger' : 'neutral'}>
                  {recorderState === 'requesting' ? 'Requesting mic...' : recorderState === 'recording' ? 'Recording' : 'Ready'}
                </Badge>
                <Badge variant={duration >= 120 ? 'warning' : 'neutral'}>{formatDuration(duration)}</Badge>
              </div>
            </div>

            {/* Source preview */}
            <div className="border border-neutral-100 bg-neutral-50 p-4">
              <div className="text-xs font-medium text-neutral-500">Source Material (for reference only)</div>
              <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{state.loop.sourceText}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="border border-neutral-200 bg-neutral-50 p-6">
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <div className="relative">
                    {recorderState === 'recording' && (
                      <div className="absolute inset-0 bg-red-400/20 animate-pulse-ring" />
                    )}
                    <div
                      className={cn(
                        'relative grid h-24 w-24 place-items-center border-2 transition-all duration-300',
                        recorderState === 'recording'
                          ? 'border-red-500 bg-red-50 shadow-lg glow-amber'
                          : 'border-neutral-200 bg-white'
                      )}
                    >
                      <svg
                        className={cn(
                          'h-10 w-10 transition-colors duration-300',
                          recorderState === 'recording' ? 'text-red-500' : 'text-neutral-400'
                        )}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    </div>
                  </div>

                  <div className="text-5xl font-bold tracking-tight text-neutral-900 tabular-nums">{formatDuration(duration)}</div>
                  <div className="text-sm text-neutral-500">
                    {recorderState === 'recording' ? 'Recording your explanation...' : 'Auto-stop at 3:00'}
                  </div>

                  {/* Encouragement messages */}
                  <div className="w-full max-w-xs mt-2">
                    <RecordingEncouragement duration={duration} isRecording={recorderState === 'recording'} />
                  </div>

                  {recorderError && (
                    <div className="mt-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{recorderError}</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {duration >= 120 && duration < 180 && (
                  <Card className="border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-medium text-amber-700">2 minute mark</div>
                    <p className="mt-1 text-sm text-amber-600">Wrap up your main points.</p>
                  </Card>
                )}

                <Card className="p-4">
                  <div className="text-xs font-medium text-neutral-500">Controls</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {recorderState !== 'recording' ? (
                      <Button
                        size="lg"
                        onClick={() => void startRecording()}
                        disabled={!isSignedIn || recorderState === 'requesting' || isProcessing}
                      >
                        {recorderState === 'requesting' ? (
                          <>
                            <Spinner className="border-white/30 border-t-white" />
                            Starting...
                          </>
                        ) : (
                          'Start recording'
                        )}
                      </Button>
                    ) : (
                      <Button size="lg" variant="danger" onClick={() => void handleStopRecording()} disabled={isProcessing}>
                        {isProcessing ? (
                          <>
                            <Spinner className="border-white/30 border-t-white" />
                            Processing...
                          </>
                        ) : (
                          'Stop & score'
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Results Phases */}
      {(state.phase === 'first_results' || state.phase === 'second_results' || state.phase === 'simplify_results') &&
        state.currentAttempt && (
          <LoopResultsPanel
            attempt={state.currentAttempt}
            previousAttempt={previousAttempt}
            phase={state.phase}
            speechAnalysis={state.speechAnalysis}
            onContinue={handleContinue}
            onRetry={handleRetry}
            onTestYourself={handleTestYourself}
          />
        )}

      {/* Learning Phase (Socratic Dialogue) */}
      {state.phase === 'learning' && state.socraticSession && state.loop && (
        <SocraticChat
          session={state.socraticSession}
          sourceText={state.loop.sourceText}
          onSendMessage={handleSocraticMessage}
          onSkip={handleSkipToSecondAttempt}
          isLoading={isProcessing}
        />
      )}

      {/* Simplify Challenge Phase */}
      {state.phase === 'simplify' && state.loop && (
        <SimplifyChallenge
          sourceText={state.loop.sourceText}
          recorderState={recorderState}
          duration={duration}
          isProcessing={isProcessing}
          recorderError={recorderError}
          onStart={() => void startRecording()}
          onStop={() => void handleStopRecording()}
        />
      )}

      {/* Complete Phase */}
      {state.phase === 'complete' && (
        <>
          <Confetti active={state.phase === 'complete'} duration={4000} />
          <Card className="p-10 text-center">
            <div className="mx-auto max-w-md">
              {/* Animated final score */}
              {state.loop && state.loop.attempts.length > 0 && (
                <div className="mb-6 flex justify-center">
                  <AnimatedScoreRing
                    value={state.loop.attempts[state.loop.attempts.length - 1].score}
                    size={160}
                    animate
                    duration={1500}
                    label="Final Score"
                  />
                </div>
              )}

              <h2 className="text-2xl font-bold mb-2 text-neutral-900">Mastered!</h2>
              <p className="text-neutral-600 mb-6">
                Excellent work completing the full Feynman loop. We'll check back in a few days to make sure it stuck.
              </p>

              {state.loop && state.loop.attempts.length > 1 && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200">
                  <div className="text-sm font-medium text-emerald-700 mb-3">Your Journey</div>
                  <div className="flex items-center justify-center gap-3">
                    {state.loop.attempts.map((attempt, index) => (
                      <div key={attempt.id} className="flex items-center gap-3">
                        <div className={cn(
                          'grid h-12 w-12 place-items-center text-lg font-bold',
                          index === state.loop!.attempts.length - 1
                            ? 'bg-emerald-500 text-white'
                            : 'bg-neutral-100 text-neutral-600'
                        )}>
                          {attempt.score}
                        </div>
                        {index < state.loop!.attempts.length - 1 && (
                          <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm font-medium text-emerald-600">
                    +{state.loop.attempts[state.loop.attempts.length - 1].score - state.loop.attempts[0].score} points improvement
                  </div>
                </div>
              )}

              {/* Review schedule hint */}
              <div className="mb-6 p-3 bg-neutral-50 border border-neutral-200">
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Scheduled for review in a few days</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button size="lg" onClick={handleTestYourself}>
                  Test Yourself Now
                </Button>
                <Button variant="secondary" size="lg" onClick={handleNewLoop}>
                  Learn Something New
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Error State */}
      {usageLimitReached && (
        <Card className="border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-amber-800">Daily limit reached</div>
                <p className="mt-1 text-sm text-amber-700">
                  You've used {usageLimitReached.loopsUsedToday} of {FREE_TIER_DAILY_LIMIT} free learning loops today.
                </p>
                <p className="mt-2 text-xs text-amber-600">
                  Resets at midnight UTC ({new Date(usageLimitReached.resetAt).toLocaleTimeString()})
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate('/settings')}>
                Upgrade to Pro
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setUsageLimitReached(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-red-700">Something went wrong</div>
              <p className="mt-1 text-sm text-red-600">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
