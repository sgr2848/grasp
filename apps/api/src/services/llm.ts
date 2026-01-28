import OpenAI from 'openai'
import type { Persona, Analysis, KeyConcept, ConceptMap, AttemptType, Precision, PriorKnowledgeAnalysis } from '../types/index.js'
import { personaConfig } from './personas.js'

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

interface KeyPointsResponse {
  key_points: string[]
}

interface EvaluationResponse {
  covered_points: string[]
  missed_points: string[]
  coverage: number
  accuracy: number
  feedback: string
  tts_script: {
    intro: string
    score_announcement: string
    covered_summary: string
    missed_summary: string
    closing: string
  }
}

export async function extractKeyPoints(sourceText: string): Promise<string[]> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are analyzing a piece of text to extract its key points for testing comprehension.

Extract 5-10 key points that someone should remember after reading this. Each point must be:
- Self-contained (understandable without the source)
- Factually specific (not vague)
- Max 20 words

Return ONLY valid JSON:
{
  "key_points": ["point 1", "point 2", ...]
}`
      },
      {
        role: 'user',
        content: `Source text:\n"""\n${sourceText}\n"""`
      }
    ],
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from GPT')
  }

  const parsed = JSON.parse(content) as KeyPointsResponse
  return parsed.key_points
}

export async function evaluateExplanation(
  keyPoints: string[],
  transcript: string,
  persona: Persona
): Promise<{ analysis: EvaluationResponse; score: number }> {
  const config = personaConfig[persona]

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `${config.promptPrefix}

You are evaluating a learner's spoken explanation of a text.

Key points they should have covered:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Evaluate how well the learner's explanation covers the key points.

For each key point, determine if it was:
- Covered correctly
- Covered but inaccurate
- Not mentioned

Calculate:
- coverage: (points mentioned / total points) as decimal 0-1
- accuracy: (correctly covered / total covered) as decimal 0-1

Also generate a TTS script for delivering results conversationally. The script should match your persona voice and feel natural when spoken aloud. Use {score} as a placeholder for the actual score.

Return ONLY valid JSON:
{
  "covered_points": ["points that were mentioned correctly"],
  "missed_points": ["points that were not mentioned"],
  "coverage": 0.0,
  "accuracy": 0.0,
  "feedback": "2-3 sentence written feedback summary",
  "tts_script": {
    "intro": "Short reaction to seeing the results (1 sentence)",
    "score_announcement": "Announce the score with reaction, use {score} placeholder (1 sentence)",
    "covered_summary": "What they got right (1-2 sentences)",
    "missed_summary": "What they missed (1-2 sentences)",
    "closing": "Encourage retry or moving on (1 sentence)"
  }
}`
      },
      {
        role: 'user',
        content: `Learner's spoken explanation:\n"""\n${transcript}\n"""`
      }
    ],
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from GPT')
  }

  const analysis = JSON.parse(content) as EvaluationResponse

  // Calculate score: 60% coverage + 40% accuracy
  const score = Math.round((analysis.coverage * 0.6 + analysis.accuracy * 0.4) * 100)

  return { analysis, score }
}

export async function analyzeText(
  sourceText: string,
  transcript: string,
  persona: Persona
): Promise<Analysis & { score: number }> {
  // Step 1: Extract key points
  const keyPoints = await extractKeyPoints(sourceText)

  // Step 2: Evaluate explanation with persona
  const { analysis, score } = await evaluateExplanation(keyPoints, transcript, persona)

  return {
    key_points: keyPoints,
    covered_points: analysis.covered_points,
    missed_points: analysis.missed_points,
    coverage: analysis.coverage,
    accuracy: analysis.accuracy,
    feedback: analysis.feedback,
    tts_script: analysis.tts_script,
    score
  }
}

// ============================================
// V2: Concept Extraction and Enhanced Evaluation
// ============================================

interface ConceptsResponse {
  concepts: KeyConcept[]
  conceptMap: ConceptMap
}

export async function extractConcepts(sourceText: string, precision: Precision = 'balanced', retries = 2): Promise<{ concepts: KeyConcept[]; conceptMap: ConceptMap }> {
  const precisionInstructions = {
    essential: `
PRECISION MODE: ESSENTIAL
Focus ONLY on the core underlying concepts and big ideas.
- Skip specific dates, numbers, names, and minor details
- Extract 3-6 high-level concepts that capture the essence
- Each concept should be a fundamental idea, not a specific fact
- Prioritize "why" and "how" over "what" and "when"`,
    balanced: `
PRECISION MODE: BALANCED
Extract a mix of core concepts and supporting details.
- Include the main ideas and some important specifics
- Extract 5-10 concepts`,
    precise: `
PRECISION MODE: PRECISE
Every detail matters - be thorough and specific.
- Include specific dates, numbers, names, and terminology
- Extract 8-12 concepts covering both big ideas and key details
- Accuracy of specific facts will be tested`
  }

  // Truncate very long text to avoid token limits
  const truncatedText = sourceText.length > 8000 ? sourceText.slice(0, 8000) + '...' : sourceText

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[extractConcepts] Retry attempt ${attempt}/${retries}...`)
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }

      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `Analyze this text and extract the key concepts someone should understand.
${precisionInstructions[precision]}

For each concept:
- concept: A clear, concise name (3-7 words)
- explanation: What this concept means in context (1-2 sentences)
- importance: "core" (central to understanding), "supporting" (important context), or "detail" (nice to know)

Also identify relationships between concepts.

Return ONLY valid JSON:
{
  "concepts": [
    {"concept": "...", "explanation": "...", "importance": "core|supporting|detail"}
  ],
  "conceptMap": {
    "relationships": [
      {"from": "concept1", "to": "concept2", "type": "causes|enables|exemplifies|contrasts"}
    ]
  }
}`
          },
          {
            role: 'user',
            content: `Text to analyze:\n"""\n${truncatedText}\n"""`
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1500,
        temperature: 0.3
      })

      const content = response.choices[0].message.content
      if (!content) {
        console.warn('[extractConcepts] Empty response from OpenAI')
        continue // Try again
      }

      try {
        const parsed = JSON.parse(content) as ConceptsResponse
        const concepts = parsed.concepts || []
        const conceptMap = parsed.conceptMap || { relationships: [] }

        if (concepts.length === 0) {
          console.warn('[extractConcepts] OpenAI returned empty concepts array')
          continue // Try again
        }

        console.log(`[extractConcepts] Successfully extracted ${concepts.length} concepts`)
        return { concepts, conceptMap }
      } catch (parseError) {
        console.error('[extractConcepts] Failed to parse JSON response:', parseError)
        lastError = parseError instanceof Error ? parseError : new Error(String(parseError))
        continue // Try again
      }
    } catch (apiError) {
      console.error(`[extractConcepts] OpenAI API error (attempt ${attempt + 1}):`, apiError)
      lastError = apiError instanceof Error ? apiError : new Error(String(apiError))
      // Continue to retry
    }
  }

  // All retries exhausted - return empty result rather than throwing
  console.error('[extractConcepts] All retries exhausted, returning empty result. Last error:', lastError)
  return { concepts: [], conceptMap: { relationships: [] } }
}

export async function evaluateWithConcepts(
  sourceText: string,
  keyConcepts: string[],
  transcript: string,
  persona: Persona,
  attemptType: AttemptType,
  precision: Precision = 'balanced',
  priorKnowledge?: PriorKnowledgeAnalysis | null
): Promise<Analysis> {
  const config = personaConfig[persona]

  const precisionInstructions = {
    essential: `
PRECISION MODE: ESSENTIAL
Be lenient in your evaluation. Focus on whether they understood the core ideas.
- Don't penalize missing specific dates, numbers, or names
- If they got the gist of a concept, count it as covered
- Reward conceptual understanding over memorization
- Accept paraphrasing and approximations`,
    balanced: `
PRECISION MODE: BALANCED
Standard evaluation balancing concept understanding and specific details.`,
    precise: `
PRECISION MODE: PRECISE
Be strict in your evaluation. Details matter.
- Specific dates, numbers, and names must be accurate
- Terminology should be used correctly
- Partial or vague explanations don't count as covered
- Accuracy is as important as coverage`
  }

  const simplifyInstructions = attemptType === 'simplify_challenge' ? `
SPECIAL MODE: SIMPLIFY CHALLENGE
The user is trying to explain this like they're teaching a 10-year-old.
Evaluate based on:
- Did they avoid jargon?
- Did they use analogies or examples?
- Would a non-expert understand this?
- Penalize overly complex explanations even if technically accurate.
` : ''

  const quickReviewInstructions = attemptType === 'quick_review' ? `
SPECIAL MODE: QUICK REVIEW
This is a spaced repetition review. Be lenient - they just need to show the main ideas stuck.
Focus on core concepts, don't penalize missing details.
` : ''

  const priorKnowledgeContext = priorKnowledge ? `
SCORING CONTEXT:

The user already knew these concepts before reading:
${priorKnowledge.knownConcepts?.length ? priorKnowledge.knownConcepts.map(c => `- ${c}`).join('\n') : '- None'}

The user was told to focus on:
${priorKnowledge.focusAreas?.length ? priorKnowledge.focusAreas.map(c => `- ${c}`).join('\n') : '- None'}

Misconceptions to check:
${priorKnowledge.misconceptions?.length
    ? priorKnowledge.misconceptions.map(m => `- "${m.claim}" (correction: ${m.correction})`).join('\n')
    : '- None'}

Scoring guidance:
- If they don't mention known concepts, don't penalize.
- Missing focus concepts is more important than missing others.
- If they correct a misconception, acknowledge it; if they repeat it, note it and penalize.
` : ''

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `${config.promptPrefix}

You are evaluating a learner's spoken explanation.

KEY CONCEPTS THEY SHOULD COVER:
${keyConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

ORIGINAL SOURCE TEXT (for context):
"""
${sourceText.substring(0, 2000)}${sourceText.length > 2000 ? '...' : ''}
"""
${precisionInstructions[precision]}
${simplifyInstructions}${quickReviewInstructions}
${priorKnowledgeContext}

Evaluate their explanation:
1. Which concepts were covered correctly?
2. Which were missed?
3. Calculate coverage (concepts mentioned / total) and accuracy (correct / mentioned)
4. Generate feedback and TTS script in your persona's voice

Return ONLY valid JSON:
{
  "key_points": ["concept 1", "concept 2"],
  "covered_points": ["points that were mentioned correctly"],
  "missed_points": ["points that were not mentioned"],
  "coverage": 0.0,
  "accuracy": 0.0,
  "feedback": "2-3 sentence written feedback",
  "tts_script": {
    "intro": "1 sentence reaction",
    "score_announcement": "Announce score (use {score} placeholder)",
    "covered_summary": "What they nailed (1-2 sentences)",
    "missed_summary": "What they missed (1-2 sentences)",
    "closing": "Encourage next step (1 sentence)"
  }
}`
      },
      {
        role: 'user',
        content: `Learner's explanation:\n"""\n${transcript}\n"""`
      }
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 800,
    temperature: 0.5
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from GPT')
  }

  try {
    return JSON.parse(content) as Analysis
  } catch {
    return {
      key_points: keyConcepts,
      covered_points: [],
      missed_points: keyConcepts,
      coverage: 0,
      accuracy: 0,
      feedback: "I couldn't evaluate your explanation. Please try again.",
      tts_script: {
        intro: 'Hmm, something went wrong.',
        score_announcement: "I couldn't calculate a score.",
        covered_summary: '',
        missed_summary: '',
        closing: 'Want to try again?'
      }
    }
  }
}

// ============================================
// V4: Prior Knowledge Assessment
// ============================================

export async function assessPriorKnowledge(
  sourceText: string,
  targetConcepts: string[],
  priorKnowledgeTranscript: string
): Promise<PriorKnowledgeAnalysis> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are assessing a learner's prior knowledge about a topic.

The learner will explain what they already know BEFORE studying the source material.

TARGET CONCEPTS they will eventually need to understand:
${targetConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

SOURCE TEXT (for reference):
"""
${sourceText.substring(0, 1500)}${sourceText.length > 1500 ? '...' : ''}
"""

Analyze their prior knowledge:
1. Which concepts do they already understand well? (knownConcepts)
2. Which concepts do they have partial knowledge of? (partialConcepts)
3. Which concepts are completely new to them? (unknownConcepts)
4. Any misconceptions they have? (misconceptions)
5. What should they focus on while learning? (focusAreas)

Calculate a confidenceScore (0-100) based on:
- How much relevant prior knowledge they demonstrated
- 0 = no prior knowledge
- 50 = knows about half the concepts
- 100 = already understands everything

Be encouraging - any prior knowledge is a good starting point.

Return ONLY valid JSON:
{
  "knownConcepts": ["concepts they clearly understand"],
  "partialConcepts": ["concepts they partially know"],
  "unknownConcepts": ["concepts they don't know yet"],
  "misconceptions": [{"claim": "what they said", "correction": "the accurate view"}],
  "focusAreas": ["specific areas to pay attention to"],
  "confidenceScore": 0,
  "feedback": "Encouraging message about their starting point (2-3 sentences)"
}`
      },
      {
        role: 'user',
        content: `What the learner says they already know:\n"""\n${priorKnowledgeTranscript}\n"""`
      }
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 800,
    temperature: 0.4
  })

  const content = response.choices[0].message.content
  if (!content) {
    return {
      knownConcepts: [],
      partialConcepts: [],
      unknownConcepts: targetConcepts,
      misconceptions: [],
      focusAreas: targetConcepts,
      confidenceScore: 0,
      feedback: "Let's start learning! I'll help you understand all these concepts."
    }
  }

  try {
    return JSON.parse(content) as PriorKnowledgeAnalysis
  } catch {
    return {
      knownConcepts: [],
      partialConcepts: [],
      unknownConcepts: targetConcepts,
      misconceptions: [],
      focusAreas: targetConcepts,
      confidenceScore: 0,
      feedback: "Let's start learning! I'll help you understand all these concepts."
    }
  }
}
