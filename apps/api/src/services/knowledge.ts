import type { ConceptMap, KeyConcept, LoopAttempt, LoopPhase, RelationshipType, ConceptImportance } from '../types/index.js'
import {
  conceptQueries,
  conceptRelationshipQueries,
  learningLoopQueries,
  loopAttemptQueries,
  loopConceptQueries,
  socraticSessionQueries,
  userConceptQueries
} from '../db/queries.js'

function normalizeConceptName(name: string): string {
  return name.toLowerCase().trim()
}

function getAttemptPhase(attempt: LoopAttempt | null): LoopPhase | null {
  if (!attempt) return null
  if (attempt.attemptType === 'simplify_challenge') return 'simplify'
  if (attempt.attemptType === 'quick_review') return null
  if (attempt.attemptType === 'full_explanation') {
    return attempt.attemptNumber >= 2 ? 'second_attempt' : 'first_attempt'
  }
  return null
}

function getImportanceWeight(importance: ConceptImportance): number {
  switch (importance) {
    case 'core':
      return 1.15
    case 'detail':
      return 0.85
    default:
      return 1.0
  }
}

function getPhaseWeight(phase: LoopPhase | null): number {
  switch (phase) {
    case 'simplify':
      return 1.1
    case 'second_attempt':
      return 1.0
    case 'learning':
      return 0.9
    case 'first_attempt':
      return 0.85
    default:
      return 1.0
  }
}

function computeMasteryScore(
  timesEncountered: number,
  timesDemonstrated: number,
  importance: ConceptImportance,
  demonstratedPhase: LoopPhase | null
): number {
  if (timesEncountered <= 0) return 0
  const baseScore = (timesDemonstrated / timesEncountered) * 100
  const weightedScore = demonstratedPhase
    ? baseScore * getImportanceWeight(importance) * getPhaseWeight(demonstratedPhase)
    : baseScore
  return Math.min(100, Math.round(weightedScore))
}

async function ensureLoopConcepts(
  loopId: string,
  keyConcepts: KeyConcept[],
  conceptMap: ConceptMap | null
): Promise<Map<string, string>> {
  const conceptIdByName = new Map<string, string>()

  for (const concept of keyConcepts) {
    const created = await conceptQueries.create({
      name: concept.concept,
      description: concept.explanation
    })
    const normalized = normalizeConceptName(concept.concept)
    conceptIdByName.set(normalized, created.id)

    await loopConceptQueries.link(loopId, created.id, concept.importance, concept.explanation)
  }

  if (conceptMap?.relationships?.length) {
    for (const rel of conceptMap.relationships) {
      const fromId = conceptIdByName.get(normalizeConceptName(rel.from))
      const toId = conceptIdByName.get(normalizeConceptName(rel.to))
      if (fromId && toId) {
        await conceptRelationshipQueries.ensure(fromId, toId, rel.type as RelationshipType, 1.0)
      }
    }
  }

  return conceptIdByName
}

export async function syncLoopConcepts(loopId: string): Promise<Map<string, string>> {
  const loop = await learningLoopQueries.findById(loopId)
  if (!loop || !loop.keyConcepts || loop.keyConcepts.length === 0) {
    return new Map()
  }

  return ensureLoopConcepts(loop.id, loop.keyConcepts, loop.conceptMap)
}

export async function updateKnowledgeOnCompletion(loopId: string): Promise<void> {
  const loop = await learningLoopQueries.findById(loopId)
  if (!loop || !loop.keyConcepts || loop.keyConcepts.length === 0) return

  const conceptIdByName = await ensureLoopConcepts(loop.id, loop.keyConcepts, loop.conceptMap)

  const latestAttempt = await loopAttemptQueries.findLatest(loopId)
  const attemptPhase = getAttemptPhase(latestAttempt)
  const demonstratedPhaseByConcept = new Map<string, LoopPhase>()

  for (const concept of latestAttempt?.analysis?.covered_points || []) {
    const normalized = normalizeConceptName(concept)
    if (attemptPhase) {
      demonstratedPhaseByConcept.set(normalized, attemptPhase)
    }
  }

  const latestSession = await socraticSessionQueries.findLatestByLoopId(loopId)
  for (const concept of latestSession?.conceptsAddressed || []) {
    const normalized = normalizeConceptName(concept)
    if (!demonstratedPhaseByConcept.has(normalized)) {
      demonstratedPhaseByConcept.set(normalized, 'learning')
    }
  }

  for (const concept of loop.keyConcepts) {
    const normalized = normalizeConceptName(concept.concept)
    const conceptId = conceptIdByName.get(normalized)
    if (!conceptId) continue

    const demonstratedPhase = demonstratedPhaseByConcept.get(normalized) || null
    const demonstrated = demonstratedPhase !== null
    const existing = await userConceptQueries.findByUserAndConcept(loop.userId, conceptId)
    const timesEncountered = (existing?.timesEncountered ?? 0) + 1
    const timesDemonstrated = (existing?.timesDemonstrated ?? 0) + (demonstrated ? 1 : 0)
    const masteryScore = computeMasteryScore(
      timesEncountered,
      timesDemonstrated,
      concept.importance,
      demonstratedPhase
    )

    await userConceptQueries.upsertProgress(loop.userId, conceptId, {
      masteryScore,
      timesEncountered,
      timesDemonstrated,
      demonstrated
    })

    if (demonstratedPhase) {
      await loopConceptQueries.markDemonstrated(loopId, conceptId, demonstratedPhase)
    }
  }

  if (loop.conceptMap?.relationships?.length) {
    for (const rel of loop.conceptMap.relationships) {
      const fromNormalized = normalizeConceptName(rel.from)
      const toNormalized = normalizeConceptName(rel.to)
      const fromId = conceptIdByName.get(fromNormalized)
      const toId = conceptIdByName.get(toNormalized)
      if (!fromId || !toId) continue

      const fromDemonstrated = demonstratedPhaseByConcept.has(fromNormalized)
      const toDemonstrated = demonstratedPhaseByConcept.has(toNormalized)
      if (fromDemonstrated && toDemonstrated) {
        await conceptRelationshipQueries.incrementStrength(fromId, toId, rel.type as RelationshipType, 1.0)
      }
    }
  }
}
