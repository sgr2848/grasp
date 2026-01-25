import { sql } from './client.js'
import type {
  User, Session, Workspace, Subject, Conversation, Persona, Analysis, SourceType, ChatMessage,
  LearningLoop, LoopAttempt, SocraticSession, ReviewSchedule, KeyConcept, ConceptMap,
  LoopStatus, LoopPhase, AttemptType, SocraticMessage, SpeechMetrics, Book, Chapter, Precision,
  Concept, UserConcept, ConceptRelationshipRecord, LoopConcept, ConceptImportance, RelationshipType,
  PriorKnowledgeAnalysis
} from '../types/index.js'

export const userQueries = {
  async findById(id: string): Promise<User | null> {
    const result = await sql`
      SELECT id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
             is_paid as "isPaid", loops_used_today as "loopsUsedToday",
             last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
      FROM users WHERE id = ${id}
    `
    return result[0] as User | null
  },

  async create(id: string): Promise<User> {
    const result = await sql`
      INSERT INTO users (id)
      VALUES (${id})
      RETURNING id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
                is_paid as "isPaid", loops_used_today as "loopsUsedToday",
                last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
    `
    return result[0] as User
  },

  async upsert(id: string): Promise<User> {
    const existing = await this.findById(id)
    if (existing) return existing

    // Create new user
    const user = await this.create(id)

    // Auto-create default workspace for new users
    try {
      await sql`
        INSERT INTO workspaces (user_id, name, description)
        VALUES (${id}, 'Personal', 'Your personal workspace')
      `
    } catch (err) {
      // Ignore if workspace already exists
      console.log('Default workspace creation skipped:', err)
    }

    return user
  },

  async updatePreferences(
    id: string,
    prefs: { selectedPersona?: Persona; ttsEnabled?: boolean }
  ): Promise<User | null> {
    if (prefs.selectedPersona !== undefined && prefs.ttsEnabled !== undefined) {
      const result = await sql`
        UPDATE users
        SET selected_persona = ${prefs.selectedPersona}, tts_enabled = ${prefs.ttsEnabled}
        WHERE id = ${id}
        RETURNING id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
                  is_paid as "isPaid", loops_used_today as "loopsUsedToday",
                  last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
      `
      return result[0] as User | null
    } else if (prefs.selectedPersona !== undefined) {
      const result = await sql`
        UPDATE users SET selected_persona = ${prefs.selectedPersona}
        WHERE id = ${id}
        RETURNING id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
                  is_paid as "isPaid", loops_used_today as "loopsUsedToday",
                  last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
      `
      return result[0] as User | null
    } else if (prefs.ttsEnabled !== undefined) {
      const result = await sql`
        UPDATE users SET tts_enabled = ${prefs.ttsEnabled}
        WHERE id = ${id}
        RETURNING id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
                  is_paid as "isPaid", loops_used_today as "loopsUsedToday",
                  last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
      `
      return result[0] as User | null
    }
    return this.findById(id)
  },

  // Get user with usage stats, auto-reset if past midnight UTC
  async getWithUsage(id: string): Promise<User | null> {
    const result = await sql`
      UPDATE users
      SET
        loops_used_today = CASE
          WHEN last_usage_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date
          THEN 0
          ELSE loops_used_today
        END,
        last_usage_reset_at = CASE
          WHEN last_usage_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date
          THEN NOW() AT TIME ZONE 'UTC'
          ELSE last_usage_reset_at
        END
      WHERE id = ${id}
      RETURNING id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
                is_paid as "isPaid", loops_used_today as "loopsUsedToday",
                last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
    `
    return result[0] as User | null
  },

  // Increment usage counter
  async incrementUsage(id: string): Promise<User | null> {
    const result = await sql`
      UPDATE users
      SET loops_used_today = loops_used_today + 1
      WHERE id = ${id}
      RETURNING id, selected_persona as "selectedPersona", tts_enabled as "ttsEnabled",
                is_paid as "isPaid", loops_used_today as "loopsUsedToday",
                last_usage_reset_at as "lastUsageResetAt", created_at as "createdAt"
    `
    return result[0] as User | null
  }
}

export const sessionQueries = {
  async findByUserId(userId: string, subjectId?: string | null): Promise<Session[]> {
    if (subjectId) {
      const result = await sql`
        SELECT id, user_id as "userId", subject_id as "subjectId", title,
               source_text as "sourceText", source_word_count as "sourceWordCount",
               source_type as "sourceType", transcript, duration_seconds as "durationSeconds",
               score, persona, key_points_count as "keyPointsCount",
               covered_count as "coveredCount", missed_count as "missedCount",
               analysis, created_at as "createdAt"
        FROM sessions
        WHERE user_id = ${userId} AND subject_id = ${subjectId}
        ORDER BY created_at DESC
      `
      return result as Session[]
    }
    const result = await sql`
      SELECT id, user_id as "userId", subject_id as "subjectId", title,
             source_text as "sourceText", source_word_count as "sourceWordCount",
             source_type as "sourceType", transcript, duration_seconds as "durationSeconds",
             score, persona, key_points_count as "keyPointsCount",
             covered_count as "coveredCount", missed_count as "missedCount",
             analysis, created_at as "createdAt"
      FROM sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `
    return result as Session[]
  },

  async findById(id: string, userId: string): Promise<Session | null> {
    const result = await sql`
      SELECT id, user_id as "userId", subject_id as "subjectId", title,
             source_text as "sourceText", source_word_count as "sourceWordCount",
             source_type as "sourceType", transcript, duration_seconds as "durationSeconds",
             score, persona, key_points_count as "keyPointsCount",
             covered_count as "coveredCount", missed_count as "missedCount",
             analysis, created_at as "createdAt"
      FROM sessions
      WHERE id = ${id} AND user_id = ${userId}
    `
    return result[0] as Session | null
  },

  async create(data: {
    userId: string
    title: string
    sourceText: string
    sourceWordCount: number
    sourceType?: SourceType
    subjectId?: string
    transcript: string
    durationSeconds: number
    score: number
    persona: Persona
    keyPointsCount: number
    coveredCount: number
    missedCount: number
    analysis: Analysis
  }): Promise<Session> {
    const result = await sql`
      INSERT INTO sessions (
        user_id, title, source_text, source_word_count, source_type, subject_id,
        transcript, duration_seconds, score, persona, key_points_count, covered_count,
        missed_count, analysis
      )
      VALUES (
        ${data.userId}, ${data.title}, ${data.sourceText}, ${data.sourceWordCount},
        ${data.sourceType || 'article'}, ${data.subjectId || null},
        ${data.transcript}, ${data.durationSeconds}, ${data.score}, ${data.persona},
        ${data.keyPointsCount}, ${data.coveredCount}, ${data.missedCount},
        ${JSON.stringify(data.analysis)}
      )
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_word_count as "sourceWordCount",
                source_type as "sourceType", transcript, duration_seconds as "durationSeconds",
                score, persona, key_points_count as "keyPointsCount",
                covered_count as "coveredCount", missed_count as "missedCount",
                analysis, created_at as "createdAt"
    `
    return result[0] as Session
  }
}

export const workspaceQueries = {
  async findByUserId(userId: string): Promise<Workspace[]> {
    const result = await sql`
      SELECT id, user_id as "userId", name, description,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM workspaces
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `
    return result as Workspace[]
  },

  async findById(id: string, userId: string): Promise<Workspace | null> {
    const result = await sql`
      SELECT id, user_id as "userId", name, description,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM workspaces
      WHERE id = ${id} AND user_id = ${userId}
    `
    return result[0] as Workspace | null
  },

  async create(data: { userId: string; name: string; description?: string }): Promise<Workspace> {
    const result = await sql`
      INSERT INTO workspaces (user_id, name, description)
      VALUES (${data.userId}, ${data.name}, ${data.description || null})
      RETURNING id, user_id as "userId", name, description,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Workspace
  },

  async update(id: string, userId: string, data: { name?: string; description?: string }): Promise<Workspace | null> {
    const result = await sql`
      UPDATE workspaces
      SET name = COALESCE(${data.name || null}, name),
          description = COALESCE(${data.description || null}, description),
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id, user_id as "userId", name, description,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Workspace | null
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM workspaces WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `
    return result.length > 0
  }
}

export const subjectQueries = {
  async findByWorkspaceId(workspaceId: string): Promise<Subject[]> {
    const result = await sql`
      SELECT id, workspace_id as "workspaceId", name, description,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM subjects
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
    `
    return result as Subject[]
  },

  async findById(id: string): Promise<Subject | null> {
    const result = await sql`
      SELECT id, workspace_id as "workspaceId", name, description,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM subjects
      WHERE id = ${id}
    `
    return result[0] as Subject | null
  },

  async create(data: { workspaceId: string; name: string; description?: string }): Promise<Subject> {
    const result = await sql`
      INSERT INTO subjects (workspace_id, name, description)
      VALUES (${data.workspaceId}, ${data.name}, ${data.description || null})
      RETURNING id, workspace_id as "workspaceId", name, description,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Subject
  },

  async update(id: string, data: { name?: string; description?: string }): Promise<Subject | null> {
    const result = await sql`
      UPDATE subjects
      SET name = COALESCE(${data.name || null}, name),
          description = COALESCE(${data.description || null}, description),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, workspace_id as "workspaceId", name, description,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Subject | null
  },

  async delete(id: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM subjects WHERE id = ${id}
      RETURNING id
    `
    return result.length > 0
  }
}

export const conversationQueries = {
  async findBySessionId(sessionId: string): Promise<Conversation | null> {
    const result = await sql`
      SELECT id, session_id as "sessionId", messages,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM conversations
      WHERE session_id = ${sessionId}
    `
    return result[0] as Conversation | null
  },

  async create(sessionId: string): Promise<Conversation> {
    const result = await sql`
      INSERT INTO conversations (session_id, messages)
      VALUES (${sessionId}, '[]')
      RETURNING id, session_id as "sessionId", messages,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Conversation
  },

  async addMessage(sessionId: string, message: ChatMessage): Promise<Conversation> {
    const result = await sql`
      UPDATE conversations
      SET messages = messages || ${JSON.stringify(message)}::jsonb,
          updated_at = NOW()
      WHERE session_id = ${sessionId}
      RETURNING id, session_id as "sessionId", messages,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Conversation
  },

  async getOrCreate(sessionId: string): Promise<Conversation> {
    const existing = await this.findBySessionId(sessionId)
    if (existing) return existing
    return this.create(sessionId)
  }
}

// ============================================
// V2: Learning Loop Queries
// ============================================

export const learningLoopQueries = {
  async create(data: {
    userId: string
    subjectId?: string
    title?: string
    sourceText: string
    sourceType: SourceType
    precision?: Precision
    initialPhase?: LoopPhase
  }): Promise<LearningLoop> {
    const wordCount = data.sourceText.trim().split(/\s+/).length
    const precision = data.precision || 'balanced'
    const initialPhase = data.initialPhase || 'first_attempt'
    const result = await sql`
      INSERT INTO learning_loops (user_id, subject_id, title, source_text, source_type, source_word_count, precision, current_phase)
      VALUES (${data.userId}, ${data.subjectId || null}, ${data.title || null}, ${data.sourceText}, ${data.sourceType}, ${wordCount}, ${precision}, ${initialPhase})
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_type as "sourceType",
                source_word_count as "sourceWordCount", precision,
                key_concepts as "keyConcepts", concept_map as "conceptMap",
                status, current_phase as "currentPhase",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as LearningLoop
  },

  async findById(id: string): Promise<LearningLoop | null> {
    const result = await sql`
      SELECT id, user_id as "userId", subject_id as "subjectId", title,
             source_text as "sourceText", source_type as "sourceType",
             source_word_count as "sourceWordCount", precision,
             key_concepts as "keyConcepts", concept_map as "conceptMap",
             status, current_phase as "currentPhase",
             prior_knowledge_transcript as "priorKnowledgeTranscript",
             prior_knowledge_analysis as "priorKnowledgeAnalysis",
             prior_knowledge_score as "priorKnowledgeScore",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM learning_loops
      WHERE id = ${id}
    `
    return result[0] as LearningLoop | null
  },

  async findTitlesByIds(ids: string[]): Promise<Array<{ id: string; title: string | null }>> {
    if (ids.length === 0) return []
    const result = await sql`
      SELECT id, title
      FROM learning_loops
      WHERE id = ANY(${ids})
    `
    return result as Array<{ id: string; title: string | null }>
  },

  async findByUserId(userId: string, status?: LoopStatus, subjectId?: string | null): Promise<LearningLoop[]> {
    if (status && subjectId) {
      const result = await sql`
        SELECT id, user_id as "userId", subject_id as "subjectId", title,
               source_text as "sourceText", source_type as "sourceType",
               source_word_count as "sourceWordCount", precision,
               key_concepts as "keyConcepts", concept_map as "conceptMap",
               status, current_phase as "currentPhase",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM learning_loops
        WHERE user_id = ${userId} AND status = ${status} AND subject_id = ${subjectId}
        ORDER BY updated_at DESC
      `
      return result as LearningLoop[]
    }
    if (status) {
      const result = await sql`
        SELECT id, user_id as "userId", subject_id as "subjectId", title,
               source_text as "sourceText", source_type as "sourceType",
               source_word_count as "sourceWordCount", precision,
               key_concepts as "keyConcepts", concept_map as "conceptMap",
               status, current_phase as "currentPhase",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM learning_loops
        WHERE user_id = ${userId} AND status = ${status}
        ORDER BY updated_at DESC
      `
      return result as LearningLoop[]
    }
    if (subjectId) {
      const result = await sql`
        SELECT id, user_id as "userId", subject_id as "subjectId", title,
               source_text as "sourceText", source_type as "sourceType",
               source_word_count as "sourceWordCount", precision,
               key_concepts as "keyConcepts", concept_map as "conceptMap",
               status, current_phase as "currentPhase",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM learning_loops
        WHERE user_id = ${userId} AND subject_id = ${subjectId}
        ORDER BY updated_at DESC
      `
      return result as LearningLoop[]
    }
    const result = await sql`
      SELECT id, user_id as "userId", subject_id as "subjectId", title,
             source_text as "sourceText", source_type as "sourceType",
             source_word_count as "sourceWordCount", precision,
             key_concepts as "keyConcepts", concept_map as "conceptMap",
             status, current_phase as "currentPhase",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM learning_loops
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `
    return result as LearningLoop[]
  },

  async updateConcepts(id: string, keyConcepts: KeyConcept[], conceptMap: ConceptMap): Promise<LearningLoop | null> {
    const result = await sql`
      UPDATE learning_loops
      SET key_concepts = ${JSON.stringify(keyConcepts)},
          concept_map = ${JSON.stringify(conceptMap)},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_type as "sourceType",
                source_word_count as "sourceWordCount", precision,
                key_concepts as "keyConcepts", concept_map as "conceptMap",
                status, current_phase as "currentPhase",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as LearningLoop | null
  },

  async updatePhase(id: string, phase: LoopPhase): Promise<LearningLoop | null> {
    const result = await sql`
      UPDATE learning_loops
      SET current_phase = ${phase}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_type as "sourceType",
                source_word_count as "sourceWordCount", precision,
                key_concepts as "keyConcepts", concept_map as "conceptMap",
                status, current_phase as "currentPhase",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as LearningLoop | null
  },

  async updateStatus(id: string, status: LoopStatus): Promise<LearningLoop | null> {
    const result = await sql`
      UPDATE learning_loops
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_type as "sourceType",
                source_word_count as "sourceWordCount", precision,
                key_concepts as "keyConcepts", concept_map as "conceptMap",
                status, current_phase as "currentPhase",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as LearningLoop | null
  }
}

export const loopAttemptQueries = {
  async create(data: {
    loopId: string
    attemptType: AttemptType
    transcript: string
    durationSeconds: number
    score: number
    coverage: number
    accuracy: number
    analysis: Analysis
    speechMetrics?: SpeechMetrics
    persona: Persona
  }): Promise<LoopAttempt> {
    // Get attempt number
    const countResult = await sql`
      SELECT COUNT(*) as count FROM loop_attempts WHERE loop_id = ${data.loopId}
    `
    const attemptNumber = parseInt(countResult[0].count as string) + 1

    // Get previous attempt for comparison
    const previousAttempt = await sql`
      SELECT score, analysis FROM loop_attempts
      WHERE loop_id = ${data.loopId}
      ORDER BY attempt_number DESC
      LIMIT 1
    `

    let scoreDelta: number | null = null
    let newlyCovered: string[] = []

    if (previousAttempt[0]) {
      scoreDelta = data.score - (previousAttempt[0].score as number)
      const prevAnalysis = previousAttempt[0].analysis as Analysis | null
      const prevCovered = prevAnalysis?.covered_points || []
      const nowCovered = data.analysis.covered_points || []
      newlyCovered = nowCovered.filter(p => !prevCovered.includes(p))
    }

    const result = await sql`
      INSERT INTO loop_attempts (
        loop_id, attempt_number, attempt_type, transcript, duration_seconds,
        score, coverage, accuracy, analysis, speech_metrics, persona,
        score_delta, newly_covered
      )
      VALUES (
        ${data.loopId}, ${attemptNumber}, ${data.attemptType}, ${data.transcript},
        ${data.durationSeconds}, ${data.score}, ${data.coverage}, ${data.accuracy},
        ${JSON.stringify(data.analysis)}, ${data.speechMetrics ? JSON.stringify(data.speechMetrics) : null},
        ${data.persona}, ${scoreDelta}, ${newlyCovered}
      )
      RETURNING id, loop_id as "loopId", attempt_number as "attemptNumber",
                attempt_type as "attemptType", transcript, duration_seconds as "durationSeconds",
                score, coverage, accuracy, analysis, speech_metrics as "speechMetrics",
                score_delta as "scoreDelta", newly_covered as "newlyCovered",
                persona, created_at as "createdAt"
    `
    return result[0] as LoopAttempt
  },

  async findByLoopId(loopId: string): Promise<LoopAttempt[]> {
    const result = await sql`
      SELECT id, loop_id as "loopId", attempt_number as "attemptNumber",
             attempt_type as "attemptType", transcript, duration_seconds as "durationSeconds",
             score, coverage, accuracy, analysis, speech_metrics as "speechMetrics",
             score_delta as "scoreDelta", newly_covered as "newlyCovered",
             persona, created_at as "createdAt"
      FROM loop_attempts
      WHERE loop_id = ${loopId}
      ORDER BY attempt_number ASC
    `
    return result as LoopAttempt[]
  },

  async findLatest(loopId: string): Promise<LoopAttempt | null> {
    const result = await sql`
      SELECT id, loop_id as "loopId", attempt_number as "attemptNumber",
             attempt_type as "attemptType", transcript, duration_seconds as "durationSeconds",
             score, coverage, accuracy, analysis, speech_metrics as "speechMetrics",
             score_delta as "scoreDelta", newly_covered as "newlyCovered",
             persona, created_at as "createdAt"
      FROM loop_attempts
      WHERE loop_id = ${loopId}
      ORDER BY attempt_number DESC
      LIMIT 1
    `
    return result[0] as LoopAttempt | null
  }
}

export const socraticSessionQueries = {
  async create(loopId: string, attemptId: string | null, targetConcepts: string[]): Promise<SocraticSession> {
    const result = await sql`
      INSERT INTO socratic_sessions (loop_id, attempt_id, target_concepts, messages, concepts_addressed)
      VALUES (${loopId}, ${attemptId}, ${targetConcepts}, '[]', '{}')
      RETURNING id, loop_id as "loopId", attempt_id as "attemptId",
                target_concepts as "targetConcepts", messages,
                concepts_addressed as "conceptsAddressed", status,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as SocraticSession
  },

  async findById(id: string): Promise<SocraticSession | null> {
    const result = await sql`
      SELECT id, loop_id as "loopId", attempt_id as "attemptId",
             target_concepts as "targetConcepts", messages,
             concepts_addressed as "conceptsAddressed", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM socratic_sessions
      WHERE id = ${id}
    `
    return result[0] as SocraticSession | null
  },

  async findActiveByLoopId(loopId: string): Promise<SocraticSession | null> {
    const result = await sql`
      SELECT id, loop_id as "loopId", attempt_id as "attemptId",
             target_concepts as "targetConcepts", messages,
             concepts_addressed as "conceptsAddressed", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM socratic_sessions
      WHERE loop_id = ${loopId} AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `
    return result[0] as SocraticSession | null
  },

  async findLatestByLoopId(loopId: string): Promise<SocraticSession | null> {
    const result = await sql`
      SELECT id, loop_id as "loopId", attempt_id as "attemptId",
             target_concepts as "targetConcepts", messages,
             concepts_addressed as "conceptsAddressed", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM socratic_sessions
      WHERE loop_id = ${loopId}
      ORDER BY updated_at DESC
      LIMIT 1
    `
    return result[0] as SocraticSession | null
  },

  async addMessage(id: string, message: SocraticMessage): Promise<SocraticSession | null> {
    const result = await sql`
      UPDATE socratic_sessions
      SET messages = messages || ${JSON.stringify(message)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, loop_id as "loopId", attempt_id as "attemptId",
                target_concepts as "targetConcepts", messages,
                concepts_addressed as "conceptsAddressed", status,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as SocraticSession | null
  },

  async markConceptAddressed(id: string, concept: string): Promise<SocraticSession | null> {
    const result = await sql`
      UPDATE socratic_sessions
      SET concepts_addressed = array_append(concepts_addressed, ${concept}),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, loop_id as "loopId", attempt_id as "attemptId",
                target_concepts as "targetConcepts", messages,
                concepts_addressed as "conceptsAddressed", status,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as SocraticSession | null
  },

  async updateStatus(id: string, status: 'active' | 'completed' | 'abandoned'): Promise<SocraticSession | null> {
    const result = await sql`
      UPDATE socratic_sessions
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, loop_id as "loopId", attempt_id as "attemptId",
                target_concepts as "targetConcepts", messages,
                concepts_addressed as "conceptsAddressed", status,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as SocraticSession | null
  }
}

export const reviewScheduleQueries = {
  async create(userId: string, loopId: string, intervalDays: number = 1): Promise<ReviewSchedule> {
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + intervalDays)

    const result = await sql`
      INSERT INTO review_schedule (user_id, loop_id, next_review_at, interval_days)
      VALUES (${userId}, ${loopId}, ${nextReview}, ${intervalDays})
      ON CONFLICT (loop_id) DO UPDATE SET
        next_review_at = ${nextReview},
        interval_days = ${intervalDays},
        status = 'scheduled'
      RETURNING id, user_id as "userId", loop_id as "loopId",
                next_review_at as "nextReviewAt", interval_days as "intervalDays",
                times_reviewed as "timesReviewed", last_reviewed_at as "lastReviewedAt",
                last_score as "lastScore", status, created_at as "createdAt"
    `
    return result[0] as ReviewSchedule
  },

  async findDue(userId: string): Promise<ReviewSchedule[]> {
    const result = await sql`
      SELECT id, user_id as "userId", loop_id as "loopId",
             next_review_at as "nextReviewAt", interval_days as "intervalDays",
             times_reviewed as "timesReviewed", last_reviewed_at as "lastReviewedAt",
             last_score as "lastScore", status, created_at as "createdAt"
      FROM review_schedule
      WHERE user_id = ${userId}
        AND next_review_at <= NOW()
        AND status = 'scheduled'
      ORDER BY next_review_at ASC
    `
    return result as ReviewSchedule[]
  },

  async findByLoopId(loopId: string): Promise<ReviewSchedule | null> {
    const result = await sql`
      SELECT id, user_id as "userId", loop_id as "loopId",
             next_review_at as "nextReviewAt", interval_days as "intervalDays",
             times_reviewed as "timesReviewed", last_reviewed_at as "lastReviewedAt",
             last_score as "lastScore", status, created_at as "createdAt"
      FROM review_schedule
      WHERE loop_id = ${loopId}
    `
    return result[0] as ReviewSchedule | null
  },

  async completeReview(id: string, score: number): Promise<ReviewSchedule | null> {
    // Get current interval
    const current = await sql`SELECT interval_days FROM review_schedule WHERE id = ${id}`
    if (!current[0]) return null

    // Calculate next interval (double if good score, reset if bad)
    let nextInterval = current[0].interval_days as number
    if (score >= 80) {
      nextInterval = Math.min(nextInterval * 2, 30) // cap at 30 days
    } else if (score < 50) {
      nextInterval = 1 // reset
    }

    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + nextInterval)

    const result = await sql`
      UPDATE review_schedule
      SET times_reviewed = times_reviewed + 1,
          last_reviewed_at = NOW(),
          last_score = ${score},
          interval_days = ${nextInterval},
          next_review_at = ${nextReview}
      WHERE id = ${id}
      RETURNING id, user_id as "userId", loop_id as "loopId",
                next_review_at as "nextReviewAt", interval_days as "intervalDays",
                times_reviewed as "timesReviewed", last_reviewed_at as "lastReviewedAt",
                last_score as "lastScore", status, created_at as "createdAt"
    `
    return result[0] as ReviewSchedule | null
  }
}

// ============================================
// V3: EPUB Book Import Queries
// ============================================

export const bookQueries = {
  async create(data: {
    userId: string
    subjectId?: string
    title: string
    author?: string
    description?: string
    coverUrl?: string
    epubKey?: string
    totalChapters: number
  }): Promise<Book> {
    const result = await sql`
      INSERT INTO books (user_id, subject_id, title, author, description, cover_url, epub_key, total_chapters)
      VALUES (${data.userId}, ${data.subjectId || null}, ${data.title}, ${data.author || null},
              ${data.description || null}, ${data.coverUrl || null}, ${data.epubKey || null}, ${data.totalChapters})
      RETURNING id, user_id as "userId", subject_id as "subjectId", title, author, description,
                cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
                total_chapters as "totalChapters", completed_chapters as "completedChapters",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Book
  },

  async findById(id: string, userId: string): Promise<Book | null> {
    const result = await sql`
      SELECT id, user_id as "userId", subject_id as "subjectId", title, author, description,
             cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
             total_chapters as "totalChapters", completed_chapters as "completedChapters",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM books
      WHERE id = ${id} AND user_id = ${userId}
    `
    return result[0] as Book | null
  },

  async findByUserId(userId: string, subjectId?: string): Promise<Book[]> {
    if (subjectId) {
      const result = await sql`
        SELECT id, user_id as "userId", subject_id as "subjectId", title, author, description,
               cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
               total_chapters as "totalChapters", completed_chapters as "completedChapters",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM books
        WHERE user_id = ${userId} AND subject_id = ${subjectId}
        ORDER BY updated_at DESC
      `
      return result as Book[]
    }
    const result = await sql`
      SELECT id, user_id as "userId", subject_id as "subjectId", title, author, description,
             cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
             total_chapters as "totalChapters", completed_chapters as "completedChapters",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM books
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `
    return result as Book[]
  },

  async updateProgress(id: string, completedChapters: number): Promise<Book | null> {
    const result = await sql`
      UPDATE books
      SET completed_chapters = ${completedChapters}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title, author, description,
                cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
                total_chapters as "totalChapters", completed_chapters as "completedChapters",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Book | null
  },

  async updateLastRead(id: string, chapterId: string): Promise<Book | null> {
    const result = await sql`
      UPDATE books
      SET last_read_chapter_id = ${chapterId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title, author, description,
                cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
                total_chapters as "totalChapters", completed_chapters as "completedChapters",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Book | null
  },

  async updateCoverAndEpub(id: string, coverUrl?: string, epubKey?: string): Promise<Book | null> {
    const result = await sql`
      UPDATE books
      SET cover_url = COALESCE(${coverUrl || null}, cover_url),
          epub_key = COALESCE(${epubKey || null}, epub_key),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title, author, description,
                cover_url as "coverUrl", epub_key as "epubKey", last_read_chapter_id as "lastReadChapterId",
                total_chapters as "totalChapters", completed_chapters as "completedChapters",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Book | null
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM books WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `
    return result.length > 0
  }
}

export const chapterQueries = {
  async createMany(chapters: {
    bookId: string
    chapterNumber: number
    chunkNumber: number
    totalChunks: number
    title: string
    content: string
    wordCount: number
  }[]): Promise<Chapter[]> {
    const results: Chapter[] = []
    for (const chapter of chapters) {
      const result = await sql`
        INSERT INTO chapters (book_id, chapter_number, chunk_number, total_chunks, title, content, word_count)
        VALUES (${chapter.bookId}, ${chapter.chapterNumber}, ${chapter.chunkNumber},
                ${chapter.totalChunks}, ${chapter.title}, ${chapter.content}, ${chapter.wordCount})
        RETURNING id, book_id as "bookId", chapter_number as "chapterNumber",
                  chunk_number as "chunkNumber", total_chunks as "totalChunks",
                  title, content, word_count as "wordCount", loop_id as "loopId",
                  created_at as "createdAt"
      `
      results.push(result[0] as Chapter)
    }
    return results
  },

  async findByBookId(bookId: string): Promise<Chapter[]> {
    const result = await sql`
      SELECT id, book_id as "bookId", chapter_number as "chapterNumber",
             chunk_number as "chunkNumber", total_chunks as "totalChunks",
             title, content, word_count as "wordCount", loop_id as "loopId",
             created_at as "createdAt"
      FROM chapters
      WHERE book_id = ${bookId}
      ORDER BY chapter_number ASC, chunk_number ASC
    `
    return result as Chapter[]
  },

  async findById(id: string): Promise<Chapter | null> {
    const result = await sql`
      SELECT id, book_id as "bookId", chapter_number as "chapterNumber",
             chunk_number as "chunkNumber", total_chunks as "totalChunks",
             title, content, word_count as "wordCount", loop_id as "loopId",
             created_at as "createdAt"
      FROM chapters
      WHERE id = ${id}
    `
    return result[0] as Chapter | null
  },

  async linkLoop(chapterId: string, loopId: string): Promise<Chapter | null> {
    const result = await sql`
      UPDATE chapters
      SET loop_id = ${loopId}
      WHERE id = ${chapterId}
      RETURNING id, book_id as "bookId", chapter_number as "chapterNumber",
                chunk_number as "chunkNumber", total_chunks as "totalChunks",
                title, content, word_count as "wordCount", loop_id as "loopId",
                created_at as "createdAt"
    `
    return result[0] as Chapter | null
  }
}

// ============================================
// V4: Knowledge Graph & Prior Knowledge Queries
// ============================================

export const conceptQueries = {
  async create(data: {
    name: string
    description?: string
    category?: string
  }): Promise<Concept> {
    const normalizedName = data.name.toLowerCase().trim()
    const result = await sql`
      INSERT INTO concepts (name, normalized_name, description, category)
      VALUES (${data.name}, ${normalizedName}, ${data.description || null}, ${data.category || null})
      ON CONFLICT (normalized_name) DO UPDATE SET
        name = EXCLUDED.name,
        description = COALESCE(EXCLUDED.description, concepts.description)
      RETURNING id, name, normalized_name as "normalizedName", description, category,
                created_at as "createdAt"
    `
    return result[0] as Concept
  },

  async findByNormalizedName(normalizedName: string): Promise<Concept | null> {
    const result = await sql`
      SELECT id, name, normalized_name as "normalizedName", description, category,
             created_at as "createdAt"
      FROM concepts
      WHERE normalized_name = ${normalizedName.toLowerCase().trim()}
    `
    return result[0] as Concept | null
  },

  async findById(id: string): Promise<Concept | null> {
    const result = await sql`
      SELECT id, name, normalized_name as "normalizedName", description, category,
             created_at as "createdAt"
      FROM concepts
      WHERE id = ${id}
    `
    return result[0] as Concept | null
  },

  async findAll(): Promise<Concept[]> {
    const result = await sql`
      SELECT id, name, normalized_name as "normalizedName", description, category,
             created_at as "createdAt"
      FROM concepts
      ORDER BY created_at DESC
    `
    return result as Concept[]
  },

  async findByIds(ids: string[]): Promise<Concept[]> {
    if (ids.length === 0) return []
    const result = await sql`
      SELECT id, name, normalized_name as "normalizedName", description, category,
             created_at as "createdAt"
      FROM concepts
      WHERE id = ANY(${ids})
    `
    return result as Concept[]
  }
}

export const userConceptQueries = {
  async create(userId: string, conceptId: string): Promise<UserConcept> {
    const result = await sql`
      INSERT INTO user_concepts (user_id, concept_id, mastery_score, times_encountered, last_seen_at)
      VALUES (${userId}, ${conceptId}, 0, 1, NOW())
      ON CONFLICT (user_id, concept_id) DO UPDATE SET
        times_encountered = user_concepts.times_encountered + 1,
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING id, user_id as "userId", concept_id as "conceptId",
                mastery_score as "masteryScore", times_encountered as "timesEncountered",
                times_demonstrated as "timesDemonstrated", last_seen_at as "lastSeenAt",
                last_demonstrated_at as "lastDemonstratedAt",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as UserConcept
  },

  async findByUserAndConcept(userId: string, conceptId: string): Promise<UserConcept | null> {
    const result = await sql`
      SELECT id, user_id as "userId", concept_id as "conceptId",
             mastery_score as "masteryScore", times_encountered as "timesEncountered",
             times_demonstrated as "timesDemonstrated", last_seen_at as "lastSeenAt",
             last_demonstrated_at as "lastDemonstratedAt",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM user_concepts
      WHERE user_id = ${userId} AND concept_id = ${conceptId}
    `
    return result[0] as UserConcept | null
  },

  async findByUserId(userId: string): Promise<UserConcept[]> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt"
      FROM user_concepts uc
      WHERE uc.user_id = ${userId}
      ORDER BY uc.mastery_score DESC
    `
    return result as UserConcept[]
  },

  async findByUserIdWithConcepts(userId: string): Promise<Array<UserConcept & {
    conceptName: string
    conceptDescription: string | null
    conceptCategory: string | null
  }>> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt",
             c.name as "conceptName", c.description as "conceptDescription", c.category as "conceptCategory"
      FROM user_concepts uc
      JOIN concepts c ON c.id = uc.concept_id
      WHERE uc.user_id = ${userId}
      ORDER BY uc.mastery_score DESC
    `
    return result as Array<UserConcept & {
      conceptName: string
      conceptDescription: string | null
      conceptCategory: string | null
    }>
  },

  async updateMastery(
    userId: string,
    conceptId: string,
    masteryScore: number,
    demonstrated: boolean
  ): Promise<UserConcept | null> {
    if (demonstrated) {
      const result = await sql`
        UPDATE user_concepts
        SET mastery_score = ${masteryScore},
            times_demonstrated = times_demonstrated + 1,
            last_demonstrated_at = NOW(),
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ${userId} AND concept_id = ${conceptId}
        RETURNING id, user_id as "userId", concept_id as "conceptId",
                  mastery_score as "masteryScore", times_encountered as "timesEncountered",
                  times_demonstrated as "timesDemonstrated", last_seen_at as "lastSeenAt",
                  last_demonstrated_at as "lastDemonstratedAt",
                  created_at as "createdAt", updated_at as "updatedAt"
      `
      return result[0] as UserConcept | null
    } else {
      const result = await sql`
        UPDATE user_concepts
        SET mastery_score = ${masteryScore},
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ${userId} AND concept_id = ${conceptId}
        RETURNING id, user_id as "userId", concept_id as "conceptId",
                  mastery_score as "masteryScore", times_encountered as "timesEncountered",
                  times_demonstrated as "timesDemonstrated", last_seen_at as "lastSeenAt",
                  last_demonstrated_at as "lastDemonstratedAt",
                  created_at as "createdAt", updated_at as "updatedAt"
      `
      return result[0] as UserConcept | null
    }
  },

  async upsertProgress(
    userId: string,
    conceptId: string,
    data: {
      masteryScore: number
      timesEncountered: number
      timesDemonstrated: number
      demonstrated: boolean
    }
  ): Promise<UserConcept> {
    const result = await sql`
      INSERT INTO user_concepts (user_id, concept_id, mastery_score, times_encountered, times_demonstrated, last_seen_at, last_demonstrated_at)
      VALUES (
        ${userId},
        ${conceptId},
        ${data.masteryScore},
        ${data.timesEncountered},
        ${data.timesDemonstrated},
        NOW(),
        CASE WHEN ${data.demonstrated} THEN NOW() ELSE NULL END
      )
      ON CONFLICT (user_id, concept_id) DO UPDATE SET
        mastery_score = ${data.masteryScore},
        times_encountered = ${data.timesEncountered},
        times_demonstrated = ${data.timesDemonstrated},
        last_seen_at = NOW(),
        last_demonstrated_at = CASE WHEN ${data.demonstrated} THEN NOW() ELSE user_concepts.last_demonstrated_at END,
        updated_at = NOW()
      RETURNING id, user_id as "userId", concept_id as "conceptId",
                mastery_score as "masteryScore", times_encountered as "timesEncountered",
                times_demonstrated as "timesDemonstrated", last_seen_at as "lastSeenAt",
                last_demonstrated_at as "lastDemonstratedAt",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as UserConcept
  },

  // Concepts that need review: low mastery OR not seen recently
  async getNeedsReview(userId: string, limit: number = 5): Promise<UserConcept[]> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt"
      FROM user_concepts uc
      WHERE uc.user_id = ${userId}
        AND (uc.mastery_score < 60 OR uc.last_seen_at < NOW() - INTERVAL '7 days')
        AND uc.times_encountered > 0
      ORDER BY
        CASE WHEN uc.last_seen_at < NOW() - INTERVAL '7 days' THEN 0 ELSE 1 END,
        uc.mastery_score ASC
      LIMIT ${limit}
    `
    return result as UserConcept[]
  },

  async getNeedsReviewWithConcepts(userId: string, limit: number = 5): Promise<Array<UserConcept & {
    conceptName: string
    conceptCategory: string | null
  }>> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt",
             c.name as "conceptName", c.category as "conceptCategory"
      FROM user_concepts uc
      JOIN concepts c ON c.id = uc.concept_id
      WHERE uc.user_id = ${userId}
        AND (uc.mastery_score < 60 OR uc.last_seen_at < NOW() - INTERVAL '7 days')
        AND uc.times_encountered > 0
      ORDER BY
        CASE WHEN uc.last_seen_at < NOW() - INTERVAL '7 days' THEN 0 ELSE 1 END,
        uc.mastery_score ASC
      LIMIT ${limit}
    `
    return result as Array<UserConcept & { conceptName: string; conceptCategory: string | null }>
  },

  // Recently learned concepts (last 7 days)
  async getRecentProgress(userId: string, limit: number = 5): Promise<UserConcept[]> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt"
      FROM user_concepts uc
      WHERE uc.user_id = ${userId}
        AND uc.last_seen_at >= NOW() - INTERVAL '7 days'
      ORDER BY uc.last_seen_at DESC
      LIMIT ${limit}
    `
    return result as UserConcept[]
  },

  async getRecentProgressWithConcepts(userId: string, limit: number = 5): Promise<Array<UserConcept & {
    conceptName: string
    conceptCategory: string | null
  }>> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt",
             c.name as "conceptName", c.category as "conceptCategory"
      FROM user_concepts uc
      JOIN concepts c ON c.id = uc.concept_id
      WHERE uc.user_id = ${userId}
        AND uc.last_seen_at >= NOW() - INTERVAL '7 days'
      ORDER BY uc.last_seen_at DESC
      LIMIT ${limit}
    `
    return result as Array<UserConcept & { conceptName: string; conceptCategory: string | null }>
  },

  // Weak spots: seen multiple times but still low mastery
  async getWeakSpots(userId: string, limit: number = 5): Promise<UserConcept[]> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt"
      FROM user_concepts uc
      WHERE uc.user_id = ${userId}
        AND uc.times_encountered >= 2
        AND uc.mastery_score < 50
      ORDER BY uc.times_encountered DESC, uc.mastery_score ASC
      LIMIT ${limit}
    `
    return result as UserConcept[]
  },

  async getWeakSpotsWithConcepts(userId: string, limit: number = 5): Promise<Array<UserConcept & {
    conceptName: string
    conceptCategory: string | null
  }>> {
    const result = await sql`
      SELECT uc.id, uc.user_id as "userId", uc.concept_id as "conceptId",
             uc.mastery_score as "masteryScore", uc.times_encountered as "timesEncountered",
             uc.times_demonstrated as "timesDemonstrated", uc.last_seen_at as "lastSeenAt",
             uc.last_demonstrated_at as "lastDemonstratedAt",
             uc.created_at as "createdAt", uc.updated_at as "updatedAt",
             c.name as "conceptName", c.category as "conceptCategory"
      FROM user_concepts uc
      JOIN concepts c ON c.id = uc.concept_id
      WHERE uc.user_id = ${userId}
        AND uc.times_encountered >= 2
        AND uc.mastery_score < 50
      ORDER BY uc.times_encountered DESC, uc.mastery_score ASC
      LIMIT ${limit}
    `
    return result as Array<UserConcept & { conceptName: string; conceptCategory: string | null }>
  },

  async getStats(userId: string): Promise<{
    totalConcepts: number
    averageMastery: number
    masteredCount: number
    learningCount: number
    newCount: number
  }> {
    const result = await sql`
      SELECT
        COUNT(*) as "totalConcepts",
        COALESCE(AVG(mastery_score * (
          CASE
            WHEN last_seen_at IS NULL THEN 0.25
            WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN 1.0
            WHEN last_seen_at >= NOW() - INTERVAL '14 days' THEN 0.9
            WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN 0.75
            WHEN last_seen_at >= NOW() - INTERVAL '60 days' THEN 0.5
            ELSE 0.25
          END
        )), 0) as "averageMastery",
        COUNT(*) FILTER (WHERE mastery_score * (
          CASE
            WHEN last_seen_at IS NULL THEN 0.25
            WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN 1.0
            WHEN last_seen_at >= NOW() - INTERVAL '14 days' THEN 0.9
            WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN 0.75
            WHEN last_seen_at >= NOW() - INTERVAL '60 days' THEN 0.5
            ELSE 0.25
          END
        ) >= 80) as "masteredCount",
        COUNT(*) FILTER (WHERE mastery_score * (
          CASE
            WHEN last_seen_at IS NULL THEN 0.25
            WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN 1.0
            WHEN last_seen_at >= NOW() - INTERVAL '14 days' THEN 0.9
            WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN 0.75
            WHEN last_seen_at >= NOW() - INTERVAL '60 days' THEN 0.5
            ELSE 0.25
          END
        ) >= 40 AND mastery_score * (
          CASE
            WHEN last_seen_at IS NULL THEN 0.25
            WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN 1.0
            WHEN last_seen_at >= NOW() - INTERVAL '14 days' THEN 0.9
            WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN 0.75
            WHEN last_seen_at >= NOW() - INTERVAL '60 days' THEN 0.5
            ELSE 0.25
          END
        ) < 80) as "learningCount",
        COUNT(*) FILTER (WHERE mastery_score * (
          CASE
            WHEN last_seen_at IS NULL THEN 0.25
            WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN 1.0
            WHEN last_seen_at >= NOW() - INTERVAL '14 days' THEN 0.9
            WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN 0.75
            WHEN last_seen_at >= NOW() - INTERVAL '60 days' THEN 0.5
            ELSE 0.25
          END
        ) < 40) as "newCount"
      FROM user_concepts
      WHERE user_id = ${userId}
    `
    const row = result[0]
    return {
      totalConcepts: parseInt(row.totalConcepts as string) || 0,
      averageMastery: parseFloat(row.averageMastery as string) || 0,
      masteredCount: parseInt(row.masteredCount as string) || 0,
      learningCount: parseInt(row.learningCount as string) || 0,
      newCount: parseInt(row.newCount as string) || 0
    }
  }
}

export const conceptRelationshipQueries = {
  async upsert(
    fromConceptId: string,
    toConceptId: string,
    relationshipType: RelationshipType,
    strength: number = 1.0
  ): Promise<ConceptRelationshipRecord> {
    const result = await sql`
      INSERT INTO concept_relationships (from_concept_id, to_concept_id, relationship_type, strength)
      VALUES (${fromConceptId}, ${toConceptId}, ${relationshipType}, ${strength})
      ON CONFLICT (from_concept_id, to_concept_id, relationship_type) DO UPDATE SET
        strength = EXCLUDED.strength
      RETURNING id, from_concept_id as "fromConceptId", to_concept_id as "toConceptId",
                relationship_type as "relationshipType", strength, created_at as "createdAt"
    `
    return result[0] as ConceptRelationshipRecord
  },

  async ensure(
    fromConceptId: string,
    toConceptId: string,
    relationshipType: RelationshipType,
    strength: number = 1.0
  ): Promise<ConceptRelationshipRecord | null> {
    const result = await sql`
      INSERT INTO concept_relationships (from_concept_id, to_concept_id, relationship_type, strength)
      VALUES (${fromConceptId}, ${toConceptId}, ${relationshipType}, ${strength})
      ON CONFLICT (from_concept_id, to_concept_id, relationship_type) DO NOTHING
      RETURNING id, from_concept_id as "fromConceptId", to_concept_id as "toConceptId",
                relationship_type as "relationshipType", strength, created_at as "createdAt"
    `
    return result[0] as ConceptRelationshipRecord | null
  },

  async incrementStrength(
    fromConceptId: string,
    toConceptId: string,
    relationshipType: RelationshipType,
    increment: number = 1.0
  ): Promise<ConceptRelationshipRecord> {
    const result = await sql`
      INSERT INTO concept_relationships (from_concept_id, to_concept_id, relationship_type, strength)
      VALUES (${fromConceptId}, ${toConceptId}, ${relationshipType}, ${increment})
      ON CONFLICT (from_concept_id, to_concept_id, relationship_type) DO UPDATE SET
        strength = concept_relationships.strength + ${increment}
      RETURNING id, from_concept_id as "fromConceptId", to_concept_id as "toConceptId",
                relationship_type as "relationshipType", strength, created_at as "createdAt"
    `
    return result[0] as ConceptRelationshipRecord
  },

  async findByConceptId(conceptId: string): Promise<ConceptRelationshipRecord[]> {
    const result = await sql`
      SELECT id, from_concept_id as "fromConceptId", to_concept_id as "toConceptId",
             relationship_type as "relationshipType", strength, created_at as "createdAt"
      FROM concept_relationships
      WHERE from_concept_id = ${conceptId} OR to_concept_id = ${conceptId}
    `
    return result as ConceptRelationshipRecord[]
  },

  async findForUserGraph(userId: string): Promise<ConceptRelationshipRecord[]> {
    const result = await sql`
      SELECT r.id, r.from_concept_id as "fromConceptId", r.to_concept_id as "toConceptId",
             r.relationship_type as "relationshipType", r.strength, r.created_at as "createdAt"
      FROM concept_relationships r
      JOIN user_concepts uc_from
        ON uc_from.concept_id = r.from_concept_id AND uc_from.user_id = ${userId}
      JOIN user_concepts uc_to
        ON uc_to.concept_id = r.to_concept_id AND uc_to.user_id = ${userId}
    `
    return result as ConceptRelationshipRecord[]
  },

  async findRelatedForUser(conceptId: string, userId: string): Promise<Array<{
    relationshipType: RelationshipType
    strength: number
    direction: 'outgoing' | 'incoming'
    conceptId: string
    conceptName: string
    conceptDescription: string | null
    conceptCategory: string | null
    masteryScore: number | null
    timesEncountered: number | null
    lastSeenAt: Date | null
  }>> {
    const result = await sql`
      SELECT
        r.relationship_type as "relationshipType",
        r.strength,
        CASE WHEN r.from_concept_id = ${conceptId} THEN 'outgoing' ELSE 'incoming' END as "direction",
        c.id as "conceptId",
        c.name as "conceptName",
        c.description as "conceptDescription",
        c.category as "conceptCategory",
        uc.mastery_score as "masteryScore",
        uc.times_encountered as "timesEncountered",
        uc.last_seen_at as "lastSeenAt"
      FROM concept_relationships r
      JOIN concepts c ON c.id = CASE WHEN r.from_concept_id = ${conceptId} THEN r.to_concept_id ELSE r.from_concept_id END
      LEFT JOIN user_concepts uc ON uc.concept_id = c.id AND uc.user_id = ${userId}
      WHERE r.from_concept_id = ${conceptId} OR r.to_concept_id = ${conceptId}
    `
    return result as Array<{
      relationshipType: RelationshipType
      strength: number
      direction: 'outgoing' | 'incoming'
      conceptId: string
      conceptName: string
      conceptDescription: string | null
      conceptCategory: string | null
      masteryScore: number | null
      timesEncountered: number | null
      lastSeenAt: Date | null
    }>
  },

  async findAll(): Promise<ConceptRelationshipRecord[]> {
    const result = await sql`
      SELECT id, from_concept_id as "fromConceptId", to_concept_id as "toConceptId",
             relationship_type as "relationshipType", strength, created_at as "createdAt"
      FROM concept_relationships
    `
    return result as ConceptRelationshipRecord[]
  }
}

export const loopConceptQueries = {
  // Find concepts that appear in multiple loops (cross-connections)
  async getCrossConnections(userId: string, limit: number = 5): Promise<{
    conceptId: string
    loopCount: number
    loopIds: string[]
  }[]> {
    const result = await sql`
      SELECT
        lc.concept_id as "conceptId",
        COUNT(DISTINCT lc.loop_id) as "loopCount",
        ARRAY_AGG(DISTINCT lc.loop_id) as "loopIds"
      FROM loop_concepts lc
      JOIN learning_loops ll ON ll.id = lc.loop_id
      WHERE ll.user_id = ${userId}
      GROUP BY lc.concept_id
      HAVING COUNT(DISTINCT lc.loop_id) >= 2
      ORDER BY COUNT(DISTINCT lc.loop_id) DESC
      LIMIT ${limit}
    `
    return result as { conceptId: string; loopCount: number; loopIds: string[] }[]
  },

  async link(
    loopId: string,
    conceptId: string,
    importance: ConceptImportance,
    extractedExplanation?: string
  ): Promise<LoopConcept> {
    const result = await sql`
      INSERT INTO loop_concepts (loop_id, concept_id, importance, extracted_explanation)
      VALUES (${loopId}, ${conceptId}, ${importance}, ${extractedExplanation || null})
      ON CONFLICT (loop_id, concept_id) DO UPDATE SET
        importance = EXCLUDED.importance,
        extracted_explanation = COALESCE(EXCLUDED.extracted_explanation, loop_concepts.extracted_explanation)
      RETURNING id, loop_id as "loopId", concept_id as "conceptId",
                importance, extracted_explanation as "extractedExplanation",
                was_demonstrated as "wasDemonstrated", demonstrated_at as "demonstratedAt",
                demonstrated_in_phase as "demonstratedInPhase",
                created_at as "createdAt"
    `
    return result[0] as LoopConcept
  },

  async findByLoopId(loopId: string): Promise<LoopConcept[]> {
    const result = await sql`
      SELECT id, loop_id as "loopId", concept_id as "conceptId",
             importance, extracted_explanation as "extractedExplanation",
             was_demonstrated as "wasDemonstrated", demonstrated_at as "demonstratedAt",
             demonstrated_in_phase as "demonstratedInPhase",
             created_at as "createdAt"
      FROM loop_concepts
      WHERE loop_id = ${loopId}
    `
    return result as LoopConcept[]
  },

  async markDemonstrated(loopId: string, conceptId: string, phase: LoopPhase): Promise<LoopConcept | null> {
    const result = await sql`
      UPDATE loop_concepts
      SET was_demonstrated = TRUE,
          demonstrated_at = NOW(),
          demonstrated_in_phase = ${phase}
      WHERE loop_id = ${loopId} AND concept_id = ${conceptId}
      RETURNING id, loop_id as "loopId", concept_id as "conceptId",
                importance, extracted_explanation as "extractedExplanation",
                was_demonstrated as "wasDemonstrated", demonstrated_at as "demonstratedAt",
                demonstrated_in_phase as "demonstratedInPhase",
                created_at as "createdAt"
    `
    return result[0] as LoopConcept | null
  },

  async findByConceptId(conceptId: string): Promise<LoopConcept[]> {
    const result = await sql`
      SELECT id, loop_id as "loopId", concept_id as "conceptId",
             importance, extracted_explanation as "extractedExplanation",
             was_demonstrated as "wasDemonstrated", demonstrated_at as "demonstratedAt",
             demonstrated_in_phase as "demonstratedInPhase",
             created_at as "createdAt"
      FROM loop_concepts
      WHERE concept_id = ${conceptId}
    `
    return result as LoopConcept[]
  }
}

// Add prior knowledge update function to learning loops
export const priorKnowledgeQueries = {
  async update(
    loopId: string,
    transcript: string,
    analysis: PriorKnowledgeAnalysis,
    score: number
  ): Promise<LearningLoop | null> {
    const result = await sql`
      UPDATE learning_loops
      SET prior_knowledge_transcript = ${transcript},
          prior_knowledge_analysis = ${JSON.stringify(analysis)},
          prior_knowledge_score = ${score},
          current_phase = 'first_attempt',
          updated_at = NOW()
      WHERE id = ${loopId}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_type as "sourceType",
                source_word_count as "sourceWordCount", precision,
                key_concepts as "keyConcepts", concept_map as "conceptMap",
                status, current_phase as "currentPhase",
                prior_knowledge_transcript as "priorKnowledgeTranscript",
                prior_knowledge_analysis as "priorKnowledgeAnalysis",
                prior_knowledge_score as "priorKnowledgeScore",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as LearningLoop | null
  },

  async skip(loopId: string): Promise<LearningLoop | null> {
    const result = await sql`
      UPDATE learning_loops
      SET prior_knowledge_score = 0,
          current_phase = 'first_attempt',
          updated_at = NOW()
      WHERE id = ${loopId}
      RETURNING id, user_id as "userId", subject_id as "subjectId", title,
                source_text as "sourceText", source_type as "sourceType",
                source_word_count as "sourceWordCount", precision,
                key_concepts as "keyConcepts", concept_map as "conceptMap",
                status, current_phase as "currentPhase",
                prior_knowledge_transcript as "priorKnowledgeTranscript",
                prior_knowledge_analysis as "priorKnowledgeAnalysis",
                prior_knowledge_score as "priorKnowledgeScore",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as LearningLoop | null
  }
}
