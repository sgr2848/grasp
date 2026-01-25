import { useState, useEffect } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { getLoops } from '@/lib/api'

const FIRST_LOOP_COMPLETE_KEY = 'rt_first_loop_complete'

interface FirstTimeUserState {
  isFirstTimeUser: boolean
  isLoading: boolean
  hasCompletedLoops: boolean
  markFirstLoopComplete: () => void
}

export function useIsFirstTimeUser(): FirstTimeUserState {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [hasCompletedLoops, setHasCompletedLoops] = useState(false)

  useEffect(() => {
    // Check localStorage first for quick response
    const localComplete = localStorage.getItem(FIRST_LOOP_COMPLETE_KEY)
    if (localComplete === 'true') {
      setHasCompletedLoops(true)
      setIsLoading(false)
      return
    }

    // If not signed in, they're a first-time user
    if (isLoaded && !isSignedIn) {
      setIsLoading(false)
      return
    }

    // If signed in, check if user has ANY loops (not just mastered)
    if (isLoaded && isSignedIn) {
      getLoops()
        .then((loops) => {
          const hasAnyLoops = loops.length > 0
          setHasCompletedLoops(hasAnyLoops)
          if (hasAnyLoops) {
            localStorage.setItem(FIRST_LOOP_COMPLETE_KEY, 'true')
          }
        })
        .catch(() => {
          // On error, assume first-time user
          setHasCompletedLoops(false)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [isLoaded, isSignedIn])

  const markFirstLoopComplete = () => {
    localStorage.setItem(FIRST_LOOP_COMPLETE_KEY, 'true')
    setHasCompletedLoops(true)
  }

  return {
    isFirstTimeUser: !hasCompletedLoops,
    isLoading,
    hasCompletedLoops,
    markFirstLoopComplete,
  }
}
