import type { Persona } from './personas'

export type SourceType = 'article' | 'meeting' | 'podcast' | 'video' | 'book' | 'lecture' | 'other'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Get auth token from Clerk - will be set by the auth hook
let getToken: (() => Promise<string | null>) | null = null

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getToken = getter
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)

  if (getToken) {
    const token = await getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  return fetch(url, {
    ...options,
    headers
  })
}

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

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')

  const token = getToken ? await getToken() : null
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    headers,
    body: formData
  })

  if (!response.ok) {
    throw new Error('Failed to transcribe audio')
  }

  const data = await response.json()
  return data.transcript
}

export async function evaluateExplanation(
  sourceText: string,
  transcript: string,
  persona: Persona
): Promise<{ score: number; analysis: Analysis }> {
  const response = await fetchWithAuth(`${API_BASE}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sourceText, transcript, persona })
  })

  if (!response.ok) {
    throw new Error('Failed to evaluate explanation')
  }

  return response.json()
}

export async function getUserPreferences(): Promise<{
  selectedPersona: Persona
  ttsEnabled: boolean
  isPaid: boolean
}> {
  const response = await fetchWithAuth(`${API_BASE}/user/preferences`)

  if (!response.ok) {
    throw new Error('Failed to fetch preferences')
  }

  return response.json()
}

export async function updateUserPreferences(prefs: {
  selectedPersona?: Persona
  ttsEnabled?: boolean
}): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/user/preferences`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(prefs)
  })

  if (!response.ok) {
    throw new Error('Failed to update preferences')
  }
}

export interface PersonaInfo {
  id: string
  name: string
  description: string
  isPaid: boolean
  isAvailable: boolean
}

export async function getPersonas(): Promise<PersonaInfo[]> {
  const response = await fetchWithAuth(`${API_BASE}/user/personas`)

  if (!response.ok) {
    throw new Error('Failed to fetch personas')
  }

  return response.json()
}

export interface SubjectWithWorkspace {
  id: string
  name: string
  description: string | null
  workspaceId: string
  workspaceName: string
}

export async function getUserSubjects(): Promise<SubjectWithWorkspace[]> {
  const response = await fetchWithAuth(`${API_BASE}/user/subjects`)

  if (!response.ok) {
    throw new Error('Failed to fetch subjects')
  }

  return response.json()
}

// Usage limits
export const FREE_TIER_DAILY_LIMIT = 5

export interface UsageStats {
  loopsUsedToday: number
  dailyLimit: number
  remainingLoops: number
  isPaid: boolean
  resetAt: string
}

export interface UsageLimitErrorData {
  error: 'usage_limit_exceeded'
  message: string
  usage: UsageStats
}

export class UsageLimitExceededError extends Error {
  public usage: UsageStats

  constructor(data: UsageLimitErrorData) {
    super(data.message)
    this.name = 'UsageLimitExceededError'
    this.usage = data.usage
  }
}

export async function getUserUsage(): Promise<UsageStats> {
  const response = await fetchWithAuth(`${API_BASE}/user/usage`)

  if (!response.ok) {
    throw new Error('Failed to fetch usage stats')
  }

  return response.json()
}

export interface SessionSummary {
  id: string
  title: string | null
  sourceText: string
  sourceWordCount: number | null
  sourceType: SourceType
  subjectId: string | null
  durationSeconds: number | null
  score: number
  persona: Persona
  keyPointsCount: number | null
  coveredCount: number | null
  missedCount: number | null
  createdAt: string
}

export async function getSessions(subjectId?: string | null): Promise<SessionSummary[]> {
  const url = subjectId
    ? `${API_BASE}/sessions?subjectId=${subjectId}`
    : `${API_BASE}/sessions`

  const response = await fetchWithAuth(url)

  if (!response.ok) {
    throw new Error('Failed to fetch sessions')
  }

  return response.json()
}

export interface FullSession {
  id: string
  title: string | null
  sourceText: string
  sourceWordCount: number | null
  sourceType: SourceType
  subjectId: string | null
  transcript: string
  durationSeconds: number | null
  score: number
  persona: Persona
  keyPointsCount: number | null
  coveredCount: number | null
  missedCount: number | null
  analysis: Analysis
  createdAt: string
}

export async function getSession(id: string): Promise<FullSession> {
  const response = await fetchWithAuth(`${API_BASE}/sessions/${id}`)

  if (!response.ok) {
    throw new Error('Failed to fetch session')
  }

  return response.json()
}

export interface CreateSessionData {
  title?: string
  sourceText: string
  sourceWordCount?: number
  sourceType?: SourceType
  subjectId?: string
  transcript: string
  durationSeconds?: number
  score: number
  persona: Persona
  analysis: Analysis
}

export async function createSession(data: CreateSessionData): Promise<{ id: string }> {
  const response = await fetchWithAuth(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to create session')
  }

  return response.json()
}

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export async function generateTTS(text: string, voice: TTSVoice = 'nova'): Promise<Blob> {
  const response = await fetchWithAuth(`${API_BASE}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text, voice })
  })

  if (!response.ok) {
    throw new Error('Failed to generate speech')
  }

  return response.blob()
}

// Workspace types and API
export interface Workspace {
  id: string
  userId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface Subject {
  id: string
  workspaceId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces`)

  if (!response.ok) {
    throw new Error('Failed to fetch workspaces')
  }

  return response.json()
}

export async function getWorkspace(id: string): Promise<Workspace & { subjects: Subject[] }> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces/${id}`)

  if (!response.ok) {
    throw new Error('Failed to fetch workspace')
  }

  return response.json()
}

export async function createWorkspace(data: { name: string; description?: string }): Promise<Workspace> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to create workspace')
  }

  return response.json()
}

export async function updateWorkspace(id: string, data: { name?: string; description?: string }): Promise<Workspace> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to update workspace')
  }

  return response.json()
}

export async function deleteWorkspace(id: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error('Failed to delete workspace')
  }
}

export async function createSubject(workspaceId: string, data: { name: string; description?: string }): Promise<Subject> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces/${workspaceId}/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to create subject')
  }

  return response.json()
}

export async function updateSubject(
  workspaceId: string,
  subjectId: string,
  data: { name?: string; description?: string }
): Promise<Subject> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces/${workspaceId}/subjects/${subjectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to update subject')
  }

  return response.json()
}

export async function deleteSubject(workspaceId: string, subjectId: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/workspaces/${workspaceId}/subjects/${subjectId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error('Failed to delete subject')
  }
}

// Chat API for conversational follow-up
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatResponse {
  reply: string
  followUpQuestion: string | null
  remainingMissedPoints: string[]
}

export async function getConversation(sessionId: string): Promise<{ messages: ChatMessage[]; hasConversation: boolean }> {
  const response = await fetchWithAuth(`${API_BASE}/chat/${sessionId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch conversation')
  }

  return response.json()
}

export async function sendChatMessage(sessionId: string, message: string): Promise<ChatResponse> {
  const response = await fetchWithAuth(`${API_BASE}/chat/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  })

  if (!response.ok) {
    throw new Error('Failed to send message')
  }

  return response.json()
}

export async function startConversation(sessionId: string): Promise<{ message: string; missedPoints: string[] }> {
  const response = await fetchWithAuth(`${API_BASE}/chat/${sessionId}/start`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error('Failed to start conversation')
  }

  return response.json()
}

// =====================
// Learning Loops API
// =====================

export type LoopStatus = 'in_progress' | 'mastered' | 'archived'
export type LoopPhase =
  | 'prior_knowledge'
  | 'first_attempt'
  | 'first_results'
  | 'learning'
  | 'second_attempt'
  | 'second_results'
  | 'simplify'
  | 'simplify_results'
  | 'complete'
export type AttemptType = 'full_explanation' | 'simplify_challenge' | 'quick_review'
export type Precision = 'essential' | 'balanced' | 'precise'

export interface KeyConcept {
  concept: string
  explanation: string
  importance: 'core' | 'supporting' | 'detail'
}

export interface ConceptMap {
  relationships: Array<{
    from: string
    to: string
    type: 'causes' | 'enables' | 'exemplifies' | 'contrasts'
  }>
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

export interface LearningLoop {
  id: string
  userId: string
  subjectId: string | null
  title: string | null
  sourceText: string
  sourceWordCount: number
  sourceType: SourceType
  precision: Precision
  keyConcepts: KeyConcept[] | null
  conceptMap: ConceptMap | null
  status: LoopStatus
  currentPhase: LoopPhase
  priorKnowledgeTranscript: string | null
  priorKnowledgeAnalysis: PriorKnowledgeAnalysis | null
  priorKnowledgeScore: number | null
  createdAt: string
  updatedAt: string
}

export interface LoopAttempt {
  id: string
  loopId: string
  attemptNumber: number
  attemptType: AttemptType
  transcript: string
  durationSeconds: number | null
  score: number
  coverage: number
  accuracy: number
  analysis: Analysis
  speechMetrics: Record<string, unknown> | null
  scoreDelta: number | null
  newlyCovered: string[] | null
  persona: string
  createdAt: string
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
  status: 'active' | 'completed' | 'abandoned'
  createdAt: string
  updatedAt: string
}

export interface ReviewSchedule {
  id: string
  userId: string
  loopId: string
  nextReviewAt: string
  intervalDays: number
  timesReviewed: number
  lastReviewedAt: string | null
  lastScore: number | null
  status: 'scheduled' | 'due' | 'completed' | 'paused'
  createdAt: string
}

export interface LoopWithDetails extends LearningLoop {
  attempts: LoopAttempt[]
  currentSocraticSession: SocraticSession | null
  reviewSchedule: ReviewSchedule | null
}

export interface CreateLoopInput {
  title?: string
  sourceText: string
  sourceType: SourceType
  subjectId?: string
  precision?: Precision
}

export interface SubmitAttemptInput {
  transcript: string
  durationSeconds: number
  attemptType: AttemptType
  persona: Persona
  speechMetrics?: Record<string, unknown>
}

export interface AttemptResult {
  attempt: LoopAttempt
  nextPhase: LoopPhase
  evaluation: Analysis
}

export interface SocraticResponse {
  message: string
  addressedConcept: string | null
  allAddressed: boolean
  session: SocraticSession
}

export async function createLoop(data: CreateLoopInput): Promise<LearningLoop> {
  const response = await fetchWithAuth(`${API_BASE}/loops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to create learning loop')
  }

  return response.json()
}

export async function getLoops(status?: LoopStatus, subjectId?: string | null): Promise<LearningLoop[]> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (subjectId) params.set('subjectId', subjectId)

  const queryString = params.toString()
  const url = queryString
    ? `${API_BASE}/loops?${queryString}`
    : `${API_BASE}/loops`

  const response = await fetchWithAuth(url)

  if (!response.ok) {
    throw new Error('Failed to fetch loops')
  }

  return response.json()
}

export async function getLoop(id: string): Promise<LoopWithDetails> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${id}`)

  if (!response.ok) {
    throw new Error('Failed to fetch loop')
  }

  return response.json()
}

export async function submitAttempt(loopId: string, data: SubmitAttemptInput): Promise<AttemptResult> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${loopId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (response.status === 429) {
    const errorData = await response.json() as UsageLimitErrorData
    throw new UsageLimitExceededError(errorData)
  }

  if (!response.ok) {
    throw new Error('Failed to submit attempt')
  }

  return response.json()
}

export async function updateLoopPhase(loopId: string, phase: LoopPhase): Promise<LearningLoop> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${loopId}/phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase })
  })

  if (!response.ok) {
    throw new Error('Failed to update loop phase')
  }

  return response.json()
}

export async function startSocraticSession(loopId: string, attemptId?: string): Promise<{ session: SocraticSession; message: string }> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${loopId}/socratic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attemptId })
  })

  if (!response.ok) {
    throw new Error('Failed to start Socratic session')
  }

  return response.json()
}

export async function sendSocraticMessage(loopId: string, sessionId: string, content: string): Promise<SocraticResponse> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${loopId}/socratic/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })

  if (!response.ok) {
    throw new Error('Failed to send Socratic message')
  }

  return response.json()
}

export interface DueReview extends ReviewSchedule {
  loop: {
    id: string
    title: string | null
    sourceText: string
    keyConcepts: KeyConcept[] | null
  } | null
}

export async function getDueReviews(): Promise<DueReview[]> {
  const response = await fetchWithAuth(`${API_BASE}/loops/reviews/due`)

  if (!response.ok) {
    throw new Error('Failed to fetch due reviews')
  }

  return response.json()
}

// =====================
// Books API (EPUB Import)
// =====================

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
  createdAt: string
  updatedAt: string
}

export interface ChapterSummary {
  id: string
  chapterNumber: number
  chunkNumber: number
  totalChunks: number
  title: string
  wordCount: number
  loopId: string | null
  status: 'not_started' | 'in_progress' | 'completed'
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
  createdAt: string
}

export interface BookWithChapters extends Book {
  chapters: ChapterSummary[]
}

export async function uploadBook(file: File, subjectId?: string): Promise<BookWithChapters> {
  const formData = new FormData()
  formData.append('file', file)
  if (subjectId) {
    formData.append('subjectId', subjectId)
  }

  const token = getToken ? await getToken() : null
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}/books/upload`, {
    method: 'POST',
    headers,
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload book')
  }

  return response.json()
}

export async function getBooks(subjectId?: string | null): Promise<Book[]> {
  const url = subjectId
    ? `${API_BASE}/books?subjectId=${subjectId}`
    : `${API_BASE}/books`

  const response = await fetchWithAuth(url)

  if (!response.ok) {
    throw new Error('Failed to fetch books')
  }

  return response.json()
}

export async function getBook(id: string): Promise<BookWithChapters> {
  const response = await fetchWithAuth(`${API_BASE}/books/${id}`)

  if (!response.ok) {
    throw new Error('Failed to fetch book')
  }

  return response.json()
}

export async function getChapter(bookId: string, chapterId: string): Promise<Chapter> {
  const response = await fetchWithAuth(`${API_BASE}/books/${bookId}/chapters/${chapterId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch chapter')
  }

  return response.json()
}

export async function startChapterLoop(
  bookId: string,
  chapterId: string,
  precision?: Precision
): Promise<{ loop: LearningLoop; chapter: Chapter }> {
  const response = await fetchWithAuth(`${API_BASE}/books/${bookId}/chapters/${chapterId}/start-loop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ precision })
  })

  if (!response.ok) {
    throw new Error('Failed to start chapter loop')
  }

  return response.json()
}

export async function deleteBook(id: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/books/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error('Failed to delete book')
  }
}

// =====================
// Prior Knowledge API
// =====================

export interface PriorKnowledgeResult {
  analysis: PriorKnowledgeAnalysis
  nextPhase: LoopPhase
  loop: LearningLoop
}

export async function submitPriorKnowledge(
  loopId: string,
  transcript: string,
  durationSeconds: number
): Promise<PriorKnowledgeResult> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${loopId}/prior-knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, durationSeconds })
  })

  if (!response.ok) {
    throw new Error('Failed to submit prior knowledge')
  }

  return response.json()
}

export async function skipPriorKnowledge(loopId: string): Promise<{ nextPhase: LoopPhase; loop: LearningLoop }> {
  const response = await fetchWithAuth(`${API_BASE}/loops/${loopId}/skip-prior-knowledge`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error('Failed to skip prior knowledge')
  }

  return response.json()
}

// =====================
// Knowledge Graph API
// =====================

export type RelationshipType = 'causes' | 'enables' | 'exemplifies' | 'contrasts' | 'prerequisite'

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

export interface ConceptWithMastery {
  id: string
  userId: string
  conceptId: string
  masteryScore: number
  timesEncountered: number
  timesDemonstrated: number
  lastSeenAt: string | null
  lastDemonstratedAt: string | null
  createdAt: string
  updatedAt: string
  concept: {
    id: string
    name: string
    description: string | null
    category: string | null
  } | null
}

export async function getKnowledgeGraph(): Promise<KnowledgeGraphResponse> {
  const response = await fetchWithAuth(`${API_BASE}/knowledge/graph`)

  if (!response.ok) {
    throw new Error('Failed to fetch knowledge graph')
  }

  return response.json()
}

export async function getKnowledgeConcepts(): Promise<ConceptWithMastery[]> {
  const response = await fetchWithAuth(`${API_BASE}/knowledge/concepts`)

  if (!response.ok) {
    throw new Error('Failed to fetch knowledge concepts')
  }

  return response.json()
}

export async function getKnowledgeStats(): Promise<KnowledgeGraphStats> {
  const response = await fetchWithAuth(`${API_BASE}/knowledge/stats`)

  if (!response.ok) {
    throw new Error('Failed to fetch knowledge stats')
  }

  return response.json()
}

// Knowledge Insights types
export interface InsightConcept {
  id: string
  name: string
  mastery: number
  timesEncountered: number
  lastSeen: string | null
  daysSinceLastSeen: number | null
}

export interface CrossConnection {
  id: string
  name: string
  loopCount: number
  loops: { id: string; title: string }[]
}

export interface KnowledgeInsights {
  needsReview: InsightConcept[]
  recentProgress: InsightConcept[]
  weakSpots: InsightConcept[]
  crossConnections: CrossConnection[]
  stats: KnowledgeGraphStats
}

export async function getKnowledgeInsights(): Promise<KnowledgeInsights> {
  const response = await fetchWithAuth(`${API_BASE}/knowledge/insights`)

  if (!response.ok) {
    throw new Error('Failed to fetch knowledge insights')
  }

  return response.json()
}
