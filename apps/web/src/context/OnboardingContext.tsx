import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'

const STORAGE_KEY = 'rt_onboarding_complete'

interface OnboardingContextValue {
  showWelcome: boolean
  isComplete: boolean
  startTour: () => void
  skipTour: () => void
  completeTour: () => void
  resetOnboarding: () => void // For testing
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [showWelcome, setShowWelcome] = useState(false)
  const [isComplete, setIsComplete] = useState(true) // Start as true to prevent flash

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      // First time user - show welcome after short delay
      const timer = setTimeout(() => {
        setShowWelcome(true)
        setIsComplete(false)
      }, 500)
      return () => clearTimeout(timer)
    }
    setIsComplete(true)
  }, [])

  const startTour = useCallback(() => {
    setShowWelcome(false)
    // For now, just mark as complete since we're doing a simplified welcome modal
    // A full tour with step-by-step highlights can be added later
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsComplete(true)
  }, [])

  const skipTour = useCallback(() => {
    setShowWelcome(false)
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsComplete(true)
  }, [])

  const completeTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsComplete(true)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setIsComplete(false)
    setShowWelcome(true)
  }, [])

  return (
    <OnboardingContext.Provider
      value={{
        showWelcome,
        isComplete,
        startTour,
        skipTour,
        completeTour,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}
