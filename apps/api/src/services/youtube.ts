import { YoutubeTranscript } from 'youtube-transcript'
import ytdl from '@distube/ytdl-core'
import { create as createYtDlp } from 'yt-dlp-exec'
import fs from 'fs'
import path from 'path'
import { transcribeAudio } from './whisper.js'
import { transcribeBufferWithDiarization, SpeakerSegment } from './assemblyai.js'

// Use system-installed yt-dlp (from homebrew) instead of bundled binary
const ytDlp = createYtDlp('/opt/homebrew/bin/yt-dlp')

export interface YouTubeVideoInfo {
  videoId: string
  title: string
  channel: string
  duration: number | null
  thumbnail: string
  transcript: string
  wordCount: number
  transcriptionMethod: 'captions' | 'whisper' | 'assemblyai'
  speakers?: SpeakerSegment[]
}

export interface YouTubeError {
  code: 'INVALID_URL' | 'NO_CAPTIONS' | 'PRIVATE_VIDEO' | 'FETCH_ERROR' | 'VIDEO_TOO_LONG' | 'TRANSCRIPTION_FAILED'
  message: string
}

// Max video duration for Whisper transcription (30 minutes)
const MAX_WHISPER_DURATION_SECONDS = 30 * 60

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: https://youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
    /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Check if a string looks like a YouTube URL
 */
export function isYouTubeUrl(text: string): boolean {
  const trimmed = text.trim()
  return (
    trimmed.includes('youtube.com/') ||
    trimmed.includes('youtu.be/') ||
    trimmed.includes('m.youtube.com/')
  )
}

interface OEmbedResponse {
  title: string
  author_name: string
  thumbnail_url?: string
}

/**
 * Fetch video metadata via oEmbed (free, no API key)
 */
async function fetchVideoMetadata(videoId: string): Promise<{ title: string; channel: string }> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`oEmbed request failed: ${response.status}`)
    }

    const data = await response.json() as OEmbedResponse
    return {
      title: data.title || 'Untitled Video',
      channel: data.author_name || 'Unknown Channel'
    }
  } catch (error) {
    console.error('[YouTube] Failed to fetch oEmbed metadata:', error)
    return {
      title: 'Untitled Video',
      channel: 'Unknown Channel'
    }
  }
}

/**
 * Fetch and clean transcript from YouTube captions
 */
async function fetchCaptionTranscript(videoId: string): Promise<string | null> {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)

    // Join all text segments, cleaning up spacing
    const transcript = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (transcript.length < 50) {
      return null
    }

    return transcript
  } catch (error) {
    console.log('[YouTube] No captions available, will try Whisper:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Download audio from YouTube video
 */
async function downloadYouTubeAudio(videoId: string): Promise<{ audioBuffer: Buffer; duration: number }> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  console.log('[YouTube] Downloading audio...')

  // Get video info first to check duration
  const info = await ytdl.getInfo(videoUrl)
  const durationSeconds = parseInt(info.videoDetails.lengthSeconds, 10)

  if (durationSeconds > MAX_WHISPER_DURATION_SECONDS) {
    throw new Error(`VIDEO_TOO_LONG:${durationSeconds}`)
  }

  // Download audio only (lowest quality to keep file small)
  const audioStream = ytdl(videoUrl, {
    filter: 'audioonly',
    quality: 'lowestaudio',
  })

  // Collect audio chunks into buffer
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    audioStream.on('end', () => resolve())
    audioStream.on('error', reject)
  })

  const audioBuffer = Buffer.concat(chunks)
  console.log(`[YouTube] Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB of audio`)

  return { audioBuffer, duration: durationSeconds }
}

/**
 * Download audio from YouTube and transcribe with Whisper
 */
async function transcribeWithWhisper(videoId: string): Promise<{ transcript: string; duration: number }> {
  const { audioBuffer, duration } = await downloadYouTubeAudio(videoId)

  // Check file size (Whisper limit is 25MB)
  if (audioBuffer.length > 25 * 1024 * 1024) {
    throw new Error('Audio file too large for transcription')
  }

  // Transcribe with Whisper
  console.log('[YouTube] Transcribing with Whisper...')
  const transcript = await transcribeAudio(audioBuffer, `youtube-${videoId}.webm`)

  return { transcript, duration }
}

/**
 * Download audio from YouTube using yt-dlp (more reliable than ytdl-core)
 * Uses workarounds for YouTube's SABR streaming restrictions
 * Tries multiple player clients if the first one fails
 */
async function downloadAudioWithYtDlp(videoId: string): Promise<{ audioBuffer: Buffer; duration: number }> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const tempDir = path.join(process.cwd(), 'uploads')

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const timestamp = Date.now()
  const outputPath = path.join(tempDir, `${timestamp}-${videoId}.mp3`)

  console.log('[YouTube] Downloading audio with yt-dlp...')

  // Different player clients to try - some work better for certain videos
  const playerClients = ['web', 'android', 'ios', 'tv']
  let lastError: Error | null = null
  let durationSeconds = 0

  for (const client of playerClients) {
    console.log(`[YouTube] Trying player client: ${client}`)

    const options = {
      noPlaylist: true,
      extractorArgs: `youtube:player_client=${client}`,
      format: 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
    }

    try {
      // Get video info for duration first
      const info = await ytDlp(videoUrl, {
        dumpSingleJson: true,
        skipDownload: true,
        ...options,
      }) as { duration?: number }

      durationSeconds = info.duration || 0

      if (durationSeconds > MAX_WHISPER_DURATION_SECONDS) {
        throw new Error(`VIDEO_TOO_LONG:${durationSeconds}`)
      }

      // Download audio using yt-dlp
      await ytDlp(videoUrl, {
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: 5,
        output: outputPath,
        ...options,
      })

      // Read the downloaded file
      const audioBuffer = fs.readFileSync(outputPath)
      console.log(`[YouTube] Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB of audio using ${client} client`)

      // Clean up temp file
      fs.unlinkSync(outputPath)

      return { audioBuffer, duration: durationSeconds }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMsg = lastError.message

      // Don't retry for certain errors
      if (errorMsg.startsWith('VIDEO_TOO_LONG:')) {
        throw lastError
      }

      console.log(`[YouTube] Client ${client} failed: ${errorMsg.substring(0, 100)}...`)

      // Clean up on error before trying next client
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath) } catch {}
      }
    }
  }

  // All clients failed
  throw lastError || new Error('Failed to download audio from YouTube')
}

/**
 * Transcribe YouTube video with AssemblyAI (includes speaker diarization)
 * Uses yt-dlp to download audio, then uploads to AssemblyAI
 */
async function transcribeWithAssemblyAI(videoId: string): Promise<{ transcript: string; duration: number; speakers: SpeakerSegment[] }> {
  console.log('[YouTube] Transcribing with AssemblyAI (speaker diarization)...')

  // Download audio using yt-dlp
  const { audioBuffer, duration } = await downloadAudioWithYtDlp(videoId)

  // Upload to AssemblyAI and transcribe with diarization
  const result = await transcribeBufferWithDiarization(audioBuffer)

  return { transcript: result.text, duration, speakers: result.speakers }
}

/**
 * Get thumbnail URL for a video
 */
function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export interface FetchYouTubeOptions {
  identifySpeakers?: boolean
}

/**
 * Fetch complete YouTube video info including transcript
 * First tries captions (unless speaker identification requested), falls back to AI transcription
 */
export async function fetchYouTubeVideo(url: string, options: FetchYouTubeOptions = {}): Promise<YouTubeVideoInfo | YouTubeError> {
  const { identifySpeakers = false } = options

  // Extract video ID
  const videoId = extractVideoId(url)
  if (!videoId) {
    return {
      code: 'INVALID_URL',
      message: 'Please enter a valid YouTube URL.'
    }
  }

  try {
    // First, fetch metadata
    const metadata = await fetchVideoMetadata(videoId)

    // If speaker identification is requested, skip captions and use AssemblyAI
    if (identifySpeakers) {
      console.log('[YouTube] Speaker identification requested, using AssemblyAI...')
      try {
        const { transcript, duration, speakers } = await transcribeWithAssemblyAI(videoId)

        return {
          videoId,
          title: metadata.title,
          channel: metadata.channel,
          duration,
          thumbnail: getThumbnailUrl(videoId),
          transcript,
          wordCount: countWords(transcript),
          transcriptionMethod: 'assemblyai',
          speakers
        }
      } catch (assemblyError) {
        const errorMsg = assemblyError instanceof Error ? assemblyError.message : String(assemblyError)

        if (errorMsg.startsWith('VIDEO_TOO_LONG:')) {
          const duration = parseInt(errorMsg.split(':')[1], 10)
          const minutes = Math.floor(duration / 60)
          return {
            code: 'VIDEO_TOO_LONG',
            message: `This video is ${minutes} minutes long. Videos must be under 30 minutes for speaker identification.`
          }
        }

        console.error('[YouTube] AssemblyAI transcription failed:', assemblyError)
        return {
          code: 'TRANSCRIPTION_FAILED',
          message: "Couldn't transcribe this video with speaker identification. Try without speaker identification."
        }
      }
    }

    // Try to get captions first (fast and free)
    const captionTranscript = await fetchCaptionTranscript(videoId)

    if (captionTranscript) {
      console.log('[YouTube] Got transcript from captions')
      return {
        videoId,
        title: metadata.title,
        channel: metadata.channel,
        duration: null,
        thumbnail: getThumbnailUrl(videoId),
        transcript: captionTranscript,
        wordCount: countWords(captionTranscript),
        transcriptionMethod: 'captions'
      }
    }

    // No captions available, try Whisper transcription
    console.log('[YouTube] No captions, attempting Whisper transcription...')

    try {
      const { transcript, duration } = await transcribeWithWhisper(videoId)

      return {
        videoId,
        title: metadata.title,
        channel: metadata.channel,
        duration,
        thumbnail: getThumbnailUrl(videoId),
        transcript,
        wordCount: countWords(transcript),
        transcriptionMethod: 'whisper'
      }
    } catch (whisperError) {
      const errorMsg = whisperError instanceof Error ? whisperError.message : String(whisperError)

      if (errorMsg.startsWith('VIDEO_TOO_LONG:')) {
        const duration = parseInt(errorMsg.split(':')[1], 10)
        const minutes = Math.floor(duration / 60)
        return {
          code: 'VIDEO_TOO_LONG',
          message: `This video is ${minutes} minutes long. Videos without captions must be under 30 minutes for AI transcription.`
        }
      }

      console.error('[YouTube] Whisper transcription failed:', whisperError)
      return {
        code: 'TRANSCRIPTION_FAILED',
        message: "Couldn't transcribe this video. It may be too long or the audio couldn't be processed."
      }
    }
  } catch (error) {
    console.error('[YouTube] Fetch error:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('Video unavailable') ||
        errorMessage.includes('Private video') ||
        errorMessage.includes('Sign in') ||
        errorMessage.includes('confirm your age')) {
      return {
        code: 'PRIVATE_VIDEO',
        message: "Couldn't access this video. Make sure it's public and not age-restricted."
      }
    }

    return {
      code: 'FETCH_ERROR',
      message: "Couldn't fetch video. Check your connection and try again."
    }
  }
}
