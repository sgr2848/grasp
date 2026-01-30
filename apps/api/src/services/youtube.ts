import { YoutubeTranscript } from 'youtube-transcript'
import fs from 'fs'
import path from 'path'
import { transcribeAudio } from './whisper.js'
import { transcribeBufferWithDiarization, SpeakerSegment } from './assemblyai.js'

// Dynamic import of yt-dlp-exec to prevent route registration failures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ytDlpInstance: any = null
let cookiesFilePath: string | null = null

/**
 * Initialize YouTube cookies from environment variable
 * Expects YOUTUBE_COOKIES to be base64 encoded cookies.txt content
 */
function initializeCookies() {
  if (cookiesFilePath) return cookiesFilePath // Already initialized

  const cookiesBase64 = process.env.YOUTUBE_COOKIES
  if (!cookiesBase64) {
    console.log('[YouTube] No YOUTUBE_COOKIES env var found, proceeding without cookies')
    return null
  }

  try {
    // Decode base64 cookies
    const cookiesContent = Buffer.from(cookiesBase64, 'base64').toString('utf-8')

    // Write to temp file
    const tempDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    cookiesFilePath = path.join(tempDir, 'youtube-cookies.txt')
    fs.writeFileSync(cookiesFilePath, cookiesContent)

    console.log('[YouTube] Cookies loaded successfully from environment variable')
    return cookiesFilePath
  } catch (error) {
    console.error('[YouTube] Failed to initialize cookies:', error)
    return null
  }
}

async function getYtDlp() {
  if (!ytDlpInstance) {
    try {
      const { create } = await import('yt-dlp-exec')
      // Use YT_DLP_PATH if set, otherwise use 'yt-dlp' from system PATH
      const ytDlpPath = process.env.YT_DLP_PATH || 'yt-dlp'
      ytDlpInstance = create(ytDlpPath)
      console.log(`[YouTube] Using yt-dlp at: ${ytDlpPath}`)

      // Initialize cookies on first use
      initializeCookies()
    } catch (error) {
      console.error('[YouTube] Failed to load yt-dlp-exec:', error)
      throw new Error('yt-dlp is not available on this server')
    }
  }
  return ytDlpInstance
}

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
 * Download audio from YouTube and transcribe with Whisper
 */
async function transcribeWithWhisper(videoId: string): Promise<{ transcript: string; duration: number }> {
  // Use smart download (RapidAPI first, then yt-dlp fallback)
  const { audioBuffer, duration } = await downloadYouTubeAudioSmart(videoId)

  // Check file size (Whisper limit is 25MB)
  if (audioBuffer.length > 25 * 1024 * 1024) {
    throw new Error('Audio file too large for transcription')
  }

  // Transcribe with Whisper
  console.log('[YouTube] Transcribing with Whisper...')
  const transcript = await transcribeAudio(audioBuffer, `youtube-${videoId}.mp3`)

  return { transcript, duration }
}

/**
 * Download audio from YouTube using RapidAPI
 * Uses YouTube Media Downloader API
 */
async function downloadAudioWithRapidAPI(videoId: string): Promise<{ audioBuffer: Buffer; duration: number }> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) {
    throw new Error('RAPIDAPI_KEY environment variable not set')
  }

  console.log('[YouTube] Downloading audio with RapidAPI...')

  // Request audio download from RapidAPI (using youtube-media-downloader API)
  const response = await fetch(`https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=${videoId}`, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[YouTube] RapidAPI error:', errorText)
    throw new Error(`RapidAPI returned ${response.status}`)
  }

  const data = await response.json() as {
    audio?: Array<{ url: string; quality: string }>
    lengthSeconds?: string
  }

  if (!data.audio || data.audio.length === 0) {
    throw new Error('No audio streams available from RapidAPI')
  }

  // Get the first audio stream URL
  const audioUrl = data.audio[0].url
  const durationSeconds = data.lengthSeconds ? parseInt(data.lengthSeconds, 10) : 0

  console.log('[YouTube] Got RapidAPI download URL, fetching audio...')

  // Download the audio file
  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status}`)
  }

  const audioArrayBuffer = await audioResponse.arrayBuffer()
  const audioBuffer = Buffer.from(audioArrayBuffer)

  console.log(`[YouTube] Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB of audio via RapidAPI`)

  return { audioBuffer, duration: durationSeconds }
}

/**
 * Download audio from YouTube using yt-dlp (fallback)
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
      const ytDlp = await getYtDlp()
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
 * Download audio - tries RapidAPI first, falls back to yt-dlp with cookies
 */
async function downloadYouTubeAudioSmart(videoId: string): Promise<{ audioBuffer: Buffer; duration: number }> {
  // Try RapidAPI first if API key is available
  if (process.env.RAPIDAPI_KEY) {
    try {
      return await downloadAudioWithRapidAPI(videoId)
    } catch (rapidApiError) {
      console.log('[YouTube] RapidAPI failed, trying yt-dlp:', rapidApiError instanceof Error ? rapidApiError.message : rapidApiError)
    }
  }

  // Fall back to yt-dlp (with cookies if available)
  return await downloadAudioWithYtDlp(videoId)
}

/**
 * Transcribe YouTube video with AssemblyAI (includes speaker diarization)
 * Uses RapidAPI/yt-dlp to download audio, then uploads to AssemblyAI
 */
async function transcribeWithAssemblyAI(videoId: string): Promise<{ transcript: string; duration: number; speakers: SpeakerSegment[] }> {
  console.log('[YouTube] Transcribing with AssemblyAI (speaker diarization)...')

  // Download audio using RapidAPI (primary) or yt-dlp (fallback)
  const { audioBuffer, duration } = await downloadYouTubeAudioSmart(videoId)

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
