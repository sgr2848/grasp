import type { Request } from 'express'

export interface AuthRequest extends Request {
  userId?: string
}

export type Persona = 'coach' | 'professor' | 'sergeant' | 'hype' | 'chill'

export type SourceType = 'article' | 'meeting' | 'podcast' | 'video' | 'book' | 'lecture' | 'other'

export interface TTSScript {
  intro: string
  score_announcement: string
  covered_summary: string
  missed_summary: string
  closing: string
}

export interface Analysis {
  key_points: string[]
  covered_points: string[]
  missed_points: string[]
  coverage: number
  accuracy: number
  feedback: string
  tts_script: TTSScript
}

export interface User {
  id: string
  selectedPersona: Persona
  ttsEnabled: boolean
  isPaid: boolean
  subscriptionTier: 'free' | 'pro'
  loopsUsedToday: number
  lastUsageResetAt: Date
  loopsUsedThisMonth: number
  usageResetMonth: Date
  createdAt: Date
}

export interface Workspace {
  id: string
  userId: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Subject {
  id: string
  workspaceId: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  subjectId: string | null
  title: string | null
  sourceText: string
  sourceWordCount: number | null
  sourceType: SourceType
  transcript: string | null
  durationSeconds: number | null
  score: number | null
  persona: Persona
  keyPointsCount: number | null
  coveredCount: number | null
  missedCount: number | null
  analysis: Analysis | null
  createdAt: Date
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  sessionId: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

// Request body for creating a session
export interface CreateSessionInput {
  subjectId?: string
  title?: string
  sourceText: string
  sourceWordCount?: number
  sourceType?: SourceType
  transcript: string
  durationSeconds?: number
  score: number
  persona: Persona
  analysis: Analysis
}

// Request body for workspaces
export interface CreateWorkspaceInput {
  name: string
  description?: string
}

export interface UpdateWorkspaceInput {
  name?: string
  description?: string
}

// Request body for subjects
export interface CreateSubjectInput {
  workspaceId: string
  name: string
  description?: string
}

export interface UpdateSubjectInput {
  name?: string
  description?: string
}

// ============================================
// V2: Feynman Learning Loop Types
// ============================================

export type LoopStatus = 'in_progress' | 'mastered' | 'archived'
export type Precision = 'essential' | 'balanced' | 'precise'
export type LoopPhase = 'prior_knowledge' | 'reading' | 'first_attempt' | 'first_results' | 'learning' | 'second_attempt' | 'second_results' | 'simplify' | 'simplify_results' | 'complete'
export type AttemptType = 'full_explanation' | 'simplify_challenge' | 'quick_review'
export type SocraticStatus = 'active' | 'completed' | 'abandoned'
export type ReviewStatus = 'scheduled' | 'due' | 'completed' | 'paused'

export interface KeyConcept {
  concept: string
  explanation: string
  importance: 'core' | 'supporting' | 'detail'
}

export interface ConceptRelationship {
  from: string
  to: string
  type: 'causes' | 'enables' | 'exemplifies' | 'contrasts'
}

export interface ConceptMap {
  relationships: ConceptRelationship[]
}

export interface LearningLoop {
  id: string
  userId: string
  subjectId: string | null
  title: string | null
  sourceText: string
  sourceType: SourceType
  sourceWordCount: number | null
  precision: Precision
  keyConcepts: KeyConcept[] | null
  conceptMap: ConceptMap | null
  status: LoopStatus
  currentPhase: LoopPhase
  priorKnowledgeTranscript: string | null
  priorKnowledgeAnalysis: PriorKnowledgeAnalysis | null
  priorKnowledgeScore: number | null
  metadata: LoopMetadata | null
  createdAt: Date
  updatedAt: Date
}

export interface SpeechMetrics {
  fillerWords: { word: string; count: number }[]
  totalFillers: number
  fillerRate: number
  hedgeWords: { word: string; count: number }[]
  totalHedges: number
  wordCount: number
  durationSeconds: number
  wordsPerMinute: number
  paceRating: string
  repeatedPhrases: { phrase: string; count: number }[]
  clarityScore: number
}

export interface LoopAttempt {
  id: string
  loopId: string
  attemptNumber: number
  attemptType: AttemptType
  transcript: string | null
  durationSeconds: number | null
  score: number | null
  coverage: number | null
  accuracy: number | null
  analysis: Analysis | null
  speechMetrics: SpeechMetrics | null
  scoreDelta: number | null
  newlyCovered: string[] | null
  persona: Persona
  createdAt: Date
}

export interface SocraticMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SocraticSession {
  id: string
  loopId: string
  attemptId: string | null
  targetConcepts: string[]
  messages: SocraticMessage[]
  conceptsAddressed: string[] | null
  status: SocraticStatus
  createdAt: Date
  updatedAt: Date
}

export interface ReviewSchedule {
  id: string
  userId: string
  loopId: string
  nextReviewAt: Date
  intervalDays: number
  timesReviewed: number
  lastReviewedAt: Date | null
  lastScore: number | null
  status: ReviewStatus
  createdAt: Date
}

// YouTube metadata stored with video loops
export interface YouTubeMetadata {
  youtubeId: string
  youtubeUrl: string
  channel: string
  thumbnail: string
  videoDuration: number | null
}

// Generic metadata for loops (can extend with other source types)
export type LoopMetadata = YouTubeMetadata | Record<string, unknown>

// Request/Response types for v2
export interface CreateLoopInput {
  subjectId?: string
  title?: string
  sourceText: string
  sourceType: SourceType
  precision?: Precision
  metadata?: LoopMetadata
  /** Optional starting phase - defaults to 'first_attempt' */
  initialPhase?: LoopPhase
}

export interface SubmitAttemptInput {
  transcript: string
  durationSeconds: number
  attemptType: AttemptType
  persona: Persona
  speechMetrics?: SpeechMetrics
}

export interface SocraticResponse {
  message: string
  addressedConcept: string | null
}

// ============================================
// V3: EPUB Book Import Types
// ============================================

export interface Book {
  id: string
  userId: string
  subjectId: string | null
  title: string
  author: string | null
  description: string | null
  coverUrl: string | null
  epubKey: string | null
  lastReadChapterId: string | null
  totalChapters: number
  completedChapters: number
  createdAt: Date
  updatedAt: Date
}

export interface Chapter {
  id: string
  bookId: string
  chapterNumber: number
  chunkNumber: number
  totalChunks: number
  title: string
  content: string
  wordCount: number
  loopId: string | null
  createdAt: Date
}

export interface CreateBookInput {
  title: string
  author?: string
  description?: string
  subjectId?: string
}

export interface ChapterProgress {
  chapter: Chapter
  loop: LearningLoop | null
  status: 'not_started' | 'in_progress' | 'completed'
}

// ============================================
// V4: Knowledge Graph & Prior Knowledge Types
// ============================================

export type ConceptImportance = 'core' | 'supporting' | 'detail'
export type RelationshipType = 'causes' | 'enables' | 'exemplifies' | 'contrasts' | 'prerequisite'

export interface Concept {
  id: string
  name: string
  normalizedName: string
  description: string | null
  category: string | null
  createdAt: Date
}

export interface UserConcept {
  id: string
  userId: string
  conceptId: string
  masteryScore: number
  timesEncountered: number
  timesDemonstrated: number
  lastSeenAt: Date | null
  lastDemonstratedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ConceptRelationshipRecord {
  id: string
  fromConceptId: string
  toConceptId: string
  relationshipType: RelationshipType
  strength: number
  createdAt: Date
}

export interface LoopConcept {
  id: string
  loopId: string
  conceptId: string
  importance: ConceptImportance
  extractedExplanation: string | null
  wasDemonstrated: boolean
  demonstratedAt: Date | null
  demonstratedInPhase: LoopPhase | null
  createdAt: Date
}

export interface Misconception {
  claim: string
  correction: string
}

export interface PriorKnowledgeAnalysis {
  knownConcepts: string[]
  partialConcepts: string[]
  unknownConcepts: string[]
  focusAreas: string[]
  misconceptions?: Misconception[]
  confidenceScore: number
  feedback: string
}

export interface SubmitPriorKnowledgeInput {
  transcript: string
  durationSeconds: number
}

// Knowledge Graph API response types
export interface KnowledgeGraphNode {
  id: string
  name: string
  mastery: number
  category: string | null
  timesEncountered: number
  lastSeen: string | null
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
  type: RelationshipType
  strength: number
}

export interface KnowledgeGraphStats {
  totalConcepts: number
  averageMastery: number
  masteredCount: number
  learningCount: number
  newCount: number
}

export interface KnowledgeGraphResponse {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  stats: KnowledgeGraphStats
}

// ============================================
// V5: Usage Limits Types (Legacy - daily)
// ============================================

export const FREE_TIER_DAILY_LIMIT = 5

export interface UsageStats {
  loopsUsedToday: number
  dailyLimit: number
  remainingLoops: number
  isPaid: boolean
  resetAt: string
}

export interface UsageLimitError {
  error: 'usage_limit_exceeded'
  message: string
  usage: UsageStats
}

// ============================================
// V6: Tiered Pricing Types
// ============================================

export type SubscriptionTier = 'free' | 'pro'

export interface TierLimits {
  maxBooks: number
  maxSessionsPerMonth: number
  maxConcepts: number
  sessionLimitType: 'hard' | 'soft'
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxBooks: 2,
    maxSessionsPerMonth: 8,
    maxConcepts: 50,
    sessionLimitType: 'hard',
  },
  pro: {
    maxBooks: Infinity,
    maxSessionsPerMonth: 50,
    maxConcepts: Infinity,
    sessionLimitType: 'soft',
  },
}

export interface UsageStatsV2 {
  sessionsUsedThisMonth: number
  booksCount: number
  conceptsCount: number
  tier: SubscriptionTier
  limits: TierLimits
  sessionsRemaining: number
  booksRemaining: number
  conceptsRemaining: number
  sessionSoftCapWarning: boolean
  monthResetAt: string
}

export interface FeatureLimitError {
  error: 'feature_limit_exceeded'
  feature: 'books' | 'sessions' | 'concepts'
  message: string
  usage: UsageStatsV2
  upgradeUrl?: string
}

export interface SoftCapWarning {
  warning: 'soft_cap_approaching' | 'soft_cap_exceeded'
  feature: 'sessions'
  message: string
  usage: UsageStatsV2
}
