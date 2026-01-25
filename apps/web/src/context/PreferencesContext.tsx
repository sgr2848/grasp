import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { getUserPreferences, updateUserPreferences } from '../lib/api'
import { personaConfig, type Persona } from '../lib/personas'
import { useTTS } from './TTSContext'

interface PreferencesContextValue {
  isLoading: boolean
  error: string | null
  selectedPersona: Persona
  ttsEnabled: boolean
  isPaid: boolean
  setSelectedPersona: (persona: Persona) => Promise<boolean>
  setTTSEnabled: (enabled: boolean) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

const LOCAL_KEY = 'rt_prefs_v1'

function readLocalPrefs(): { selectedPersona?: Persona; ttsEnabled?: boolean } {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { selectedPersona?: unknown; ttsEnabled?: unknown }

    const selectedPersona =
      typeof parsed.selectedPersona === 'string' && parsed.selectedPersona in personaConfig
        ? (parsed.selectedPersona as Persona)
        : undefined
    const ttsEnabled = typeof parsed.ttsEnabled === 'boolean' ? parsed.ttsEnabled : undefined

    return { selectedPersona, ttsEnabled }
  } catch {
    return {}
  }
}

function writeLocalPrefs(prefs: { selectedPersona?: Persona; ttsEnabled?: boolean }) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore localStorage failures (private mode, etc.)
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong'
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { setEnabled: setTTSEnabledInTTS } = useTTS()

  const [selectedPersona, setSelectedPersonaState] = useState<Persona>(
    () => readLocalPrefs().selectedPersona ?? 'coach',
  )
  const [ttsEnabled, setTTSEnabledState] = useState<boolean>(() => readLocalPrefs().ttsEnabled ?? true)
  const [isPaid, setIsPaid] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTTSEnabledInTTS(ttsEnabled)
    writeLocalPrefs({ selectedPersona, ttsEnabled })
  }, [selectedPersona, ttsEnabled, setTTSEnabledInTTS])

  const refresh = useCallback(async () => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setIsPaid(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const prefs = await getUserPreferences()
      setSelectedPersonaState(prefs.selectedPersona)
      setTTSEnabledState(prefs.ttsEnabled)
      setIsPaid(prefs.isPaid)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setSelectedPersona = useCallback(
    async (persona: Persona): Promise<boolean> => {
      const config = personaConfig[persona]
      if (!config) return false

      if (config.isPaid && !isPaid) {
        setError('Upgrade required for this persona')
        return false
      }

      setSelectedPersonaState(persona)
      setError(null)

      if (!isSignedIn) return true

      try {
        await updateUserPreferences({ selectedPersona: persona })
        return true
      } catch (err) {
        setError(toErrorMessage(err))
        return false
      }
    },
    [isPaid, isSignedIn],
  )

  const setTTSEnabled = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      setTTSEnabledState(enabled)
      setError(null)

      if (!isSignedIn) return true

      try {
        await updateUserPreferences({ ttsEnabled: enabled })
        return true
      } catch (err) {
        setError(toErrorMessage(err))
        return false
      }
    },
    [isSignedIn],
  )

  const value = useMemo<PreferencesContextValue>(
    () => ({
      isLoading,
      error,
      selectedPersona,
      ttsEnabled,
      isPaid,
      setSelectedPersona,
      setTTSEnabled,
      refresh,
      clearError: () => setError(null),
    }),
    [error, isLoading, isPaid, refresh, selectedPersona, setSelectedPersona, setTTSEnabled, ttsEnabled],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}
