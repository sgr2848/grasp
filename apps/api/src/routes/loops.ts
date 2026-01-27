import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest, CreateLoopInput, SubmitAttemptInput, LoopPhase, SubmitPriorKnowledgeInput, UsageStats, UsageLimitError } from '../types/index.js'
import { FREE_TIER_DAILY_LIMIT } from '../types/index.js'
import {
  learningLoopQueries,
  loopAttemptQueries,
  socraticSessionQueries,
  reviewScheduleQueries,
  priorKnowledgeQueries,
  userQueries
} from '../db/queries.js'
import { extractConcepts, evaluateWithConcepts, assessPriorKnowledge } from '../services/llm.js'
import { syncLoopConcepts, updateKnowledgeOnCompletion } from '../services/knowledge.js'
import { generateSocraticQuestion, generateSocraticResponse } from '../services/socratic.js'

const router = Router()

// POST /api/loops - Create a new learning loop
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, sourceText, sourceType, subjectId, precision } = req.body as CreateLoopInput

    if (!sourceText || !sourceType) {
      res.status(400).json({ error: 'sourceText and sourceType are required' })
      return
    }

    // Create the loop
    const loop = await learningLoopQueries.create({
      userId: req.userId!,
      subjectId,
      title,
      sourceText,
      sourceType,
      precision
    })

    // Extract concepts synchronously to ensure knowledge map is created
    try {
      console.log(`[Loop ${loop.id}] Starting concept extraction...`)
      const { concepts, conceptMap } = await extractConcepts(sourceText, loop.precision)

      if (concepts.length > 0) {
        console.log(`[Loop ${loop.id}] Extracted ${concepts.length} concepts, syncing...`)
        await learningLoopQueries.updateConcepts(loop.id, concepts, conceptMap)
        await syncLoopConcepts(loop.id)
        console.log(`[Loop ${loop.id}] Knowledge map created successfully`)
      } else {
        console.warn(`[Loop ${loop.id}] No concepts extracted from source text`)
      }
    } catch (err) {
      // Log error but don't fail the loop creation - concepts can be extracted later
      console.error(`[Loop ${loop.id}] Failed to extract concepts:`, err)
    }

    res.status(201).json(loop)
  } catch (error) {
    console.error('Create loop error:', error)
    res.status(500).json({ error: 'Failed to create learning loop' })
  }
})

// GET /api/loops - List user's loops
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined
    const subjectId = req.query.subjectId as string | undefined
    const loops = await learningLoopQueries.findByUserId(
      req.userId!,
      status as 'in_progress' | 'mastered' | 'archived' | undefined,
      subjectId
    )
    res.json(loops)
  } catch (error) {
    console.error('List loops error:', error)
    res.status(500).json({ error: 'Failed to list loops' })
  }
})

// GET /api/loops/:id - Get loop with attempts
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const loop = await learningLoopQueries.findById(id)

    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }

    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Get attempts and active socratic session
    const attempts = await loopAttemptQueries.findByLoopId(id)
    const socraticSession = await socraticSessionQueries.findActiveByLoopId(id)
    const reviewSchedule = await reviewScheduleQueries.findByLoopId(id)

    res.json({
      ...loop,
      attempts,
      currentSocraticSession: socraticSession,
      reviewSchedule
    })
  } catch (error) {
    console.error('Get loop error:', error)
    res.status(500).json({ error: 'Failed to get loop' })
  }
})

// POST /api/loops/:id/attempts - Submit an attempt
router.post('/:id/attempts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const loopId = req.params.id as string
    const { transcript, durationSeconds, attemptType, persona, speechMetrics } = req.body as SubmitAttemptInput

    // Get the loop
    const loop = await learningLoopQueries.findById(loopId)
    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }
    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Check usage limits for free users
    const user = await userQueries.getWithUsage(req.userId!)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    if (!user.isPaid && user.loopsUsedToday >= FREE_TIER_DAILY_LIMIT) {
      // Calculate next reset time (midnight UTC)
      const now = new Date()
      const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      ))

      const usage: UsageStats = {
        loopsUsedToday: user.loopsUsedToday,
        dailyLimit: FREE_TIER_DAILY_LIMIT,
        remainingLoops: 0,
        isPaid: false,
        resetAt: tomorrow.toISOString()
      }

      const errorResponse: UsageLimitError = {
        error: 'usage_limit_exceeded',
        message: `You've reached your daily limit of ${FREE_TIER_DAILY_LIMIT} learning loops. Upgrade to Pro for unlimited access.`,
        usage
      }

      res.status(429).json(errorResponse)
      return
    }

    // Evaluate the explanation - use loop's precision setting
    let keyConcepts = loop.keyConcepts?.map(c => c.concept) || []
    if (keyConcepts.length === 0) {
      console.log(`[Loop ${loopId}] No concepts found, extracting now (fallback)...`)
      const extracted = await extractConcepts(loop.sourceText, loop.precision)
      if (extracted.concepts.length > 0) {
        await learningLoopQueries.updateConcepts(loop.id, extracted.concepts, extracted.conceptMap)
        await syncLoopConcepts(loop.id)
        keyConcepts = extracted.concepts.map(c => c.concept)
        console.log(`[Loop ${loopId}] Fallback extraction successful: ${keyConcepts.length} concepts`)
      } else {
        console.warn(`[Loop ${loopId}] Fallback extraction failed - no concepts extracted`)
      }
    }
    const evaluation = await evaluateWithConcepts(
      loop.sourceText,
      keyConcepts,
      transcript,
      persona,
      attemptType,
      loop.precision,
      loop.priorKnowledgeAnalysis
    )

    // Calculate score
    const score = Math.round((evaluation.coverage * 0.6 + evaluation.accuracy * 0.4) * 100)

    // Create attempt record
    const attempt = await loopAttemptQueries.create({
      loopId,
      attemptType,
      transcript,
      durationSeconds,
      score,
      coverage: evaluation.coverage,
      accuracy: evaluation.accuracy,
      analysis: evaluation,
      speechMetrics,
      persona
    })

    // Increment usage for free users
    if (!user.isPaid) {
      await userQueries.incrementUsage(req.userId!)
    }

    // Determine next phase
    let nextPhase: LoopPhase = loop.currentPhase

    if (attemptType === 'full_explanation') {
      if (loop.currentPhase === 'first_attempt') {
        nextPhase = 'first_results'
      } else if (loop.currentPhase === 'second_attempt') {
        nextPhase = 'second_results'
      }
    } else if (attemptType === 'simplify_challenge') {
      nextPhase = 'simplify_results'
      if (score >= 80) {
        // Schedule first review
        await reviewScheduleQueries.create(req.userId!, loopId, 1)
      }
    } else if (attemptType === 'quick_review') {
      // Update review schedule
      const schedule = await reviewScheduleQueries.findByLoopId(loopId)
      if (schedule) {
        await reviewScheduleQueries.completeReview(schedule.id, score)
      }
    }

    await learningLoopQueries.updatePhase(loopId, nextPhase)

    res.json({
      attempt,
      nextPhase,
      evaluation
    })
  } catch (error) {
    console.error('Submit attempt error:', error)
    res.status(500).json({ error: 'Failed to submit attempt' })
  }
})

// POST /api/loops/:id/phase - Update loop phase
router.post('/:id/phase', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const loopId = req.params.id as string
    const { phase } = req.body as { phase: LoopPhase }

    const loop = await learningLoopQueries.findById(loopId)
    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }
    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    const updatedPhase = await learningLoopQueries.updatePhase(loopId, phase)
    let updatedLoop = updatedPhase

    if (phase === 'complete' && loop.status !== 'mastered') {
      const statusUpdated = await learningLoopQueries.updateStatus(loopId, 'mastered')
      if (statusUpdated) {
        updatedLoop = statusUpdated
      }

      try {
        await updateKnowledgeOnCompletion(loopId)
      } catch (err) {
        console.error('Knowledge update error:', err)
      }
    }

    res.json(updatedLoop)
  } catch (error) {
    console.error('Update phase error:', error)
    res.status(500).json({ error: 'Failed to update phase' })
  }
})

// POST /api/loops/:id/socratic - Start Socratic session
router.post('/:id/socratic', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const loopId = req.params.id as string
    const { attemptId } = req.body as { attemptId?: string }

    const loop = await learningLoopQueries.findById(loopId)
    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }
    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Get missed concepts from last attempt
    const lastAttempt = await loopAttemptQueries.findLatest(loopId)
    const missedConcepts = lastAttempt?.analysis?.missed_points || []

    if (missedConcepts.length === 0) {
      res.status(400).json({ error: 'No missed concepts to discuss' })
      return
    }

    // Create session
    const session = await socraticSessionQueries.create(
      loopId,
      attemptId || lastAttempt?.id || null,
      missedConcepts
    )

    // Generate first question
    const firstQuestion = await generateSocraticQuestion(
      loop.sourceText,
      missedConcepts,
      [],
      'start'
    )

    // Add AI message
    await socraticSessionQueries.addMessage(session.id, {
      role: 'assistant',
      content: firstQuestion,
      timestamp: new Date().toISOString()
    })

    // Update loop phase
    await learningLoopQueries.updatePhase(loopId, 'learning')

    const updatedSession = await socraticSessionQueries.findById(session.id)

    res.json({
      session: updatedSession,
      message: firstQuestion
    })
  } catch (error) {
    console.error('Start Socratic error:', error)
    res.status(500).json({ error: 'Failed to start Socratic session' })
  }
})

// POST /api/loops/:id/socratic/:sessionId/message - Send message in Socratic session
router.post('/:id/socratic/:sessionId/message', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const loopId = req.params.id as string
    const sessionId = req.params.sessionId as string
    const { content } = req.body as { content: string }

    const loop = await learningLoopQueries.findById(loopId)
    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }
    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    const session = await socraticSessionQueries.findById(sessionId)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    // Add user message
    await socraticSessionQueries.addMessage(sessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    })

    // Generate AI response
    const response = await generateSocraticResponse(
      loop.sourceText,
      loop.keyConcepts || [],
      session.targetConcepts,
      session.conceptsAddressed || [],
      session.messages,
      content
    )

    // Add AI response
    await socraticSessionQueries.addMessage(sessionId, {
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString()
    })

    // Mark concept as addressed if any
    if (response.addressedConcept) {
      await socraticSessionQueries.markConceptAddressed(sessionId, response.addressedConcept)
      console.log(`[Socratic] Concept addressed: "${response.addressedConcept}"`)
    }

    // Check if all concepts addressed
    const updatedSession = await socraticSessionQueries.findById(sessionId)
    const targetConcepts = updatedSession?.targetConcepts || []
    const addressedConcepts = updatedSession?.conceptsAddressed || []

    console.log(`[Socratic] Target concepts (${targetConcepts.length}):`, targetConcepts)
    console.log(`[Socratic] Addressed concepts (${addressedConcepts.length}):`, addressedConcepts)

    // All target concepts must be in the addressed list
    const allAddressed = targetConcepts.length > 0 &&
      targetConcepts.every(c => addressedConcepts.includes(c))

    console.log(`[Socratic] All addressed: ${allAddressed} (${addressedConcepts.length}/${targetConcepts.length})`)

    if (allAddressed) {
      await socraticSessionQueries.updateStatus(sessionId, 'completed')
      await learningLoopQueries.updatePhase(loopId, 'second_attempt')
      console.log('[Socratic] Session completed, moving to second_attempt phase')
    }

    res.json({
      message: response.message,
      addressedConcept: response.addressedConcept,
      allAddressed,
      session: updatedSession
    })
  } catch (error) {
    console.error('Socratic message error:', error)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// GET /api/loops/reviews/due - Get due reviews
router.get('/reviews/due', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const reviews = await reviewScheduleQueries.findDue(req.userId!)

    // Get loop details for each review
    const reviewsWithLoops = await Promise.all(
      reviews.map(async review => {
        const loop = await learningLoopQueries.findById(review.loopId)
        return {
          ...review,
          loop: loop ? {
            id: loop.id,
            title: loop.title,
            sourceText: loop.sourceText.substring(0, 200),
            keyConcepts: loop.keyConcepts
          } : null
        }
      })
    )

    res.json(reviewsWithLoops)
  } catch (error) {
    console.error('Get reviews error:', error)
    res.status(500).json({ error: 'Failed to get reviews' })
  }
})

// ============================================
// V4: Prior Knowledge Assessment Endpoints
// ============================================

// POST /api/loops/:id/prior-knowledge - Submit prior knowledge assessment
router.post('/:id/prior-knowledge', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const loopId = req.params.id as string
    const { transcript, durationSeconds } = req.body as SubmitPriorKnowledgeInput

    if (!transcript) {
      res.status(400).json({ error: 'transcript is required' })
      return
    }

    // Get the loop
    const loop = await learningLoopQueries.findById(loopId)
    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }
    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Get target concepts from the loop
    const targetConcepts = loop.keyConcepts?.map(c => c.concept) || []

    // If no concepts extracted yet, wait a moment and try again
    let concepts = targetConcepts
    if (concepts.length === 0) {
      // Try to extract concepts synchronously if not yet done
      const extracted = await extractConcepts(loop.sourceText, loop.precision)
      await learningLoopQueries.updateConcepts(loop.id, extracted.concepts, extracted.conceptMap)
      await syncLoopConcepts(loop.id)
      concepts = extracted.concepts.map(c => c.concept)
    }

    // Assess prior knowledge
    const analysis = await assessPriorKnowledge(
      loop.sourceText,
      concepts,
      transcript
    )

    // Calculate score from confidence
    const score = analysis.confidenceScore

    // Update loop with prior knowledge
    const updatedLoop = await priorKnowledgeQueries.update(
      loopId,
      transcript,
      analysis,
      score
    )

    res.json({
      analysis,
      nextPhase: 'first_attempt' as LoopPhase,
      loop: updatedLoop
    })
  } catch (error) {
    console.error('Prior knowledge error:', error)
    res.status(500).json({ error: 'Failed to assess prior knowledge' })
  }
})

// POST /api/loops/:id/skip-prior-knowledge - Skip prior knowledge phase
router.post('/:id/skip-prior-knowledge', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const loopId = req.params.id as string

    // Get the loop
    const loop = await learningLoopQueries.findById(loopId)
    if (!loop) {
      res.status(404).json({ error: 'Loop not found' })
      return
    }
    if (loop.userId !== req.userId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Skip prior knowledge and move to first_attempt
    const updatedLoop = await priorKnowledgeQueries.skip(loopId)

    res.json({
      nextPhase: 'first_attempt' as LoopPhase,
      loop: updatedLoop
    })
  } catch (error) {
    console.error('Skip prior knowledge error:', error)
    res.status(500).json({ error: 'Failed to skip prior knowledge' })
  }
})

export default router
