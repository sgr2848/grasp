import { AssemblyAI, TranscriptUtterance } from 'assemblyai'

let client: AssemblyAI | null = null

function getClient(): AssemblyAI {
  if (!client) {
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY is not set')
    }
    client = new AssemblyAI({ apiKey })
  }
  return client
}

export interface DiarizedTranscript {
  text: string
  speakers: SpeakerSegment[]
  duration: number
}

export interface SpeakerSegment {
  speaker: string
  text: string
  start: number
  end: number
}

/**
 * Transcribe audio with speaker diarization using AssemblyAI
 * Supports direct URLs including YouTube URLs
 */
export async function transcribeWithDiarization(audioUrl: string): Promise<DiarizedTranscript> {
  const assemblyai = getClient()

  console.log('[AssemblyAI] Starting transcription with speaker diarization...')

  const transcript = await assemblyai.transcripts.transcribe({
    audio_url: audioUrl,
    speaker_labels: true,
  })

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`)
  }

  // Format utterances with speaker labels
  const speakers: SpeakerSegment[] = (transcript.utterances || []).map((utterance: TranscriptUtterance) => ({
    speaker: utterance.speaker,
    text: utterance.text,
    start: utterance.start,
    end: utterance.end,
  }))

  // Create formatted text with speaker labels
  const formattedText = speakers
    .map(s => `[Speaker ${s.speaker}]: ${s.text}`)
    .join('\n\n')

  // Calculate duration in seconds from audio_duration (milliseconds)
  const durationSeconds = transcript.audio_duration ? Math.round(transcript.audio_duration / 1000) : 0

  console.log(`[AssemblyAI] Transcription complete. Found ${new Set(speakers.map(s => s.speaker)).size} speakers. Duration: ${durationSeconds}s`)

  return {
    text: formattedText || transcript.text || '',
    speakers,
    duration: durationSeconds,
  }
}

/**
 * Transcribe a YouTube video directly using AssemblyAI
 * AssemblyAI handles the YouTube audio extraction internally
 */
export async function transcribeYouTubeWithDiarization(videoId: string): Promise<DiarizedTranscript> {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  console.log(`[AssemblyAI] Transcribing YouTube video: ${youtubeUrl}`)
  return transcribeWithDiarization(youtubeUrl)
}

/**
 * Upload audio buffer to AssemblyAI and get URL
 */
export async function uploadAudio(audioBuffer: Buffer): Promise<string> {
  const assemblyai = getClient()

  console.log('[AssemblyAI] Uploading audio...')
  const uploadUrl = await assemblyai.files.upload(audioBuffer)
  console.log('[AssemblyAI] Audio uploaded successfully')

  return uploadUrl
}

/**
 * Transcribe audio buffer with speaker diarization
 */
export async function transcribeBufferWithDiarization(audioBuffer: Buffer): Promise<DiarizedTranscript> {
  const audioUrl = await uploadAudio(audioBuffer)
  return transcribeWithDiarization(audioUrl)
}
