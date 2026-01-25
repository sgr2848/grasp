import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useIsFirstTimeUser } from '@/hooks/useIsFirstTimeUser'

/**
 * Redirects first-time users from /dashboard to /learn
 * This ensures new users start with the core learning experience
 */
export function FirstTimeUserRedirect() {
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth()
  const { isFirstTimeUser, isLoading } = useIsFirstTimeUser()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Wait for auth and first-time check to load
    if (!authLoaded || isLoading) return

    // Only redirect if signed in and on dashboard
    if (!isSignedIn) return
    if (location.pathname !== '/dashboard') return

    // If first-time user, redirect to /learn
    if (isFirstTimeUser) {
      navigate('/learn', { replace: true })
    }
  }, [authLoaded, isSignedIn, isFirstTimeUser, isLoading, location.pathname, navigate])

  return null
}
