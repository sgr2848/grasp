import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest, KnowledgeGraphResponse, KnowledgeGraphNode, KnowledgeGraphEdge } from '../types/index.js'
import {
  conceptQueries,
  userConceptQueries,
  conceptRelationshipQueries,
  loopConceptQueries,
  learningLoopQueries
} from '../db/queries.js'

const router = Router()

function getRecencyFactor(lastSeenAt: Date | null): number {
  if (!lastSeenAt) return 0.25
  const daysSince = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince < 7) return 1.0
  if (daysSince < 14) return 0.9
  if (daysSince < 30) return 0.75
  if (daysSince < 60) return 0.5
  return 0.25
}

function getDecayedMastery(masteryScore: number, lastSeenAt: Date | null): number {
  return Math.round(masteryScore * getRecencyFactor(lastSeenAt))
}

function buildStats(nodes: KnowledgeGraphNode[]) {
  const totalConcepts = nodes.length
  if (totalConcepts === 0) {
    return { totalConcepts: 0, averageMastery: 0, masteredCount: 0, learningCount: 0, newCount: 0 }
  }

  const totalMastery = nodes.reduce((sum, node) => sum + node.mastery, 0)
  const averageMastery = totalMastery / totalConcepts
  const masteredCount = nodes.filter((n) => n.mastery >= 80).length
  const learningCount = nodes.filter((n) => n.mastery >= 40 && n.mastery < 80).length
  const newCount = nodes.filter((n) => n.mastery < 40).length

  return {
    totalConcepts,
    averageMastery,
    masteredCount,
    learningCount,
    newCount
  }
}

// GET /api/knowledge/graph - Get user's full knowledge graph for visualization
router.get('/graph', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Get all user concepts with their mastery (joined with concept details)
    const userConcepts = await userConceptQueries.findByUserIdWithConcepts(req.userId!)

    const nodes: KnowledgeGraphNode[] = userConcepts.map((uc) => ({
      id: uc.conceptId,
      name: uc.conceptName,
      mastery: getDecayedMastery(uc.masteryScore, uc.lastSeenAt),
      category: uc.conceptCategory,
      timesEncountered: uc.timesEncountered,
      lastSeen: uc.lastSeenAt?.toISOString() || null
    }))

    // Get relationships between concepts the user knows
    const relationships = await conceptRelationshipQueries.findForUserGraph(req.userId!)
    const edges: KnowledgeGraphEdge[] = relationships.map(rel => ({
      source: rel.fromConceptId,
      target: rel.toConceptId,
      type: rel.relationshipType,
      strength: Number(rel.strength)
    }))

    const stats = buildStats(nodes)

    const response: KnowledgeGraphResponse = {
      nodes,
      edges,
      stats
    }

    res.json(response)
  } catch (error) {
    console.error('Get knowledge graph error:', error)
    res.status(500).json({ error: 'Failed to get knowledge graph' })
  }
})

// GET /api/knowledge/concepts - List user's concepts with mastery scores
router.get('/concepts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userConcepts = await userConceptQueries.findByUserIdWithConcepts(req.userId!)

    const enrichedConcepts = userConcepts.map((uc) => ({
      ...uc,
      masteryScore: getDecayedMastery(uc.masteryScore, uc.lastSeenAt),
      concept: {
        id: uc.conceptId,
        name: uc.conceptName,
        description: uc.conceptDescription,
        category: uc.conceptCategory
      }
    }))

    res.json(enrichedConcepts)
  } catch (error) {
    console.error('Get concepts error:', error)
    res.status(500).json({ error: 'Failed to get concepts' })
  }
})

// GET /api/knowledge/concepts/:id - Get single concept with related concepts
router.get('/concepts/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const conceptId = req.params.id as string

    const concept = await conceptQueries.findById(conceptId)
    if (!concept) {
      res.status(404).json({ error: 'Concept not found' })
      return
    }

    // Get user's mastery of this concept
    const userConcept = await userConceptQueries.findByUserAndConcept(req.userId!, conceptId)

    // Get related concepts
    const relationships = await conceptRelationshipQueries.findRelatedForUser(conceptId, req.userId!)

    const relatedConcepts = relationships.map((rel) => ({
      concept: {
        id: rel.conceptId,
        name: rel.conceptName,
        description: rel.conceptDescription,
        category: rel.conceptCategory
      },
      relationship: {
        type: rel.relationshipType,
        strength: Number(rel.strength),
        direction: rel.direction
      },
      mastery: rel.masteryScore ? getDecayedMastery(rel.masteryScore, rel.lastSeenAt) : 0
    }))

    res.json({
      concept,
      mastery: userConcept ? getDecayedMastery(userConcept.masteryScore, userConcept.lastSeenAt) : 0,
      timesEncountered: userConcept?.timesEncountered || 0,
      timesDemonstrated: userConcept?.timesDemonstrated || 0,
      lastSeen: userConcept?.lastSeenAt?.toISOString() || null,
      relatedConcepts
    })
  } catch (error) {
    console.error('Get concept error:', error)
    res.status(500).json({ error: 'Failed to get concept' })
  }
})

// GET /api/knowledge/stats - Get aggregate mastery statistics
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await userConceptQueries.getStats(req.userId!)
    res.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: 'Failed to get stats' })
  }
})

// GET /api/knowledge/insights - Get actionable knowledge insights
router.get('/insights', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Get all insight data in parallel
    const [needsReview, recentProgress, weakSpots, crossConnections, stats] = await Promise.all([
      userConceptQueries.getNeedsReviewWithConcepts(req.userId!, 5),
      userConceptQueries.getRecentProgressWithConcepts(req.userId!, 8),
      userConceptQueries.getWeakSpotsWithConcepts(req.userId!, 5),
      loopConceptQueries.getCrossConnections(req.userId!, 5),
      userConceptQueries.getStats(req.userId!)
    ])

    const enrichConcept = (uc: any) => ({
      id: uc.conceptId,
      name: uc.conceptName,
      mastery: getDecayedMastery(uc.masteryScore, uc.lastSeenAt),
      timesEncountered: uc.timesEncountered,
      lastSeen: uc.lastSeenAt?.toISOString() || null,
      daysSinceLastSeen: uc.lastSeenAt
        ? Math.floor((Date.now() - new Date(uc.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24))
        : null
    })

    const enrichedNeedsReview = needsReview.map(enrichConcept)
    const enrichedRecentProgress = recentProgress.map(enrichConcept)
    const enrichedWeakSpots = weakSpots.map(enrichConcept)

    // Enrich cross-connections with concept names and loop titles
    const conceptIds = crossConnections.map(cc => cc.conceptId)
    const loopIds = Array.from(new Set(crossConnections.flatMap(cc => cc.loopIds.slice(0, 3))))

    const [concepts, loops] = await Promise.all([
      conceptQueries.findByIds(conceptIds),
      learningLoopQueries.findTitlesByIds(loopIds)
    ])

    const conceptMap = new Map(concepts.map((c) => [c.id, c]))
    const loopMap = new Map(loops.map((l) => [l.id, l.title]))

    const enrichedCrossConnections = crossConnections.map((cc) => ({
      id: cc.conceptId,
      name: conceptMap.get(cc.conceptId)?.name || 'Unknown',
      loopCount: cc.loopCount,
      loops: cc.loopIds.slice(0, 3).map((loopId) => ({
        id: loopId,
        title: loopMap.get(loopId) || 'Untitled'
      }))
    }))

    res.json({
      needsReview: enrichedNeedsReview,
      recentProgress: enrichedRecentProgress,
      weakSpots: enrichedWeakSpots,
      crossConnections: enrichedCrossConnections,
      stats
    })
  } catch (error) {
    console.error('Get insights error:', error)
    res.status(500).json({ error: 'Failed to get insights' })
  }
})

export default router
