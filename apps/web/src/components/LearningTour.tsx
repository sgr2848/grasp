import { useEffect, useCallback } from 'react'
import { TourProvider, useTour, type StepType, type PopoverContentProps } from '@reactour/tour'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useIsFirstTimeUser } from '@/hooks/useIsFirstTimeUser'

// Phase-specific tour steps
const tourSteps: StepType[] = [
  // Step 0: Input phase - paste content
  {
    selector: '[data-tour="text-input"]',
    content: ({ setCurrentStep, setIsOpen }: PopoverContentProps) => (
      <div className="space-y-3">
        <div className="text-base font-medium text-neutral-900">Paste what you want to learn</div>
        <p className="text-sm text-neutral-600">
          Copy any text here - an article, meeting notes, book chapter, or podcast transcript.
          We'll help you remember it.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Skip tour
          </button>
          <button
            onClick={() => setCurrentStep(1)}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Got it
          </button>
        </div>
      </div>
    ),
    position: 'bottom',
  },

  // Step 1: Start button
  {
    selector: '[data-tour="start-button"]',
    content: ({ setCurrentStep, setIsOpen }: PopoverContentProps) => (
      <div className="space-y-3">
        <div className="text-base font-medium text-neutral-900">Then hit Start</div>
        <p className="text-sm text-neutral-600">
          Once you've pasted at least 10 words, click Start Learning to begin.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Skip tour
          </button>
          <button
            onClick={() => setCurrentStep(2)}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Got it
          </button>
        </div>
      </div>
    ),
    position: 'top',
  },

  // Step 2: Recording phase - record button
  {
    selector: '[data-tour="record-button"]',
    content: ({ setCurrentStep, setIsOpen }: PopoverContentProps) => (
      <div className="space-y-3">
        <div className="text-base font-medium text-neutral-900">Record your explanation</div>
        <p className="text-sm text-neutral-600">
          Hit the button and explain what you just read in your own words.
          Don't worry about being perfect - just teach it back like you're explaining to a friend.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Skip tour
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Got it
          </button>
        </div>
      </div>
    ),
    position: 'top',
  },

  // Step 3: Results - score display
  {
    selector: '[data-tour="score-display"]',
    content: ({ setCurrentStep, setIsOpen }: PopoverContentProps) => (
      <div className="space-y-3">
        <div className="text-base font-medium text-neutral-900">Your recall score</div>
        <p className="text-sm text-neutral-600">
          This shows how much you remembered. Green means covered, gaps are what we'll help you learn next.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Skip tour
          </button>
          <button
            onClick={() => setCurrentStep(4)}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Got it
          </button>
        </div>
      </div>
    ),
    position: 'left',
  },

  // Step 4: Learning - chat
  {
    selector: '[data-tour="socratic-chat"]',
    content: ({ setCurrentStep, setIsOpen }: PopoverContentProps) => (
      <div className="space-y-3">
        <div className="text-base font-medium text-neutral-900">Fill your knowledge gaps</div>
        <p className="text-sm text-neutral-600">
          Chat with AI to learn what you missed. It asks guiding questions to help you discover the answers yourself.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Skip tour
          </button>
          <button
            onClick={() => setCurrentStep(5)}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Got it
          </button>
        </div>
      </div>
    ),
    position: 'top',
  },

  // Step 5: Second attempt
  {
    selector: '[data-tour="record-button"]',
    content: ({ setIsOpen }: PopoverContentProps) => (
      <div className="space-y-3">
        <div className="text-base font-medium text-neutral-900">Try again!</div>
        <p className="text-sm text-neutral-600">
          Now that you've learned the gaps, explain the material again. You'll see your improvement!
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Got it, let's do this!
          </button>
        </div>
      </div>
    ),
    position: 'top',
  },
]

// Phase to step mapping
const phaseToStep: Record<string, number> = {
  input: 0,
  prior_knowledge: 2, // Same as first_attempt for recording
  first_attempt: 2,
  first_results: 3,
  learning: 4,
  second_attempt: 5,
  second_results: 3, // Same as first_results
  simplify: 2, // Same as recording
  simplify_results: 3,
  complete: -1, // No tour step
}

interface LearningTourControllerProps {
  phase: string
}

function LearningTourController({ phase }: LearningTourControllerProps) {
  const { setIsOpen, setCurrentStep, currentStep } = useTour()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { isFirstTimeUser, isLoading } = useIsFirstTimeUser()

  // Check for force tour flag (for testing)
  const forceTour = typeof window !== 'undefined' && localStorage.getItem('rt_force_tour') === 'true'

  // Track which steps have been shown
  const shownStepsKey = 'rt_tour_shown_steps'

  const getShownSteps = useCallback((): Set<number> => {
    try {
      const stored = localStorage.getItem(shownStepsKey)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }, [])

  const markStepShown = useCallback((step: number) => {
    const shown = getShownSteps()
    shown.add(step)
    try {
      localStorage.setItem(shownStepsKey, JSON.stringify([...shown]))
    } catch {}
  }, [getShownSteps])

  // Handle phase changes
  useEffect(() => {
    // Wait for auth and loading to complete before deciding
    if (!isLoaded || !isSignedIn) return
    if (isLoading) return
    if (!isFirstTimeUser && !forceTour) return

    const targetStep = phaseToStep[phase]
    if (targetStep === undefined || targetStep < 0) {
      setIsOpen(false)
      return
    }

    const shownSteps = getShownSteps()

    // Don't re-show steps that have been shown
    if (shownSteps.has(targetStep)) return

    // For input phase, only show steps 0-1
    if (phase === 'input') {
      if (!shownSteps.has(0)) {
        // Wait for element to be rendered
        const timer = setTimeout(() => {
          const el = document.querySelector('[data-tour="text-input"]')
          if (el) {
            setCurrentStep(0)
            setIsOpen(true)
            markStepShown(0)
          }
        }, 500)
        return () => clearTimeout(timer)
      }
      return
    }

    // For other phases, show the appropriate step with a delay
    const timer = setTimeout(() => {
      // Check if the target element exists
      const stepDef = tourSteps[targetStep]
      if (stepDef && typeof stepDef.selector === 'string') {
        const el = document.querySelector(stepDef.selector)
        if (el) {
          setCurrentStep(targetStep)
          setIsOpen(true)
          markStepShown(targetStep)
        }
      }
    }, 800) // Give time for animations

    return () => clearTimeout(timer)
  }, [phase, isLoaded, isSignedIn, isFirstTimeUser, isLoading, forceTour, setIsOpen, setCurrentStep, getShownSteps, markStepShown])

  // When user clicks "Got it" and moves to next step in input phase
  useEffect(() => {
    if (phase === 'input' && currentStep === 1) {
      const el = document.querySelector('[data-tour="start-button"]')
      if (!el) {
        // Start button not visible yet, close the tour
        setIsOpen(false)
      } else {
        markStepShown(1)
      }
    }
  }, [phase, currentStep, setIsOpen, markStepShown])

  return null
}

interface LearningTourProviderProps {
  children: React.ReactNode
  phase: string
}

export function LearningTourProvider({ children, phase }: LearningTourProviderProps) {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { isFirstTimeUser, isLoading } = useIsFirstTimeUser()

  // Check for force tour flag (for testing)
  const forceTour = typeof window !== 'undefined' && localStorage.getItem('rt_force_tour') === 'true'

  // Don't render tour provider while loading, not signed in, or for returning users (unless forced)
  if (!isLoaded || !isSignedIn || isLoading || (!isFirstTimeUser && !forceTour)) {
    return <>{children}</>
  }

  return (
    <TourProvider
      steps={tourSteps}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '320px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        }),
        maskArea: (base) => ({
          ...base,
          rx: 8,
        }),
        maskWrapper: (base) => ({
          ...base,
          opacity: 0.4,
        }),
        badge: () => ({
          display: 'none',
        }),
        controls: () => ({
          display: 'none',
        }),
        close: () => ({
          display: 'none',
        }),
      }}
      padding={{ mask: 8, popover: [16, 12] }}
      onClickMask={() => {}} // Don't close on mask click
    >
      <LearningTourController phase={phase} />
      {children}
    </TourProvider>
  )
}
