import { Router } from 'express'
import multer from 'multer'
import { transcribeAudio } from '../services/whisper.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest } from '../types/index.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// POST /api/transcribe
router.post('/', authMiddleware, upload.single('audio'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' })
      return
    }

    const transcript = await transcribeAudio(req.file.buffer, req.file.originalname)

    res.json({ transcript })
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).json({ error: 'Failed to transcribe audio' })
  }
})

export default router
