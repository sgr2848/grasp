import OpenAI from 'openai'

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export async function generateSpeech(
  text: string,
  voice: TTSVoice = 'nova'
): Promise<Buffer> {
  const response = await getOpenAI().audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    response_format: 'mp3'
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Streaming version - returns an async iterable of chunks
export async function generateSpeechStream(
  text: string,
  voice: TTSVoice = 'nova'
): Promise<AsyncIterable<Buffer>> {
  const response = await getOpenAI().audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    response_format: 'mp3'
  })

  // The response body is a Node.js ReadableStream
  const body = response.body as unknown as NodeJS.ReadableStream
  if (!body) {
    throw new Error('No response body')
  }

  // Return an async generator that yields chunks
  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of body) {
        yield chunk as Buffer
      }
    }
  }
}
