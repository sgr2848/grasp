import { Router } from 'express'
import { analyzeText } from '../services/llm.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest, Persona } from '../types/index.js'

const router = Router()

// POST /api/evaluate
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sourceText, transcript, persona } = req.body as {
      sourceText: string
      transcript: string
      persona: Persona
    }

    if (!sourceText || !transcript || !persona) {
      res.status(400).json({ error: 'Missing required fields: sourceText, transcript, persona' })
      return
    }

    const result = await analyzeText(sourceText, transcript, persona)

    res.json({
      score: result.score,
      analysis: {
        key_points: result.key_points,
        covered_points: result.covered_points,
        missed_points: result.missed_points,
        coverage: result.coverage,
        accuracy: result.accuracy,
        feedback: result.feedback,
        tts_script: result.tts_script
      }
    })
  } catch (error) {
    console.error('Evaluation error:', error)
    res.status(500).json({ error: 'Failed to evaluate explanation' })
  }
})

export default router
