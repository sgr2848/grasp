import { type TTSVoice } from './api'
import { personaConfig, type Persona } from './personas'
import { streamingTTS, setStreamingAuthGetter } from './tts-streaming'

export type TTSProvider = 'browser' | 'openai'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export function setTTSAuthGetter(getter: () => Promise<string | null>) {
  setStreamingAuthGetter(getter)
}

// Map of static messages to their pre-recorded audio file paths
// Files should be placed in /public/audio/personas/
const preRecordedAudio: Map<string, string> = new Map()

// Build the map from persona config
function initPreRecordedAudio() {
  const personas: Persona[] = ['coach', 'professor', 'sergeant', 'hype', 'chill']
  for (const persona of personas) {
    const config = personaConfig[persona]
    preRecordedAudio.set(config.welcomeMessage, `/audio/personas/${persona}-welcome.mp3`)
    preRecordedAudio.set(config.readyToRecordMessage, `/audio/personas/${persona}-ready.mp3`)
    preRecordedAudio.set(config.processingMessage, `/audio/personas/${persona}-processing.mp3`)
  }
}

initPreRecordedAudio()

class TTSController {
  private synth: SpeechSynthesis | null = null
  private enabled: boolean = true
  private provider: TTSProvider = 'browser'
  private voice: TTSVoice = 'nova'
  private currentAudio: HTMLAudioElement | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.stop()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setProvider(provider: TTSProvider) {
    this.provider = provider
  }

  getProvider(): TTSProvider {
    return this.provider
  }

  setVoice(voice: TTSVoice) {
    this.voice = voice
  }

  getVoice(): TTSVoice {
    return this.voice
  }

  async speak(text: string): Promise<void> {
    if (!this.enabled) return

    // Check for pre-recorded audio first (only when using OpenAI provider)
    if (this.provider === 'openai') {
      const preRecordedPath = preRecordedAudio.get(text)
      if (preRecordedPath) {
        return this.playPreRecorded(preRecordedPath)
      }
      return this.speakOpenAI(text)
    }
    return this.speakBrowser(text)
  }

  private async playPreRecorded(path: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(path)
      this.currentAudio = audio

      audio.onended = () => {
        this.currentAudio = null
        resolve()
      }
      audio.onerror = () => {
        this.currentAudio = null
        // Fall back to browser TTS if pre-recorded file fails
        resolve()
      }

      audio.play().catch(() => {
        this.currentAudio = null
        resolve()
      })
    })
  }

  private async speakBrowser(text: string): Promise<void> {
    if (!this.synth) return

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      this.synth!.speak(utterance)
    })
  }

  private async speakOpenAI(text: string): Promise<void> {
    try {
      // Use streaming TTS for lower latency
      await streamingTTS.speak(text, this.voice, API_BASE)
    } catch {
      // Fall back to browser TTS on error
      return this.speakBrowser(text)
    }
  }

  async speakSequence(texts: string[]): Promise<void> {
    for (const text of texts) {
      await this.speak(text)
      await this.pause(300) // Brief pause between segments
    }
  }

  private pause(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  stop() {
    if (this.synth) {
      this.synth.cancel()
    }
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
    // Also stop streaming TTS
    streamingTTS.stop()
  }
}

export const tts = new TTSController()
