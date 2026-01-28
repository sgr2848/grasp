import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { fetchYouTubeVideo, isYouTubeUrl } from '../services/youtube.js'
import type { AuthRequest } from '../types/index.js'

const router = Router()

// POST /api/youtube/fetch - Fetch YouTube video transcript
router.post('/fetch', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { url, identifySpeakers } = req.body as { url?: string; identifySpeakers?: boolean }

    if (!url) {
      res.status(400).json({ error: 'URL is required' })
      return
    }

    if (!isYouTubeUrl(url)) {
      res.status(400).json({
        error: 'INVALID_URL',
        message: 'Please enter a valid YouTube URL.'
      })
      return
    }

    console.log(`[YouTube] Fetching video for user ${req.userId}: ${url}${identifySpeakers ? ' (with speaker identification)' : ''}`)

    const result = await fetchYouTubeVideo(url, { identifySpeakers })

    // Check if result is an error
    if ('code' in result) {
      res.status(400).json({
        error: result.code,
        message: result.message
      })
      return
    }

    // Success - return video info
    res.json(result)
  } catch (error) {
    console.error('[YouTube] Route error:', error)
    res.status(500).json({
      error: 'FETCH_ERROR',
      message: "Couldn't fetch video. Please try again."
    })
  }
})

export default router
