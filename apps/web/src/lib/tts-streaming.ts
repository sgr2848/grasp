// Streaming TTS player for lower latency audio playback

let getAuthToken: (() => Promise<string | null>) | null = null

export function setStreamingAuthGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter
}

export class StreamingTTS {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private isPlaying = false
  private abortController: AbortController | null = null

  async speak(text: string, voice: string, apiUrl: string): Promise<void> {
    if (!text.trim()) return

    this.stop()
    this.abortController = new AbortController()

    try {
      const token = getAuthToken ? await getAuthToken() : null
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${apiUrl}/tts/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, voice }),
        signal: this.abortController.signal,
      })

      if (!response.ok) throw new Error('TTS request failed')
      if (!response.body) throw new Error('No response body')

      // Initialize audio context on first use (must be after user interaction)
      if (!this.audioContext) {
        this.audioContext = new AudioContext()
      }

      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Collect chunks as they arrive
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Combine all chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      // Decode and play
      const audioBuffer = await this.audioContext.decodeAudioData(combined.buffer)

      this.currentSource = this.audioContext.createBufferSource()
      this.currentSource.buffer = audioBuffer
      this.currentSource.connect(this.audioContext.destination)
      this.currentSource.start()
      this.isPlaying = true

      return new Promise((resolve) => {
        if (!this.currentSource) {
          resolve()
          return
        }
        this.currentSource.onended = () => {
          this.isPlaying = false
          this.currentSource = null
          resolve()
        }
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Playback was stopped intentionally
        return
      }
      console.error('Streaming TTS error:', error)
      throw error
    }
  }

  stop() {
    // Abort any pending fetch
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // Stop current audio
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop()
      } catch {
        // Already stopped
      }
      this.currentSource = null
      this.isPlaying = false
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying
  }
}

// Singleton instance
export const streamingTTS = new StreamingTTS()
