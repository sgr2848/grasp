import OpenAI from 'openai'
import type { KeyConcept, SocraticMessage, SocraticResponse } from '../types/index.js'

// Maximum number of messages to include in context (keeps token usage bounded)
const MAX_HISTORY_MESSAGES = 6

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

export async function generateSocraticQuestion(
  sourceText: string,
  missedConcepts: string[],
  addressedConcepts: string[],
  stage: 'start' | 'continue' | 'probe'
): Promise<string> {
  const remainingConcepts = missedConcepts.filter(c => !addressedConcepts.includes(c))

  if (remainingConcepts.length === 0) {
    return "Great work! You've addressed all the gaps. Ready to explain again?"
  }

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are a Socratic tutor helping someone understand material they've been studying.

SOURCE MATERIAL:
"""
${sourceText.substring(0, 3000)}${sourceText.length > 3000 ? '...' : ''}
"""

CONCEPTS THEY MISSED:
${remainingConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CONCEPTS ALREADY ADDRESSED:
${addressedConcepts.length > 0 ? addressedConcepts.join(', ') : 'None yet'}

STAGE: ${stage}

Your job is to ask ONE question that helps them discover the missing understanding themselves.

Rules:
- Don't lecture or explain. Ask questions.
- Don't give away the answer. Guide them to it.
- Be warm but intellectually rigorous.
- If they're close, acknowledge it and push deeper.
- Focus on the FIRST remaining concept.
- Keep questions concise (1-2 sentences max).

${stage === 'start'
  ? "This is the first question. Be welcoming but get right to it."
  : stage === 'probe'
    ? "They gave a partial answer. Probe deeper on the same concept."
    : "Continue the dialogue naturally."
}

Generate ONLY the question, nothing else.`
      }
    ],
    max_completion_tokens: 150,
    temperature: 0.7
  })

  return response.choices[0].message.content || "What do you think the main idea here is?"
}

export async function generateSocraticResponse(
  sourceText: string,
  keyConcepts: KeyConcept[],
  targetConcepts: string[],
  addressedConcepts: string[],
  conversationHistory: SocraticMessage[],
  userMessage: string
): Promise<SocraticResponse> {
  const remainingConcepts = targetConcepts.filter(c => !addressedConcepts.includes(c))

  if (remainingConcepts.length === 0) {
    return {
      message: "Excellent! You've demonstrated understanding of all the concepts we were working on. You're ready for another attempt at explaining the full material!",
      addressedConcept: null
    }
  }

  // Create a numbered list of remaining concepts for the LLM to select from
  const conceptsList = remainingConcepts.map((c, i) => `${i + 1}. "${c}"`).join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are a Socratic tutor in an ongoing dialogue.

SOURCE MATERIAL:
"""
${sourceText.substring(0, 2000)}${sourceText.length > 2000 ? '...' : ''}
"""

KEY CONCEPTS FROM SOURCE:
${keyConcepts.map(c => `- ${c.concept}: ${c.explanation}`).join('\n')}

CONCEPTS WE'RE WORKING ON (numbered):
${conceptsList}

CONVERSATION SO FAR:
${conversationHistory.length > MAX_HISTORY_MESSAGES
  ? `[Earlier: ${conversationHistory.length - MAX_HISTORY_MESSAGES} messages exchanged]\n` +
    conversationHistory.slice(-MAX_HISTORY_MESSAGES).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
  : conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

USER'S LATEST RESPONSE:
"${userMessage}"

Analyze their response and:
1. Determine if they've demonstrated understanding of ANY of the remaining concepts
2. If yes, acknowledge briefly and move to next concept with a new question
3. If partially, acknowledge what's right and probe deeper with a follow-up question
4. If no, gently redirect with a simpler question or hint

Rules:
- Never lecture. Always respond with a question (after brief acknowledgment if needed).
- Be encouraging but don't accept vague or incorrect answers.
- Keep responses under 3 sentences.

IMPORTANT: If a concept is addressed, you MUST return the addressedConceptIndex as the number (1, 2, 3, etc.) from the list above.

Respond in JSON format:
{
  "message": "Your response (acknowledgment + question)",
  "addressed": true/false,
  "addressedConceptIndex": number or null (the index from the numbered list if addressed, null otherwise)
}`
      }
    ],
    max_completion_tokens: 300,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0].message.content
  if (!content) {
    return {
      message: "Tell me more about that.",
      addressedConcept: null
    }
  }

  try {
    const parsed = JSON.parse(content) as {
      message: string
      addressed: boolean
      addressedConceptIndex: number | null
    }

    // Map the index back to the actual concept string
    let addressedConcept: string | null = null
    if (parsed.addressed && parsed.addressedConceptIndex !== null) {
      const idx = parsed.addressedConceptIndex - 1 // Convert 1-indexed to 0-indexed
      if (idx >= 0 && idx < remainingConcepts.length) {
        addressedConcept = remainingConcepts[idx]
      }
    }

    return {
      message: parsed.message || "Tell me more about that.",
      addressedConcept
    }
  } catch {
    return {
      message: "Interesting. Can you elaborate on that?",
      addressedConcept: null
    }
  }
}
