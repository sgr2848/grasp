import OpenAI from 'openai'
import type { KeyConcept, SocraticMessage, SocraticResponse } from '../types/index.js'

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
    model: 'gpt-4o',
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
    max_tokens: 150,
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

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
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

CONCEPTS WE'RE WORKING ON:
${remainingConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CONVERSATION SO FAR:
${conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

USER'S LATEST RESPONSE:
"${userMessage}"

Analyze their response and:
1. Determine if they've demonstrated understanding of the FIRST remaining concept
2. If yes, acknowledge briefly and move to next concept with a new question
3. If partially, acknowledge what's right and probe deeper with a follow-up question
4. If no, gently redirect with a simpler question or hint

Rules:
- Never lecture. Always respond with a question (after brief acknowledgment if needed).
- Be encouraging but don't accept vague or incorrect answers.
- Keep responses under 3 sentences.

Respond in JSON format:
{
  "message": "Your response (acknowledgment + question)",
  "addressed": true/false,
  "currentConcept": "The concept you evaluated"
}`
      }
    ],
    max_tokens: 300,
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
      currentConcept: string
    }
    return {
      message: parsed.message || "Tell me more about that.",
      addressedConcept: parsed.addressed ? parsed.currentConcept : null
    }
  } catch {
    return {
      message: "Interesting. Can you elaborate on that?",
      addressedConcept: null
    }
  }
}
