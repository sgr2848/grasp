import { Router } from 'express'
import { generateSpeech, generateSpeechStream, type TTSVoice } from '../services/tts.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest } from '../types/index.js'

const router = Router()

// POST /api/tts - Generate speech from text (buffered)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { text, voice = 'nova' } = req.body as { text?: string; voice?: TTSVoice }

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' })
      return
    }

    if (text.length > 4096) {
      res.status(400).json({ error: 'Text too long (max 4096 characters)' })
      return
    }

    const audioBuffer = await generateSpeech(text, voice)

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString()
    })
    res.send(audioBuffer)
  } catch (error) {
    console.error('TTS error:', error)
    res.status(500).json({ error: 'Failed to generate speech' })
  }
})

// POST /api/tts/stream - Generate speech with streaming response
router.post('/stream', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { text, voice = 'nova' } = req.body as { text?: string; voice?: TTSVoice }

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' })
      return
    }

    if (text.length > 4096) {
      res.status(400).json({ error: 'Text too long (max 4096 characters)' })
      return
    }

    // Set headers for streaming audio
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'no-cache')

    const stream = await generateSpeechStream(text, voice)

    // Pipe the stream directly to response
    for await (const chunk of stream) {
      res.write(chunk)
    }

    res.end()
  } catch (error) {
    console.error('TTS streaming error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate speech' })
    } else {
      res.end()
    }
  }
})

export default router
