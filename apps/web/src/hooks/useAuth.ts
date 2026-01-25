import { useEffect } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { setAuthTokenGetter } from '../lib/api'
import { setTTSAuthGetter } from '../lib/tts'

export function useAuth() {
  const { isSignedIn, isLoaded, userId, getToken } = useClerkAuth()

  useEffect(() => {
    // Set up the auth token getter for API calls
    const tokenGetter = async () => {
      try {
        return await getToken()
      } catch {
        return null
      }
    }
    setAuthTokenGetter(tokenGetter)
    setTTSAuthGetter(tokenGetter)
  }, [getToken])

  return {
    isSignedIn,
    isLoaded,
    userId
  }
}
