import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { tts, type TTSProvider } from '../lib/tts'
import type { TTSVoice } from '../lib/api'

interface TTSContextValue {
  enabled: boolean
  provider: TTSProvider
  voice: TTSVoice
  setEnabled: (enabled: boolean) => void
  setProvider: (provider: TTSProvider) => void
  setVoice: (voice: TTSVoice) => void
  speak: (text: string) => Promise<void>
  speakSequence: (texts: string[]) => Promise<void>
  stop: () => void
}

const TTSContext = createContext<TTSContextValue | null>(null)

export function TTSProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true)
  const [provider, setProviderState] = useState<TTSProvider>('browser')
  const [voice, setVoiceState] = useState<TTSVoice>('nova')

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value)
    tts.setEnabled(value)
  }, [])

  const setProvider = useCallback((value: TTSProvider) => {
    setProviderState(value)
    tts.setProvider(value)
  }, [])

  const setVoice = useCallback((value: TTSVoice) => {
    setVoiceState(value)
    tts.setVoice(value)
  }, [])

  const speak = useCallback((text: string) => tts.speak(text), [])
  const speakSequence = useCallback((texts: string[]) => tts.speakSequence(texts), [])
  const stop = useCallback(() => tts.stop(), [])

  return (
    <TTSContext.Provider value={{ enabled, provider, voice, setEnabled, setProvider, setVoice, speak, speakSequence, stop }}>
      {children}
    </TTSContext.Provider>
  )
}

export function useTTS() {
  const context = useContext(TTSContext)
  if (!context) {
    throw new Error('useTTS must be used within a TTSProvider')
  }
  return context
}
