import { Router } from 'express'
import { sessionQueries, conversationQueries } from '../db/queries.js'
import { authMiddleware } from '../middleware/auth.js'
import { chat, generateFollowUpQuestion } from '../services/chat.js'
import type { AuthRequest, ChatMessage } from '../types/index.js'

const router = Router()

// GET /api/sessions/:sessionId/chat - Get conversation for session
router.get('/:sessionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.params.sessionId as string
    const session = await sessionQueries.findById(sessionId, req.userId!)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const conversation = await conversationQueries.findBySessionId(session.id)
    res.json({
      messages: conversation?.messages || [],
      hasConversation: !!conversation
    })
  } catch (error) {
    console.error('Chat fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

// POST /api/sessions/:sessionId/chat - Send message and get response
router.post('/:sessionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.params.sessionId as string
    const session = await sessionQueries.findById(sessionId, req.userId!)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    if (!session.analysis) {
      res.status(400).json({ error: 'Session has no analysis' })
      return
    }

    const { message } = req.body as { message: string }
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    // Get or create conversation
    const conversation = await conversationQueries.getOrCreate(session.id)

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }
    await conversationQueries.addMessage(session.id, userMessage)

    // Get AI response
    const allMessages = [...conversation.messages, userMessage]
    const response = await chat(
      session.sourceText,
      session.analysis,
      allMessages.map(m => ({ role: m.role, content: m.content })),
      session.persona
    )

    // Add assistant response
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response.followUpQuestion
        ? `${response.reply}\n\n${response.followUpQuestion}`
        : response.reply,
      timestamp: new Date().toISOString()
    }
    await conversationQueries.addMessage(session.id, assistantMessage)

    res.json({
      reply: response.reply,
      followUpQuestion: response.followUpQuestion,
      remainingMissedPoints: response.remainingMissedPoints
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// POST /api/sessions/:sessionId/chat/start - Start conversation with initial follow-up
router.post('/:sessionId/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.params.sessionId as string
    const session = await sessionQueries.findById(sessionId, req.userId!)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    if (!session.analysis) {
      res.status(400).json({ error: 'Session has no analysis' })
      return
    }

    // Generate initial follow-up question
    const followUpQuestion = await generateFollowUpQuestion(session.analysis, session.persona)

    // Create conversation with initial assistant message
    await conversationQueries.getOrCreate(session.id)
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: followUpQuestion,
      timestamp: new Date().toISOString()
    }
    await conversationQueries.addMessage(session.id, assistantMessage)

    res.json({
      message: followUpQuestion,
      missedPoints: session.analysis.missed_points
    })
  } catch (error) {
    console.error('Chat start error:', error)
    res.status(500).json({ error: 'Failed to start conversation' })
  }
})

export default router
