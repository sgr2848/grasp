// Common filler words and phrases to detect
const FILLER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(um+|uhh*|uh+|er+|ah+)\b/gi, label: 'um/uh' },
  { pattern: /\b(like)\b(?!\s+(this|that|the|a|an|to|it|them|him|her|me|us|you))/gi, label: 'like' },
  { pattern: /\b(you know)\b/gi, label: 'you know' },
  { pattern: /\b(i mean)\b/gi, label: 'I mean' },
  { pattern: /\b(basically)\b/gi, label: 'basically' },
  { pattern: /\b(literally)\b/gi, label: 'literally' },
  { pattern: /\b(actually)\b/gi, label: 'actually' },
  { pattern: /\b(kind of|kinda)\b/gi, label: 'kind of' },
  { pattern: /\b(sort of|sorta)\b/gi, label: 'sort of' },
  { pattern: /\b(right)\b(?=\s*[,?.]|\s+so|\s+and|\s+but)/gi, label: 'right' },
  { pattern: /\b(okay|ok)\b(?=\s*[,.]|\s+so|\s+and)/gi, label: 'okay' },
  { pattern: /\b(so)\b(?=\s*[,.]|\s+yeah|\s+um|\s+uh)/gi, label: 'so' },
  { pattern: /\b(yeah)\b(?=\s*[,.]|\s+so|\s+and)/gi, label: 'yeah' },
]

// Words that indicate hedging/uncertainty
const HEDGE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(maybe)\b/gi, label: 'maybe' },
  { pattern: /\b(perhaps)\b/gi, label: 'perhaps' },
  { pattern: /\b(i think)\b/gi, label: 'I think' },
  { pattern: /\b(i guess)\b/gi, label: 'I guess' },
  { pattern: /\b(i suppose)\b/gi, label: 'I suppose' },
  { pattern: /\b(probably)\b/gi, label: 'probably' },
  { pattern: /\b(might be)\b/gi, label: 'might be' },
]

export interface FillerWordResult {
  word: string
  count: number
}

export interface SpeechAnalysis {
  // Filler words
  fillerWords: FillerWordResult[]
  totalFillers: number
  fillerRate: number // per 100 words

  // Hedging
  hedgeWords: FillerWordResult[]
  totalHedges: number

  // Pace
  wordCount: number
  durationSeconds: number
  wordsPerMinute: number
  paceRating: 'too slow' | 'slow' | 'good' | 'fast' | 'too fast'

  // Repetition
  repeatedPhrases: { phrase: string; count: number }[]

  // Overall score (0-100)
  clarityScore: number
}

function countPatternMatches(text: string, patterns: { pattern: RegExp; label: string }[]): FillerWordResult[] {
  const results: Map<string, number> = new Map()

  for (const { pattern, label } of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      const current = results.get(label) || 0
      results.set(label, current + matches.length)
    }
  }

  return Array.from(results.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
}

function findRepeatedPhrases(text: string, minLength = 3, minCount = 2): { phrase: string; count: number }[] {
  const words = text.toLowerCase().split(/\s+/)
  const phraseCounts: Map<string, number> = new Map()

  // Look for repeated 3-5 word phrases
  for (let phraseLen = minLength; phraseLen <= 5; phraseLen++) {
    for (let i = 0; i <= words.length - phraseLen; i++) {
      const phrase = words.slice(i, i + phraseLen).join(' ')
      // Skip phrases that are mostly filler words
      if (phrase.match(/^(um|uh|like|you know|i mean|so|and|but|the|a|an|is|was|it|this|that)\b/)) {
        continue
      }
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }
  }

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= minCount)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // Top 5 repeated phrases
}

function getPaceRating(wpm: number): SpeechAnalysis['paceRating'] {
  if (wpm < 100) return 'too slow'
  if (wpm < 120) return 'slow'
  if (wpm <= 160) return 'good'
  if (wpm <= 180) return 'fast'
  return 'too fast'
}

function calculateClarityScore(
  fillerRate: number,
  hedgeCount: number,
  wordCount: number,
  paceRating: SpeechAnalysis['paceRating']
): number {
  let score = 100

  // Penalize for filler words (up to -30 points)
  // Ideal: < 1 per 100 words, Bad: > 5 per 100 words
  score -= Math.min(30, fillerRate * 6)

  // Penalize for hedging (up to -20 points)
  const hedgeRate = (hedgeCount / wordCount) * 100
  score -= Math.min(20, hedgeRate * 10)

  // Penalize for pace issues (up to -15 points)
  if (paceRating === 'too slow' || paceRating === 'too fast') {
    score -= 15
  } else if (paceRating === 'slow' || paceRating === 'fast') {
    score -= 5
  }

  return Math.max(0, Math.round(score))
}

export function analyzeSpeech(transcript: string, durationSeconds: number): SpeechAnalysis {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length
  const wordsPerMinute = durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0

  const fillerWords = countPatternMatches(transcript, FILLER_PATTERNS)
  const totalFillers = fillerWords.reduce((sum, f) => sum + f.count, 0)
  const fillerRate = wordCount > 0 ? (totalFillers / wordCount) * 100 : 0

  const hedgeWords = countPatternMatches(transcript, HEDGE_PATTERNS)
  const totalHedges = hedgeWords.reduce((sum, h) => sum + h.count, 0)

  const repeatedPhrases = findRepeatedPhrases(transcript)
  const paceRating = getPaceRating(wordsPerMinute)

  const clarityScore = calculateClarityScore(fillerRate, totalHedges, wordCount, paceRating)

  return {
    fillerWords,
    totalFillers,
    fillerRate: Math.round(fillerRate * 10) / 10,
    hedgeWords,
    totalHedges,
    wordCount,
    durationSeconds,
    wordsPerMinute,
    paceRating,
    repeatedPhrases,
    clarityScore,
  }
}
