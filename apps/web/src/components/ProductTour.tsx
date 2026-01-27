import { TourProvider, useTour, type StepType, type PopoverContentProps } from '@reactour/tour'
import { useCallback, useEffect, type ReactNode } from 'react'
import { useOnboarding } from '@/context/OnboardingContext'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { cn } from '@/lib/cn'

// Tour steps configuration
const tourSteps: StepType[] = [
  {
    selector: '[data-tour="text-input"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Paste what you want to learn</h3>
        <p className="text-sm text-neutral-600">
          Start by pasting any text - an article, meeting notes, book chapter, or transcript.
          This is what you'll practice explaining back.
        </p>
      </div>
    ),
    position: 'bottom',
  },
  {
    selector: '[data-tour="content-type"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Choose your content type</h3>
        <p className="text-sm text-neutral-600">
          Select what kind of content you're learning from. This helps us tailor the evaluation to your material.
        </p>
      </div>
    ),
    position: 'top',
  },
  {
    selector: '[data-tour="precision-level"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Set your precision level</h3>
        <p className="text-sm text-neutral-600">
          Choose how detailed the check should be. "Main ideas" for quick overviews, "Every detail" for comprehensive mastery.
        </p>
      </div>
    ),
    position: 'top',
  },
  {
    selector: '[data-tour="start-button"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Start your learning loop</h3>
        <p className="text-sm text-neutral-600">
          Once you've read the material, click here to begin. You'll explain it back in your own words while recording.
        </p>
      </div>
    ),
    position: 'top',
  },
  {
    selector: '[data-tour="reader-preview"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Preview your content</h3>
        <p className="text-sm text-neutral-600">
          See how your text will look formatted. This appears when you paste 10+ words.
        </p>
      </div>
    ),
    position: 'left',
  },
  {
    selector: '[data-tour="sidebar-learn"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Learn</h3>
        <p className="text-sm text-neutral-600">
          This is your main learning hub. Paste content here and test your understanding.
        </p>
      </div>
    ),
    position: 'right',
  },
  {
    selector: '[data-tour="sidebar-dashboard"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Dashboard</h3>
        <p className="text-sm text-neutral-600">
          Track your progress, see your learning streaks, and review scheduled items.
        </p>
      </div>
    ),
    position: 'right',
  },
  {
    selector: '[data-tour="sidebar-knowledge"]',
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-neutral-900">Knowledge Map</h3>
        <p className="text-sm text-neutral-600">
          Visualize all the concepts you've learned and how they connect to each other.
        </p>
      </div>
    ),
    position: 'right',
  },
]

// Custom styles for the tour
const tourStyles = {
  popover: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e5e5',
    maxWidth: '320px',
  }),
  maskArea: (base: Record<string, unknown>) => ({
    ...base,
    rx: 8,
  }),
  badge: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: '#171717',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
  }),
  controls: (base: Record<string, unknown>) => ({
    ...base,
    marginTop: '16px',
  }),
  close: (base: Record<string, unknown>) => ({
    ...base,
    color: '#737373',
    width: '12px',
    height: '12px',
    top: '12px',
    right: '12px',
  }),
}

// Navigation component for the tour
function TourNavigation() {
  const { currentStep, steps, setCurrentStep, setIsOpen } = useTour()
  const { completeTour } = useOnboarding()

  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep, isFirstStep, setCurrentStep])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setIsOpen(false)
      completeTour()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, isLastStep, setCurrentStep, setIsOpen, completeTour])

  const handleSkip = useCallback(() => {
    setIsOpen(false)
    completeTour()
  }, [setIsOpen, completeTour])

  return (
    <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
      <button
        onClick={handleSkip}
        className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        Skip tour
      </button>
      <div className="flex items-center gap-2">
        {!isFirstStep && (
          <button
            onClick={handlePrev}
            className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-800"
          )}
        >
          {isLastStep ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  )
}

// Progress dots component
function TourProgress() {
  const { currentStep, steps, setCurrentStep } = useTour()

  return (
    <div className="flex items-center justify-center gap-1.5 pb-3">
      {steps.map((_, index) => (
        <button
          key={index}
          onClick={() => setCurrentStep(index)}
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-200",
            index === currentStep
              ? "bg-neutral-900 w-4"
              : index < currentStep
              ? "bg-neutral-400"
              : "bg-neutral-200"
          )}
          aria-label={`Go to step ${index + 1}`}
        />
      ))}
    </div>
  )
}

// Tour wrapper content component
function TourContent(props: PopoverContentProps) {
  const { steps, currentStep } = props
  const stepContent = steps[currentStep]?.content

  const renderContent = () => {
    if (typeof stepContent === 'function') {
      // The function returns void in the type definition but actually returns ReactNode
      return (stepContent as (props: PopoverContentProps) => ReactNode)(props)
    }
    return stepContent
  }

  return (
    <div>
      <TourProgress />
      <div className="py-2">
        {renderContent()}
      </div>
      <TourNavigation />
    </div>
  )
}

// Auto-start tour hook
function TourAutoStart() {
  const { setIsOpen } = useTour()
  const { showWelcome, isComplete, startTour } = useOnboarding()
  const { isSignedIn } = useClerkAuth()

  useEffect(() => {
    // Auto-start tour for first-time signed-in users after a delay
    if (showWelcome && !isComplete && isSignedIn) {
      const timer = setTimeout(() => {
        startTour()
        setIsOpen(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [showWelcome, isComplete, isSignedIn, setIsOpen, startTour])

  return null
}

// Main provider component
interface ProductTourProviderProps {
  children: ReactNode
}

export function ProductTourProvider({ children }: ProductTourProviderProps) {
  const { completeTour } = useOnboarding()

  return (
    <TourProvider
      steps={tourSteps}
      styles={tourStyles}
      padding={{ mask: 8, popover: [16, 12] }}
      onClickMask={({ setIsOpen }) => {
        setIsOpen(false)
        completeTour()
      }}
      ContentComponent={TourContent}
      showBadge={false}
      showNavigation={false}
      showCloseButton
      disableInteraction
      disableFocusLock={false}
      scrollSmooth
    >
      <TourAutoStart />
      {children}
    </TourProvider>
  )
}

// Hook to manually trigger the tour
export function useProductTour() {
  const tour = useTour()
  const { resetOnboarding } = useOnboarding()

  const restartTour = useCallback(() => {
    resetOnboarding()
    tour.setCurrentStep(0)
    tour.setIsOpen(true)
  }, [tour, resetOnboarding])

  return {
    ...tour,
    restartTour,
  }
}
