import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SignInButton, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useRecorder } from '@/hooks/useRecorder'
import { useIsFirstTimeUser } from '@/hooks/useIsFirstTimeUser'
import { usePreferences } from '@/context/PreferencesContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import { useTTS } from '@/context/TTSContext'
import { LearningTourProvider } from '@/components/LearningTour'
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
  finishReading,
  fetchYouTubeVideo,
  isYouTubeUrl,
  UsageLimitExceededError,
  FeatureLimitExceededError,
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
  type SoftCapWarning,
  type YouTubeVideoInfo,
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
// ReviewDashboard removed - loops now shown in drawer
import { useInProgressLoops, InProgressLoopsDrawer } from '@/components/InProgressLoops'
import { RecordingEncouragement } from '@/components/RecordingEncouragement'
import { Confetti } from '@/components/Confetti'
import { AnimatedScoreRing } from '@/components/ui/AnimatedScoreRing'
import { ReaderPreview } from '@/components/ReaderPreview'
import { FocusAreasDisplay } from '@/components/FocusAreasDisplay'
import { ReadingPhase } from '@/components/ReadingPhase'
import { VideoWatchingPhase } from '@/components/VideoWatchingPhase'
import { ConceptSummaryCard } from '@/components/ConceptSummaryCard'
import { YouTubePreview } from '@/components/YouTubePreview'

type UIPhase = 'input' | 'youtube_preview' | 'loading' | 'focus_areas_display' | 'reading' | LoopPhase | 'error'

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
  const { isFirstTimeUser, markFirstLoopComplete } = useIsFirstTimeUser()

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
  const [_subjects, setSubjects] = useState<SubjectWithWorkspace[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(() => currentSubject?.id ?? null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usageLimitReached, setUsageLimitReached] = useState<UsageStats | null>(null)
  const [softCapWarning, setSoftCapWarning] = useState<SoftCapWarning | null>(null)
  const [loopsDrawerOpen, setLoopsDrawerOpen] = useState(false)

  // YouTube state
  const [youtubeVideo, setYoutubeVideo] = useState<YouTubeVideoInfo | null>(null)
  const [isFetchingYouTube, setIsFetchingYouTube] = useState(false)
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [identifySpeakers, setIdentifySpeakers] = useState(false)

  // Detect if input looks like a YouTube URL
  const isYouTubeInput = useMemo(() => {
    return sourceText.trim().length > 10 && isYouTubeUrl(sourceText.trim())
  }, [sourceText])

  // Fetch in-progress loops for the drawer
  const { loops: inProgressLoops, loading: loopsLoading, count: loopsCount } = useInProgressLoops()

  const { state: recorderState, duration, startRecording, stopRecording, reset: resetRecorder, error: recorderError } =
    useRecorder()

  const autoStopFiredRef = useRef(false)
  const hasWelcomedRef = useRef(false)
  const justCreatedLoopRef = useRef<string | null>(null)

  const wordCount = useMemo(() => sourceText.trim().split(/\s+/).filter(Boolean).length, [sourceText])
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

    // Skip if we just created this loop - we already have the data
    if (justCreatedLoopRef.current === loopId) {
      justCreatedLoopRef.current = null
      return
    }

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

  // Mark first loop complete when user completes a loop
  useEffect(() => {
    if (state.phase === 'complete') {
      markFirstLoopComplete()
    }
  }, [state.phase, markFirstLoopComplete])

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

      // Mark that we just created this loop to skip re-fetching
      justCreatedLoopRef.current = loop.id
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
  }, [canStart, title, sourceText, sourceType, selectedSubjectId, navigate, speak, precision])

  // Fetch YouTube video
  const handleFetchYouTube = useCallback(async () => {
    const url = sourceText.trim()
    if (!isYouTubeUrl(url)) return

    setIsFetchingYouTube(true)
    setYoutubeError(null)

    try {
      const video = await fetchYouTubeVideo(url, { identifySpeakers })
      setYoutubeVideo(video)
      setState((prev) => ({ ...prev, phase: 'youtube_preview' }))
    } catch (err) {
      setYoutubeError(toErrorMessage(err))
    } finally {
      setIsFetchingYouTube(false)
    }
  }, [sourceText, identifySpeakers])

  // Start learning from YouTube video
  const handleStartYouTubeLearning = useCallback(async (alreadyWatched: boolean) => {
    if (!youtubeVideo) return

    setIsProcessing(true)
    setError(null)

    try {
      // For YouTube videos, start in reading phase if user hasn't watched yet
      const initialPhase = alreadyWatched ? 'first_attempt' : 'reading'
      const loop = await createLoop({
        title: youtubeVideo.title,
        sourceText: youtubeVideo.transcript,
        sourceType: 'video',
        subjectId: selectedSubjectId || undefined,
        precision,
        metadata: {
          youtubeId: youtubeVideo.videoId,
          youtubeUrl: `https://youtube.com/watch?v=${youtubeVideo.videoId}`,
          channel: youtubeVideo.channel,
          thumbnail: youtubeVideo.thumbnail,
          videoDuration: youtubeVideo.duration,
        },
        initialPhase,
      })

      // Clear draft and YouTube state
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {}
      setYoutubeVideo(null)
      setSourceText('')

      // Mark that we just created this loop to skip re-fetching
      justCreatedLoopRef.current = loop.id
      navigate(`/learn/${loop.id}`, { replace: true })

      // Use the phase from the loop (set by backend)
      setState({
        phase: loop.currentPhase,
        loop: {
          ...loop,
          attempts: [],
          currentSocraticSession: null,
          reviewSchedule: null,
        },
        currentAttempt: null,
        socraticSession: null,
        speechAnalysis: null,
      })

      if (alreadyWatched) {
        void speak("Great! Now explain what you learned from the video in your own words.")
      } else {
        void speak("Take your time reading the transcript. Focus on the key ideas.")
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }, [youtubeVideo, selectedSubjectId, precision, navigate, speak])

  // Start learning from YouTube video with prior knowledge assessment
  const handleStartYouTubeLearningWithPrior = useCallback(async () => {
    if (!youtubeVideo) return

    setIsProcessing(true)
    setError(null)

    try {
      const loop = await createLoop({
        title: youtubeVideo.title,
        sourceText: youtubeVideo.transcript,
        sourceType: 'video',
        subjectId: selectedSubjectId || undefined,
        precision,
        metadata: {
          youtubeId: youtubeVideo.videoId,
          youtubeUrl: `https://youtube.com/watch?v=${youtubeVideo.videoId}`,
          channel: youtubeVideo.channel,
          thumbnail: youtubeVideo.thumbnail,
          videoDuration: youtubeVideo.duration,
        },
      })

      // Clear draft and YouTube state
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {}
      setYoutubeVideo(null)
      setSourceText('')

      // Mark that we just created this loop to skip re-fetching
      justCreatedLoopRef.current = loop.id
      navigate(`/learn/${loop.id}`, { replace: true })

      // Start with prior knowledge assessment
      setState({
        phase: 'prior_knowledge',
        loop: {
          ...loop,
          attempts: [],
          currentSocraticSession: null,
          reviewSchedule: null,
        },
        currentAttempt: null,
        socraticSession: null,
        speechAnalysis: null,
      })

      void speak("Before we begin, tell me what you already know about this topic from the video.")
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }, [youtubeVideo, selectedSubjectId, precision, navigate, speak])

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
          phase: 'focus_areas_display', // Show focus areas before reading
          loop: prev.loop
            ? {
                ...prev.loop,
                currentPhase: priorResult.nextPhase, // Backend phase is still first_attempt
                priorKnowledgeTranscript: transcript,
                priorKnowledgeAnalysis: priorResult.analysis,
                priorKnowledgeScore: priorResult.analysis.confidenceScore,
              }
            : null,
        }))

        // Speak feedback about what we found
        if (ttsEnabled && priorResult.analysis.feedback) {
          await speak(priorResult.analysis.feedback)
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

      // Check for soft cap warning (Pro users approaching/exceeding limit)
      if (attemptResult.warning) {
        setSoftCapWarning(attemptResult.warning)
      }

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
      if (err instanceof FeatureLimitExceededError && err.feature === 'sessions') {
        // V6: Monthly session limit for free tier
        setError(err.message)
      } else if (err instanceof UsageLimitExceededError) {
        // Legacy: Daily limit
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

  // Start prior knowledge assessment from first attempt (only if no attempts yet)
  const handleStartPriorKnowledge = useCallback(() => {
    if (!state.loop || state.loop.attempts.length > 0) return

    setState((prev) => ({ ...prev, phase: 'prior_knowledge' }))
    if (ttsEnabled) {
      void speak("Before we begin, tell me what you already know about this topic.")
    }
  }, [state.loop, ttsEnabled, speak])

  // Continue from focus areas display to reading phase
  const handleContinueToReading = useCallback(async () => {
    if (!state.loop) return

    setIsProcessing(true)
    setError(null)

    try {
      // Update backend phase to reading
      await updateLoopPhase(state.loop.id, 'reading')

      setState((prev) => ({
        ...prev,
        phase: 'reading',
        loop: prev.loop
          ? {
              ...prev.loop,
              currentPhase: 'reading',
            }
          : null,
      }))

      if (ttsEnabled) {
        void speak("Take your time reading. Focus on the areas I mentioned.")
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }, [state.loop, ttsEnabled, speak])

  // Continue from reading phase to first attempt
  const handleFinishedReading = useCallback(async () => {
    if (!state.loop) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await finishReading(state.loop.id)

      setState((prev) => ({
        ...prev,
        phase: result.nextPhase,
        loop: prev.loop
          ? {
              ...prev.loop,
              currentPhase: result.nextPhase,
            }
          : null,
      }))

      if (ttsEnabled) {
        void speak("Now explain what you just read in your own words.")
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

  // Get all covered concepts across all attempts and Socratic session
  const allCoveredConcepts = useMemo(() => {
    if (!state.loop) return []
    const covered = new Set<string>()
    state.loop.attempts.forEach((a) => {
      a.analysis?.covered_points?.forEach((p) => covered.add(p))
    })
    if (state.socraticSession?.conceptsAddressed) {
      state.socraticSession.conceptsAddressed.forEach((c) => covered.add(c))
    }
    return Array.from(covered)
  }, [state.loop, state.socraticSession])

  // Get missed concepts from the last attempt
  const allMissedConcepts = useMemo(() => {
    if (!state.loop || state.loop.attempts.length === 0) return []
    const lastAttempt = state.loop.attempts[state.loop.attempts.length - 1]
    return lastAttempt?.analysis?.missed_points ?? []
  }, [state.loop])

  return (
    <LearningTourProvider phase={state.phase}>
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header - different for first-time vs returning users */}
      {isFirstTimeUser && state.phase === 'input' ? (
        <div className="text-center py-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            What did you learn today?
          </h1>
          <p className="mt-2 text-neutral-500 max-w-md mx-auto">
            Paste an article, meeting notes, or anything you just read. We'll see how much stuck.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Learn</h1>
              <Badge variant="info">{personaConfig[selectedPersona].name}</Badge>
              {state.loop && <Badge variant="neutral">Loop #{state.loop.id.slice(0, 8)}</Badge>}
            </div>
            {/* In-progress loops button */}
            {state.phase === 'input' && loopsCount > 0 && (
              <button
                type="button"
                onClick={() => setLoopsDrawerOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
              >
                <svg className="h-4 w-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Continue</span>
                <Badge variant="warning" className="ml-1">{loopsCount}</Badge>
              </button>
            )}
          </div>
          <p className="text-sm text-neutral-500">
            Explain to remember. The best way to learn is to teach it back.
          </p>
        </div>
      )}

      {/* Loop Progress */}
      {state.loop && state.phase !== 'input' && state.phase !== 'loading' && state.phase !== 'error' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <LoopProgress phase={state.phase as LoopPhase} attempts={state.loop.attempts} />
        </div>
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
        <Card className="p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
            <Spinner size="lg" />
            Loading your learning session...
          </div>
        </Card>
      )}

      {/* In Progress Loops Drawer */}
      <InProgressLoopsDrawer
        isOpen={loopsDrawerOpen}
        onClose={() => setLoopsDrawerOpen(false)}
        loops={inProgressLoops}
        loading={loopsLoading}
      />

      {/* Input Phase - Clean UI for all users */}
      {state.phase === 'input' && isSignedIn && (
        <div
          className={cn(
            'grid gap-5 transition-all duration-700 ease-out animate-in fade-in slide-in-from-bottom-4 duration-500',
            wordCount >= 10
              ? 'lg:grid-cols-[30%_1fr]'
              : 'lg:grid-cols-1 max-w-2xl mx-auto'
          )}
        >
          {/* Left side - Input form (sticky) */}
          <Card className={cn("p-6 sm:p-8", wordCount >= 10 && "lg:sticky lg:top-4 lg:self-start")}>
            {/* Title input - shown when text is pasted */}
            {wordCount >= 10 && (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="mb-4 h-10 w-full border-0 border-b border-neutral-200 bg-transparent px-0 text-lg font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors animate-in fade-in slide-in-from-top-2 duration-300"
              />
            )}
            <textarea
              data-tour="text-input"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste any text here - an article, meeting notes, book chapter, podcast transcript..."
              className={cn(
                'w-full resize-none border-0 bg-neutral-50 p-4 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 rounded-lg transition-all duration-500',
                wordCount >= 10 ? 'h-32 sm:h-40' : 'h-48 sm:h-64'
              )}
              autoFocus
            />

            {/* Optional controls - shown after text is pasted with animation */}
            {wordCount >= 10 && (
              <div
                className="mt-6 pt-6 border-t border-neutral-100 animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationFillMode: 'both' }}
              >
                {/* Word count badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-neutral-500">Ready to start</span>
                  <Badge variant="neutral" className="animate-in zoom-in duration-300 delay-150">{wordCount} words</Badge>
                </div>

                {/* Content type selection */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 delay-100">
                  <div className="text-xs font-medium text-neutral-500 mb-3">What type of content is this?</div>
                  <div className="flex flex-wrap gap-2 stagger-children">
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
                          'animate-in fade-in zoom-in duration-300',
                          'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all duration-200',
                          'hover:scale-[1.02] active:scale-[0.98]',
                          sourceType === type.id
                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-md'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
                        )}
                      >
                        <span className="text-base">{type.icon}</span>
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Precision level selection */}
                <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-300">
                  <div className="text-xs font-medium text-neutral-500 mb-3">How detailed should the check be?</div>
                  <div className="flex flex-wrap gap-2 stagger-children">
                    {([
                      { id: 'essential', label: 'Main ideas', desc: 'Core concepts only' },
                      { id: 'balanced', label: 'Balanced', desc: 'Recommended' },
                      { id: 'precise', label: 'Every detail', desc: 'Comprehensive' },
                    ] as const).map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setPrecision(level.id)}
                        className={cn(
                          'animate-in fade-in zoom-in duration-300',
                          'flex flex-col items-start px-4 py-2.5 text-sm rounded-lg border transition-all duration-200',
                          'hover:scale-[1.02] active:scale-[0.98]',
                          precision === level.id
                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-md'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
                        )}
                      >
                        <span className="font-medium">{level.label}</span>
                        <span className={cn(
                          'text-xs mt-0.5',
                          precision === level.id ? 'text-neutral-300' : 'text-neutral-400'
                        )}>{level.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={cn(
              "mt-6 flex flex-col gap-3",
              (wordCount >= 10 || isYouTubeInput) && "animate-in fade-in slide-in-from-bottom-2 duration-400 delay-200"
            )}>
              {/* YouTube URL detected - show Fetch Video button */}
              {isYouTubeInput ? (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <svg className="h-5 w-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span className="text-sm font-medium text-red-700">YouTube video detected</span>
                  </div>
                  {/* Identify speakers option */}
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
                    <input
                      type="checkbox"
                      checked={identifySpeakers}
                      onChange={(e) => setIdentifySpeakers(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-neutral-900">Identify speakers</div>
                      <div className="text-xs text-neutral-500">
                        Label who's talking (useful for interviews, podcasts). Takes longer to process.
                      </div>
                    </div>
                  </label>
                  {youtubeError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                      {youtubeError}
                    </div>
                  )}
                  <Button
                    size="lg"
                    onClick={handleFetchYouTube}
                    disabled={isFetchingYouTube}
                    className="w-full sm:w-auto sm:px-12 shadow-lg hover:shadow-xl bg-red-600 hover:bg-red-700"
                  >
                    {isFetchingYouTube ? (
                      <>
                        <Spinner className="border-white/30 border-t-white" />
                        {identifySpeakers ? 'Transcribing with speakers...' : 'Fetching transcript...'}
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Fetch Video
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    data-tour="start-button"
                    size="lg"
                    onClick={handleSourceSubmit}
                    disabled={!canStart || isProcessing}
                    className={cn(
                      "w-full sm:w-auto sm:px-12 transition-all duration-300",
                      wordCount >= 10 && "shadow-lg hover:shadow-xl"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <Spinner className="border-white/30 border-t-white" />
                        Preparing...
                      </>
                    ) : wordCount < 10 ? (
                      `Paste at least ${10 - wordCount} more words`
                    ) : (
                      <>
                        <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Learning
                      </>
                    )}
                  </Button>

                  {wordCount < 10 && (
                    <div className="flex flex-col items-center gap-3 text-sm text-neutral-500 animate-fade-in">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          Record yourself explaining
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          See what you remembered
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span>Or paste a YouTube URL</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Right side - Reader preview (only visible when text is pasted) */}
          {wordCount >= 10 && (
            <Card className="overflow-hidden animate-in fade-in slide-in-from-right-8 duration-700 hidden lg:block">
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
                <div>
                  <div className="text-sm font-medium text-neutral-900">Preview</div>
                  <p className="text-xs text-neutral-500">How your content will appear</p>
                </div>
                <Badge variant="neutral">{wordCount} words</Badge>
              </div>
              <ReaderPreview text={sourceText} title={title} className="h-125 bg-white" />
            </Card>
          )}
        </div>
      )}

      {/* YouTube Preview Phase */}
      {state.phase === 'youtube_preview' && youtubeVideo && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <YouTubePreview
            video={youtubeVideo}
            onStartLearning={handleStartYouTubeLearning}
            onStartPriorKnowledge={handleStartYouTubeLearningWithPrior}
            isLoading={isProcessing}
          />
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setYoutubeVideo(null)
                setState((prev) => ({ ...prev, phase: 'input' }))
              }}
              className="text-sm text-neutral-500 hover:text-neutral-700 underline"
            >
              ← Back to input
            </button>
          </div>
        </div>
      )}

      {/* Prior Knowledge Assessment Phase */}
      {state.phase === 'prior_knowledge' && state.loop && (
        <Card className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

                <Card className="p-4 hidden lg:block">
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

          {/* Mobile controls */}
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pb-[env(safe-area-inset-bottom)] pt-3">
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
          </div>
        </Card>
      )}

      {/* Focus Areas Display Phase */}
      {state.phase === 'focus_areas_display' && state.loop?.priorKnowledgeAnalysis && (
        <FocusAreasDisplay
          analysis={state.loop.priorKnowledgeAnalysis}
          onContinue={handleContinueToReading}
        />
      )}

      {/* Reading/Watching Phase */}
      {state.phase === 'reading' && state.loop && (
        state.loop.sourceType === 'video' && state.loop.metadata?.youtubeId ? (
          <VideoWatchingPhase
            videoId={state.loop.metadata.youtubeId}
            transcript={state.loop.sourceText}
            title={state.loop.title ?? 'Video'}
            channel={state.loop.metadata.channel}
            focusAreas={state.loop.priorKnowledgeAnalysis?.focusAreas ?? []}
            onFinishedWatching={handleFinishedReading}
          />
        ) : (
          <ReadingPhase
            sourceText={state.loop.sourceText}
            title={state.loop.title ?? undefined}
            focusAreas={state.loop.priorKnowledgeAnalysis?.focusAreas ?? []}
            onFinishedReading={handleFinishedReading}
          />
        )
      )}

      {/* Recording Phase (First or Second Attempt) */}
      {(state.phase === 'first_attempt' || state.phase === 'second_attempt') && state.loop && (
        <Card className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

            {/* First-time user hint */}
            {isFirstTimeUser && state.phase === 'first_attempt' && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-700">
                  <span className="font-medium">How this works:</span> Hit record and explain what you just read as if teaching someone.
                  We'll score how much you remembered and help you fill any gaps.
                </div>
              </div>
            )}

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

                <Card className="p-4 hidden lg:block">
                  <div className="text-xs font-medium text-neutral-500">Controls</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {recorderState !== 'recording' ? (
                      <Button
                        data-tour="record-button"
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

                    {/* Option to assess prior knowledge (only on first attempt with no attempts yet) */}
                    {state.phase === 'first_attempt' && state.loop?.attempts.length === 0 && recorderState !== 'recording' && (
                      <Button
                        size="lg"
                        variant="ghost"
                        onClick={handleStartPriorKnowledge}
                        disabled={isProcessing}
                      >
                        Assess what I know first
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Mobile controls */}
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pb-[env(safe-area-inset-bottom)] pt-3">
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

              {/* Option to assess prior knowledge (only on first attempt with no attempts yet) */}
              {state.phase === 'first_attempt' && state.loop?.attempts.length === 0 && recorderState !== 'recording' && (
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleStartPriorKnowledge}
                  disabled={isProcessing}
                >
                  Assess what I know first
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Results Phases */}
      {(state.phase === 'first_results' || state.phase === 'second_results' || state.phase === 'simplify_results') &&
        state.currentAttempt && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
            {/* First-time user hint for results */}
            {isFirstTimeUser && state.phase === 'first_results' && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-emerald-700">
                  <span className="font-medium">Your score is in!</span> Green items are what you remembered correctly.
                  Next, we'll help you learn what you missed through a quick conversation.
                </div>
              </div>
            )}
            <div data-tour="score-display">
              <LoopResultsPanel
                attempt={state.currentAttempt}
                previousAttempt={previousAttempt}
                phase={state.phase}
                speechAnalysis={state.speechAnalysis}
                onContinue={handleContinue}
                onRetry={handleRetry}
                onTestYourself={handleTestYourself}
              />
            </div>
          </div>
        )}

      {/* Learning Phase (Socratic Dialogue) */}
      {state.phase === 'learning' && state.socraticSession && state.loop && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
          {/* First-time user hint for Socratic learning */}
          {isFirstTimeUser && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <svg className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div className="text-sm text-amber-700">
                <span className="font-medium">Fill the gaps!</span> Chat with the AI to understand what you missed.
                Once you've covered the key points, you'll get another chance to explain.
              </div>
            </div>
          )}
          <div data-tour="socratic-chat">
            <SocraticChat
              session={state.socraticSession}
              sourceText={state.loop.sourceText}
              onSendMessage={handleSocraticMessage}
              onSkip={handleSkipToSecondAttempt}
              isLoading={isProcessing}
            />
          </div>
        </div>
      )}

      {/* Simplify Challenge Phase */}
      {state.phase === 'simplify' && state.loop && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SimplifyChallenge
            sourceText={state.loop.sourceText}
            recorderState={recorderState}
            duration={duration}
            isProcessing={isProcessing}
            recorderError={recorderError}
            onStart={() => void startRecording()}
            onStop={() => void handleStopRecording()}
          />
        </div>
      )}

      {/* Complete Phase */}
      {state.phase === 'complete' && (
        <>
          <Confetti active={state.phase === 'complete'} duration={4000} />
          <Card className="p-10 text-center animate-in fade-in zoom-in duration-500">
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
                Excellent work! We'll check back in a few days to make sure it stuck.
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

              {/* Concept summary */}
              {(allCoveredConcepts.length > 0 || allMissedConcepts.length > 0) && (
                <div className="mb-6">
                  <ConceptSummaryCard
                    coveredConcepts={allCoveredConcepts}
                    missedConcepts={allMissedConcepts}
                  />
                </div>
              )}

              {/* First-time user hint about organization */}
              {isFirstTimeUser && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-blue-700">Pro tip: Stay organized</div>
                      <p className="mt-1 text-sm text-blue-600">
                        Create workspaces and subjects in the sidebar to organize your learning by topic.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Soft cap warning for Pro users */}
      {softCapWarning && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-800">
                {softCapWarning.warning === 'soft_cap_approaching' ? 'Approaching monthly limit' : 'Monthly budget exceeded'}
              </div>
              <p className="mt-1 text-sm text-amber-700">{softCapWarning.message}</p>
            </div>
            <button
              onClick={() => setSoftCapWarning(null)}
              className="text-amber-500 hover:text-amber-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </Card>
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
    </LearningTourProvider>
  )
}
