import { Router } from 'express'
import { sessionQueries, userQueries } from '../db/queries.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest, CreateSessionInput } from '../types/index.js'

const router = Router()

// GET /api/sessions - List all sessions for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const subjectId = req.query.subjectId as string | undefined
    const sessions = await sessionQueries.findByUserId(req.userId!, subjectId)

    res.json(sessions.map(s => ({
      id: s.id,
      title: s.title,
      sourceText: s.sourceText.substring(0, 100) + (s.sourceText.length > 100 ? '...' : ''),
      sourceWordCount: s.sourceWordCount,
      sourceType: s.sourceType,
      subjectId: s.subjectId,
      durationSeconds: s.durationSeconds,
      score: s.score,
      persona: s.persona,
      keyPointsCount: s.keyPointsCount,
      coveredCount: s.coveredCount,
      missedCount: s.missedCount,
      createdAt: s.createdAt
    })))
  } catch (error) {
    console.error('Sessions fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// GET /api/sessions/:id - Get single session with full details
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.params.id as string
    const session = await sessionQueries.findById(sessionId, req.userId!)

    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.json(session)
  } catch (error) {
    console.error('Session fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch session' })
  }
})

// POST /api/sessions - Create new session
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const input = req.body as CreateSessionInput

    if (!input.sourceText || !input.transcript || input.score === undefined || !input.persona || !input.analysis) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    // Ensure user exists
    await userQueries.upsert(req.userId!)

    // Generate title from first ~50 chars of source text
    const title = input.title || input.sourceText.substring(0, 50).trim() + (input.sourceText.length > 50 ? '...' : '')

    const session = await sessionQueries.create({
      userId: req.userId!,
      title,
      sourceText: input.sourceText,
      sourceWordCount: input.sourceWordCount || input.sourceText.trim().split(/\s+/).length,
      sourceType: input.sourceType,
      subjectId: input.subjectId,
      transcript: input.transcript,
      durationSeconds: input.durationSeconds || 0,
      score: input.score,
      persona: input.persona,
      keyPointsCount: input.analysis.key_points?.length || 0,
      coveredCount: input.analysis.covered_points?.length || 0,
      missedCount: input.analysis.missed_points?.length || 0,
      analysis: input.analysis
    })

    res.status(201).json({ id: session.id })
  } catch (error) {
    console.error('Session create error:', error)
    res.status(500).json({ error: 'Failed to create session' })
  }
})

export default router
