import { sql } from '../db/client.js'
import {
  conceptQueries,
  userConceptQueries,
  loopConceptQueries,
  conceptRelationshipQueries
} from '../db/queries.js'
import { extractConcepts } from '../services/llm.js'
import type { KeyConcept, ConceptMap, Precision, ConceptImportance } from '../types/index.js'

interface LoopWithAttempts {
  id: string
  userId: string
  sourceText: string
  precision: Precision
  keyConcepts: KeyConcept[] | null
  conceptMap: ConceptMap | null
  bestScore: number
  attemptCount: number
}

async function getLoopsWithAttempts(): Promise<LoopWithAttempts[]> {
  const result = await sql`
    SELECT
      ll.id,
      ll.user_id as "userId",
      ll.source_text as "sourceText",
      ll.precision,
      ll.key_concepts as "keyConcepts",
      ll.concept_map as "conceptMap",
      COALESCE(MAX(la.score), 0) as "bestScore",
      COUNT(la.id) as "attemptCount"
    FROM learning_loops ll
    LEFT JOIN loop_attempts la ON la.loop_id = ll.id
    WHERE ll.source_text IS NOT NULL AND ll.source_text != ''
    GROUP BY ll.id
    ORDER BY ll.created_at DESC
  `
  return result as LoopWithAttempts[]
}

async function backfillKnowledgeGraph() {
  console.log('Starting knowledge graph backfill...\n')

  const loops = await getLoopsWithAttempts()
  console.log(`Found ${loops.length} learning loops to process\n`)

  let processedCount = 0
  let skippedCount = 0
  let errorCount = 0
  const userConceptsProcessed = new Map<string, Set<string>>()

  for (const loop of loops) {
    try {
      console.log(`Processing loop ${loop.id.substring(0, 8)}... (${processedCount + 1}/${loops.length})`)

      // Check if loop already has concepts linked
      const existingLinks = await loopConceptQueries.findByLoopId(loop.id)
      if (existingLinks.length > 0) {
        console.log(`  - Already has ${existingLinks.length} concepts linked, skipping extraction`)
        skippedCount++
        continue
      }

      // Get concepts - either from existing keyConcepts or extract them
      let concepts: KeyConcept[] = []
      let conceptMap: ConceptMap = { relationships: [] }

      if (loop.keyConcepts && loop.keyConcepts.length > 0) {
        console.log(`  - Using existing ${loop.keyConcepts.length} key concepts`)
        concepts = loop.keyConcepts
        conceptMap = loop.conceptMap || { relationships: [] }
      } else {
        console.log(`  - Extracting concepts from source text...`)
        const extracted = await extractConcepts(loop.sourceText, loop.precision)
        concepts = extracted.concepts
        conceptMap = extracted.conceptMap
        console.log(`  - Extracted ${concepts.length} concepts`)
      }

      if (concepts.length === 0) {
        console.log(`  - No concepts found, skipping`)
        skippedCount++
        continue
      }

      // Create/find concepts and link to loop
      const conceptIds: Map<string, string> = new Map()

      for (const kc of concepts) {
        // Create or get existing concept
        const concept = await conceptQueries.create({
          name: kc.concept,
          description: kc.explanation,
          category: undefined // Could infer from subject later
        })
        conceptIds.set(kc.concept.toLowerCase().trim(), concept.id)

        // Link to loop
        await loopConceptQueries.link(
          loop.id,
          concept.id,
          kc.importance as ConceptImportance,
          kc.explanation
        )

        // Create or update user concept
        const existingUserConcept = await userConceptQueries.findByUserAndConcept(loop.userId, concept.id)

        if (!existingUserConcept) {
          await userConceptQueries.create(loop.userId, concept.id)
        }

        // Calculate and update mastery based on loop performance
        if (loop.attemptCount > 0) {
          const demonstrated = loop.bestScore >= 70
          // Weight mastery: 0-100 based on best score, with bonus for demonstration
          let mastery = Math.min(100, Math.round(loop.bestScore * 0.8))
          if (demonstrated) {
            mastery = Math.min(100, mastery + 10)
          }

          // Get current mastery to blend with new
          const current = await userConceptQueries.findByUserAndConcept(loop.userId, concept.id)
          if (current && current.masteryScore > 0) {
            // Blend: 70% existing, 30% new
            mastery = Math.round(current.masteryScore * 0.7 + mastery * 0.3)
          }

          await userConceptQueries.updateMastery(loop.userId, concept.id, mastery, demonstrated)

          // Track processed
          if (!userConceptsProcessed.has(loop.userId)) {
            userConceptsProcessed.set(loop.userId, new Set())
          }
          userConceptsProcessed.get(loop.userId)!.add(concept.id)
        }
      }

      // Create relationships
      if (conceptMap.relationships && conceptMap.relationships.length > 0) {
        for (const rel of conceptMap.relationships) {
          const fromId = conceptIds.get(rel.from.toLowerCase().trim())
          const toId = conceptIds.get(rel.to.toLowerCase().trim())
          if (fromId && toId) {
            await conceptRelationshipQueries.upsert(fromId, toId, rel.type as any, 1.0)
          }
        }
        console.log(`  - Created ${conceptMap.relationships.length} relationships`)
      }

      processedCount++
      console.log(`  - Done! Linked ${concepts.length} concepts`)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.error(`  - Error processing loop ${loop.id}:`, error)
      errorCount++
    }
  }

  // Print summary
  console.log('\n========================================')
  console.log('Backfill Complete!')
  console.log('========================================')
  console.log(`Processed: ${processedCount}`)
  console.log(`Skipped: ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Total users with concepts: ${userConceptsProcessed.size}`)

  let totalConcepts = 0
  for (const [userId, concepts] of userConceptsProcessed) {
    totalConcepts += concepts.size
    console.log(`  User ${userId.substring(0, 8)}...: ${concepts.size} concepts`)
  }
  console.log(`Total concept-user links: ${totalConcepts}`)

  // Final stats
  const stats = await sql`
    SELECT
      (SELECT COUNT(*) FROM concepts) as concepts,
      (SELECT COUNT(*) FROM user_concepts) as user_concepts,
      (SELECT COUNT(*) FROM loop_concepts) as loop_concepts,
      (SELECT COUNT(*) FROM concept_relationships) as relationships
  `
  console.log('\nDatabase totals:')
  console.log(`  Concepts: ${stats[0].concepts}`)
  console.log(`  User-Concept links: ${stats[0].user_concepts}`)
  console.log(`  Loop-Concept links: ${stats[0].loop_concepts}`)
  console.log(`  Relationships: ${stats[0].relationships}`)
}

// Run the backfill
backfillKnowledgeGraph()
  .then(() => {
    console.log('\nBackfill finished successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
