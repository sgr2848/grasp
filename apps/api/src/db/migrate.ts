import { sql } from './client.js'

export async function runMigrations() {
  console.log('Running migrations...')

  // Create users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      selected_persona TEXT DEFAULT 'coach',
      tts_enabled BOOLEAN DEFAULT true,
      is_paid BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Create workspaces table
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Create subjects table (belongs to workspace)
  await sql`
    CREATE TABLE IF NOT EXISTS subjects (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Create sessions table with enhanced schema
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,

      -- Source content
      title TEXT,
      source_text TEXT NOT NULL,
      source_word_count INTEGER,
      source_type TEXT DEFAULT 'article',

      -- User's explanation
      transcript TEXT,
      duration_seconds INTEGER,

      -- Evaluation results
      score INTEGER,
      persona TEXT NOT NULL,
      key_points_count INTEGER,
      covered_count INTEGER,
      missed_count INTEGER,

      -- Full analysis JSON
      analysis JSONB,

      -- Metadata
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Create conversations table for follow-up discussions
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      messages JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // ============================================
  // V2: Feynman Learning Loop Tables
  // ============================================

  // Learning loops track multiple attempts at the same content
  await sql`
    CREATE TABLE IF NOT EXISTS learning_loops (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,

      -- Source content
      title TEXT,
      source_text TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'article',
      source_word_count INTEGER,

      -- AI-extracted structure
      key_concepts JSONB,
      concept_map JSONB,

      -- Loop state
      status TEXT NOT NULL DEFAULT 'in_progress',
      current_phase TEXT NOT NULL DEFAULT 'first_attempt',

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Attempts within a loop
  await sql`
    CREATE TABLE IF NOT EXISTS loop_attempts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      loop_id UUID NOT NULL REFERENCES learning_loops(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL,
      attempt_type TEXT NOT NULL,

      -- Recording
      transcript TEXT,
      duration_seconds INTEGER,

      -- Evaluation
      score INTEGER,
      coverage DECIMAL(3,2),
      accuracy DECIMAL(3,2),
      analysis JSONB,

      -- Speech quality
      speech_metrics JSONB,

      -- Comparison to previous attempt
      score_delta INTEGER,
      newly_covered TEXT[],

      persona TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Socratic dialogues for learning phase
  await sql`
    CREATE TABLE IF NOT EXISTS socratic_sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      loop_id UUID NOT NULL REFERENCES learning_loops(id) ON DELETE CASCADE,
      attempt_id UUID REFERENCES loop_attempts(id) ON DELETE SET NULL,

      -- Focus
      target_concepts TEXT[],

      -- Conversation
      messages JSONB NOT NULL DEFAULT '[]',

      -- Progress
      concepts_addressed TEXT[],
      status TEXT DEFAULT 'active',

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Spaced repetition schedule
  await sql`
    CREATE TABLE IF NOT EXISTS review_schedule (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      loop_id UUID NOT NULL REFERENCES learning_loops(id) ON DELETE CASCADE,

      -- Schedule
      next_review_at TIMESTAMP NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 1,

      -- History
      times_reviewed INTEGER DEFAULT 0,
      last_reviewed_at TIMESTAMP,
      last_score INTEGER,

      -- State
      status TEXT DEFAULT 'scheduled',

      created_at TIMESTAMP DEFAULT NOW(),

      -- Unique constraint: one schedule per loop
      UNIQUE(loop_id)
    )
  `

  // Add columns if they don't exist (for existing databases)
  await sql`
    DO $$
    BEGIN
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_word_count INTEGER;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS key_points_count INTEGER;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS covered_count INTEGER;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS missed_count INTEGER;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'article';
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // Create indexes for faster queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_score ON sessions(score)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON sessions(subject_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_subjects_workspace_id ON subjects(workspace_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id)
  `

  // V2: Learning loop indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_learning_loops_user_id ON learning_loops(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_learning_loops_status ON learning_loops(status)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_learning_loops_subject_id ON learning_loops(subject_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_loop_attempts_loop_id ON loop_attempts(loop_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_socratic_sessions_loop_id ON socratic_sessions(loop_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedule_user_id ON review_schedule(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedule_next_review ON review_schedule(next_review_at)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedule_status ON review_schedule(status)
  `

  // ============================================
  // V3: EPUB Book Import Tables
  // ============================================

  // Books table - stores imported EPUB metadata
  await sql`
    CREATE TABLE IF NOT EXISTS books (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      author TEXT,
      description TEXT,
      cover_url TEXT,
      total_chapters INTEGER NOT NULL DEFAULT 0,
      completed_chapters INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Chapters table - stores extracted chapter content (with chunking support)
  await sql`
    CREATE TABLE IF NOT EXISTS chapters (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_number INTEGER NOT NULL,
      chunk_number INTEGER NOT NULL DEFAULT 1,
      total_chunks INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      loop_id UUID REFERENCES learning_loops(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Add columns for existing databases
  await sql`
    DO $$
    BEGIN
      ALTER TABLE books ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS epub_key TEXT;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS last_read_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL;
      ALTER TABLE chapters ADD COLUMN IF NOT EXISTS chunk_number INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE chapters ADD COLUMN IF NOT EXISTS total_chunks INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE learning_loops ADD COLUMN IF NOT EXISTS precision TEXT NOT NULL DEFAULT 'balanced';
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // Indexes for books
  await sql`
    CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_books_subject_id ON books(subject_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chapters_loop_id ON chapters(loop_id)
  `

  // ============================================
  // V4: Knowledge Graph & Prior Knowledge Tables
  // ============================================

  // Global concept registry - concepts are reusable across loops
  await sql`
    CREATE TABLE IF NOT EXISTS concepts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Unique constraint on normalized_name for deduplication
  await sql`
    DO $$
    BEGIN
      ALTER TABLE concepts ADD CONSTRAINT concepts_normalized_name_unique UNIQUE (normalized_name);
    EXCEPTION WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
    END $$;
  `

  // User mastery tracking per concept
  await sql`
    CREATE TABLE IF NOT EXISTS user_concepts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,

      mastery_score INTEGER NOT NULL DEFAULT 0,
      times_encountered INTEGER NOT NULL DEFAULT 0,
      times_demonstrated INTEGER NOT NULL DEFAULT 0,

      last_seen_at TIMESTAMP,
      last_demonstrated_at TIMESTAMP,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Unique constraint on user_id + concept_id
  await sql`
    DO $$
    BEGIN
      ALTER TABLE user_concepts ADD CONSTRAINT user_concepts_unique UNIQUE (user_id, concept_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
    END $$;
  `

  // Relationships between concepts
  await sql`
    CREATE TABLE IF NOT EXISTS concept_relationships (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      from_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      to_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      strength DECIMAL(3,2) DEFAULT 1.0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Unique constraint on relationship
  await sql`
    DO $$
    BEGIN
      ALTER TABLE concept_relationships ADD CONSTRAINT concept_relationships_unique
        UNIQUE (from_concept_id, to_concept_id, relationship_type);
    EXCEPTION WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
    END $$;
  `

  // Link between loops and concepts
  await sql`
    CREATE TABLE IF NOT EXISTS loop_concepts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      loop_id UUID NOT NULL REFERENCES learning_loops(id) ON DELETE CASCADE,
      concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      importance TEXT NOT NULL DEFAULT 'supporting',
      extracted_explanation TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Unique constraint on loop_id + concept_id
  await sql`
    DO $$
    BEGIN
      ALTER TABLE loop_concepts ADD CONSTRAINT loop_concepts_unique UNIQUE (loop_id, concept_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
    END $$;
  `

  // Demonstration metadata for loop concepts
  await sql`
    DO $$
    BEGIN
      ALTER TABLE loop_concepts ADD COLUMN IF NOT EXISTS was_demonstrated BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE loop_concepts ADD COLUMN IF NOT EXISTS demonstrated_at TIMESTAMP;
      ALTER TABLE loop_concepts ADD COLUMN IF NOT EXISTS demonstrated_in_phase TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // Add prior knowledge columns to learning_loops
  await sql`
    DO $$
    BEGIN
      ALTER TABLE learning_loops ADD COLUMN IF NOT EXISTS prior_knowledge_transcript TEXT;
      ALTER TABLE learning_loops ADD COLUMN IF NOT EXISTS prior_knowledge_analysis JSONB;
      ALTER TABLE learning_loops ADD COLUMN IF NOT EXISTS prior_knowledge_score INTEGER;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // Add metadata column to learning_loops for YouTube and other source-specific data
  await sql`
    DO $$
    BEGIN
      ALTER TABLE learning_loops ADD COLUMN IF NOT EXISTS metadata JSONB;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // ============================================
  // V5: Usage Limits
  // ============================================

  // Add usage tracking columns to users table
  await sql`
    DO $$
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loops_used_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_usage_reset_at TIMESTAMP DEFAULT NOW();
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // ============================================
  // V6: Tiered Pricing & Monthly Usage
  // ============================================

  // Add monthly usage tracking and subscription tier columns
  await sql`
    DO $$
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loops_used_this_month INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_reset_month DATE DEFAULT DATE_TRUNC('month', NOW());
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `

  // Index for subscription tier queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier)
  `

  // V4: Knowledge Graph indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_concepts_normalized_name ON concepts(normalized_name)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_concepts_category ON concepts(category)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_concepts_user_id ON user_concepts(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_concepts_concept_id ON user_concepts(concept_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_concepts_mastery ON user_concepts(mastery_score)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_concept_relationships_from ON concept_relationships(from_concept_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_concept_relationships_to ON concept_relationships(to_concept_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_loop_concepts_loop_id ON loop_concepts(loop_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_loop_concepts_concept_id ON loop_concepts(concept_id)
  `

  console.log('Migrations complete!')
}

// Run if called directly
runMigrations().catch(console.error)
