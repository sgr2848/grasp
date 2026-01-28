import OpenAI from 'openai'
import type { Persona, Analysis } from '../types/index.js'
import { personaConfig } from './personas.js'

// Maximum number of messages to include in context (keeps token usage bounded)
const MAX_HISTORY_MESSAGES = 6
// Maximum characters of source text to include
const MAX_SOURCE_TEXT_CHARS = 2000

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  followUpQuestion: string | null
  remainingMissedPoints: string[]
}

export async function chat(
  sourceText: string,
  analysis: Analysis,
  messages: ChatMessage[],
  persona: Persona
): Promise<ChatResponse> {
  const config = personaConfig[persona]

  // Track which missed points have been addressed in conversation
  const conversationContext = messages.map(m => m.content).join(' ').toLowerCase()
  const remainingMissedPoints = analysis.missed_points.filter(point => {
    const pointKeywords = point.toLowerCase().split(' ').filter(w => w.length > 4)
    const mentionedCount = pointKeywords.filter(kw => conversationContext.includes(kw)).length
    return mentionedCount < pointKeywords.length * 0.5
  })

  const systemPrompt = `${config.promptPrefix}

You are having a follow-up conversation with a learner who just explained a text.

Original text they were explaining:
"""
${sourceText.substring(0, MAX_SOURCE_TEXT_CHARS)}${sourceText.length > MAX_SOURCE_TEXT_CHARS ? '...' : ''}
"""

Their initial score: ${Math.round((analysis.coverage * 0.6 + analysis.accuracy * 0.4) * 100)}%

Points they covered correctly:
${analysis.covered_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Points they missed:
${analysis.missed_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Points still not addressed in our conversation:
${remainingMissedPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Your job is to:
1. Respond naturally to their message in your persona's voice
2. Guide them toward understanding the missed points through conversation
3. Ask follow-up questions that help them think about what they missed
4. If they explain a missed point correctly, acknowledge it
5. Keep responses concise (2-4 sentences max)

Return ONLY valid JSON:
{
  "reply": "Your conversational response",
  "followUpQuestion": "A question about a missed point, or null if all points covered",
  "remainingMissedPoints": ["List of points still not addressed"]
}`

  // Apply sliding window to conversation history
  const recentMessages = messages.length > MAX_HISTORY_MESSAGES
    ? messages.slice(-MAX_HISTORY_MESSAGES)
    : messages

  // If we trimmed messages, prepend a summary note
  const historyPrefix = messages.length > MAX_HISTORY_MESSAGES
    ? [{ role: 'system' as const, content: `[Conversation context: ${messages.length - MAX_HISTORY_MESSAGES} earlier messages omitted]` }]
    : []

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyPrefix,
      ...recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ],
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from GPT')
  }

  return JSON.parse(content) as ChatResponse
}

export async function generateFollowUpQuestion(
  analysis: Analysis,
  persona: Persona
): Promise<string> {
  const config = personaConfig[persona]

  if (analysis.missed_points.length === 0) {
    return config.promptPrefix.includes('hype')
      ? "You got everything! Want to try another text?"
      : "You covered all the key points. Ready for another challenge?"
  }

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `${config.promptPrefix}

Generate a single follow-up question to help the learner think about this missed point:
"${analysis.missed_points[0]}"

The question should:
- Not directly reveal the answer
- Prompt them to think about what they missed
- Match your persona's speaking style
- Be concise (1-2 sentences)

Return ONLY the question text, nothing else.`
      }
    ]
  })

  return response.choices[0].message.content || "Can you tell me more about what you remember?"
}
