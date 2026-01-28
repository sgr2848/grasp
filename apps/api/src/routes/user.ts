import { Router } from 'express'
import { userQueries, workspaceQueries, subjectQueries } from '../db/queries.js'
import { authMiddleware } from '../middleware/auth.js'
import { personaConfig, freePersonas } from '../services/personas.js'
import { getUserUsageStats } from '../services/featureGuard.js'
import type { AuthRequest, Persona, UsageStats } from '../types/index.js'
import { FREE_TIER_DAILY_LIMIT } from '../types/index.js'

const router = Router()

// GET /api/user/preferences
router.get('/preferences', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // upsert ensures user exists and creates default workspace for new users
    const user = await userQueries.upsert(req.userId!)

    res.json({
      selectedPersona: user.selectedPersona,
      ttsEnabled: user.ttsEnabled,
      isPaid: user.isPaid
    })
  } catch (error) {
    console.error('Preferences fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

// PATCH /api/user/preferences
router.patch('/preferences', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { selectedPersona, ttsEnabled } = req.body as {
      selectedPersona?: Persona
      ttsEnabled?: boolean
    }

    // Validate persona if provided
    if (selectedPersona) {
      const config = personaConfig[selectedPersona]
      if (!config) {
        res.status(400).json({ error: 'Invalid persona' })
        return
      }

      // Check if user has access to paid persona
      const user = await userQueries.findById(req.userId!)
      if (config.isPaid && !user?.isPaid) {
        res.status(403).json({ error: 'Upgrade required for this persona' })
        return
      }
    }

    // Ensure user exists
    await userQueries.upsert(req.userId!)

    const user = await userQueries.updatePreferences(req.userId!, {
      selectedPersona,
      ttsEnabled
    })

    res.json({
      selectedPersona: user?.selectedPersona,
      ttsEnabled: user?.ttsEnabled,
      isPaid: user?.isPaid
    })
  } catch (error) {
    console.error('Preferences update error:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// GET /api/user/personas - Get available personas
router.get('/personas', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await userQueries.findById(req.userId!)

    const personas = Object.entries(personaConfig).map(([key, config]) => ({
      id: key,
      name: config.name,
      description: config.description,
      isPaid: config.isPaid,
      isAvailable: !config.isPaid || user?.isPaid
    }))

    res.json(personas)
  } catch (error) {
    console.error('Personas fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch personas' })
  }
})

// GET /api/user/subjects - Get all subjects across all workspaces for user
router.get('/subjects', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const workspaces = await workspaceQueries.findByUserId(req.userId!)

    const subjectsWithWorkspace = []
    for (const workspace of workspaces) {
      const subjects = await subjectQueries.findByWorkspaceId(workspace.id)
      for (const subject of subjects) {
        subjectsWithWorkspace.push({
          id: subject.id,
          name: subject.name,
          description: subject.description,
          workspaceId: workspace.id,
          workspaceName: workspace.name
        })
      }
    }

    res.json(subjectsWithWorkspace)
  } catch (error) {
    console.error('Subjects fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch subjects' })
  }
})

// GET /api/user/usage - Get current usage stats
router.get('/usage', authMiddleware, async (req: AuthRequest, res) => {
  try {
    let user = await userQueries.getWithUsage(req.userId!)

    if (!user) {
      // upsert ensures user exists and creates default workspace for new users
      user = await userQueries.upsert(req.userId!)
    }

    const dailyLimit = user.isPaid ? Infinity : FREE_TIER_DAILY_LIMIT
    const remainingLoops = user.isPaid ? Infinity : Math.max(0, dailyLimit - user.loopsUsedToday)

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
      dailyLimit,
      remainingLoops,
      isPaid: user.isPaid,
      resetAt: tomorrow.toISOString()
    }

    res.json(usage)
  } catch (error) {
    console.error('Usage fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch usage stats' })
  }
})

// GET /api/user/usage-v2 - Get comprehensive usage stats with tier limits
router.get('/usage-v2', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Ensure user exists
    await userQueries.upsert(req.userId!)

    const stats = await getUserUsageStats(req.userId!)
    res.json(stats)
  } catch (error) {
    console.error('Usage-v2 fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch usage stats' })
  }
})

export default router
