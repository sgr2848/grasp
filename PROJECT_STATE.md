# Retention Trainer - Project State (MVP)

> Last updated: January 2026

## Overview

**Retention Trainer** is a voice-based comprehension testing application. Users paste text they've consumed (articles, meeting notes, podcasts, etc.), explain it back verbally, and receive AI-powered feedback on what they retained vs. missed.

---

## Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7.3
- **Styling**: Tailwind CSS 4
- **Routing**: React Router 7
- **Auth**: Clerk (React SDK)

### Backend
- **Runtime**: Node.js with Express 5.2
- **Database**: Neon PostgreSQL (serverless)
- **AI Services**: OpenAI APIs (Whisper, GPT-4o, TTS)
- **Auth Verification**: Clerk JWT

---

## Database Schema

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │◄──────────────────────────────────┐
│ selected_persona│                                   │
│ tts_enabled     │                                   │
│ is_paid         │                                   │
│ created_at      │                                   │
└─────────────────┘                                   │
        │                                             │
        │ 1:N                                         │
        ▼                                             │
┌─────────────────┐                                   │
│   workspaces    │                                   │
├─────────────────┤                                   │
│ id (PK)         │◄──────────┐                       │
│ user_id (FK)    │───────────┼───────────────────────┘
│ name            │           │
│ description     │           │
│ created_at      │           │
│ updated_at      │           │
└─────────────────┘           │
        │                     │
        │ 1:N                 │
        ▼                     │
┌─────────────────┐           │
│    subjects     │           │
├─────────────────┤           │
│ id (PK)         │◄──────┐   │
│ workspace_id(FK)│───────┼───┘
│ name            │       │
│ description     │       │
│ created_at      │       │
│ updated_at      │       │
└─────────────────┘       │
                          │
┌─────────────────┐       │
│    sessions     │       │
├─────────────────┤       │
│ id (PK)         │◄──────┼───────────────┐
│ user_id (FK)    │       │               │
│ subject_id (FK) │───────┘               │
│ title           │                       │
│ source_text     │                       │
│ source_word_cnt │                       │
│ source_type     │ (article/meeting/etc) │
│ transcript      │                       │
│ duration_seconds│                       │
│ score           │                       │
│ persona         │                       │
│ key_points_count│                       │
│ covered_count   │                       │
│ missed_count    │                       │
│ analysis (JSONB)│                       │
│ created_at      │                       │
└─────────────────┘                       │
                                          │
┌─────────────────┐                       │
│  conversations  │                       │
├─────────────────┤                       │
│ id (PK)         │                       │
│ session_id (FK) │───────────────────────┘
│ messages (JSONB)│
│ created_at      │
│ updated_at      │
└─────────────────┘

┌─────────────────┐
│     books       │ (EPUB imports)
├─────────────────┤
│ id (PK)         │◄──────────┐
│ user_id (FK)    │           │
│ title           │           │
│ author          │           │
│ description     │           │
│ cover_url       │           │
│ total_chapters  │           │
│ completed_chaps │           │
│ created_at      │           │
│ updated_at      │           │
└─────────────────┘           │
        │                     │
        │ 1:N                 │
        ▼                     │
┌─────────────────┐           │
│    chapters     │           │
├─────────────────┤           │
│ id (PK)         │           │
│ book_id (FK)    │───────────┘
│ chapter_number  │
│ title           │
│ content         │
│ word_count      │
│ loop_id (FK)    │ → learning_loops
│ created_at      │
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│    concepts     │     │  user_concepts  │ (Knowledge Graph)
├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ concept_id (FK) │
│ name            │     │ user_id (FK)    │
│ normalized_name │     │ mastery_score   │ (0-100)
│ description     │     │ times_encountered│
│ category        │     │ times_demonstrated│
│ created_at      │     │ last_seen_at    │
└─────────────────┘     │ created_at      │
        │               └─────────────────┘
        │
        ▼
┌─────────────────────────┐     ┌─────────────────┐
│ concept_relationships   │     │  loop_concepts  │
├─────────────────────────┤     ├─────────────────┤
│ id (PK)                 │     │ id (PK)         │
│ from_concept_id (FK)    │     │ loop_id (FK)    │
│ to_concept_id (FK)      │     │ concept_id (FK) │
│ relationship_type       │     │ importance      │
│ strength                │     │ extracted_expl  │
│ created_at              │     │ created_at      │
└─────────────────────────┘     └─────────────────┘
```

### Source Types
- `article` - Written articles, blog posts
- `meeting` - Meeting notes, transcripts
- `podcast` - Podcast episode summaries
- `video` - Video content summaries
- `book` - Book chapters, excerpts
- `lecture` - Educational lectures
- `other` - Anything else

---

## API Endpoints

### Authentication
All endpoints (except health) require Clerk JWT in `Authorization: Bearer <token>` header.

### User Routes (`/api/user`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/preferences` | Get user preferences (persona, TTS settings) |
| PATCH | `/preferences` | Update user preferences |
| GET | `/personas` | List all personas with availability |
| GET | `/subjects` | Get all subjects across all workspaces |

### Session Routes (`/api/sessions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all user sessions |
| GET | `/:id` | Get session details with analysis |
| POST | `/` | Create new session after evaluation |

### Workspace Routes (`/api/workspaces`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's workspaces |
| GET | `/:id` | Get workspace with its subjects |
| POST | `/` | Create workspace |
| PATCH | `/:id` | Update workspace |
| DELETE | `/:id` | Delete workspace |
| POST | `/:id/subjects` | Create subject in workspace |
| PATCH | `/:id/subjects/:subjectId` | Update subject |
| DELETE | `/:id/subjects/:subjectId` | Delete subject |

### Chat Routes (`/api/chat`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:sessionId` | Get conversation for session |
| POST | `/:sessionId` | Send message, get AI response |
| POST | `/:sessionId/start` | Start follow-up conversation |

### AI Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transcribe` | Whisper audio transcription |
| POST | `/api/evaluate` | GPT-4o comprehension evaluation |
| POST | `/api/tts` | OpenAI TTS generation |

### Book Routes (`/api/books`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all user's books |
| GET | `/:id` | Get book with chapters and progress |
| POST | `/upload` | Upload and parse EPUB file |
| DELETE | `/:id` | Delete book and all chapters |
| GET | `/:id/chapters/:chapterId` | Get chapter content |
| POST | `/:id/chapters/:chapterId/start-loop` | Create learning loop for chapter |

### Knowledge Routes (`/api/knowledge`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/graph` | Get full knowledge graph (nodes + edges) for visualization |
| GET | `/concepts` | List user's concepts with mastery scores |
| GET | `/concepts/:id` | Get single concept with related concepts |
| GET | `/stats` | Get aggregate mastery statistics |
| GET | `/insights` | Get actionable insights (needs review, weak spots, etc.) |

---

## Frontend Pages

### 1. Dashboard Page (`/dashboard`) - Learning Hub

**Features:**

- Streak tracking with localStorage persistence
- Weekly activity visualization (7-day dots)
- Stats cards: Mastered topics, In Progress loops
- Due reviews section with quick links
- Recent activity feed with loop status badges
- Knowledge stats card (total concepts, mastered count)
- Empty state with welcome message for new users

### 2. Train Page (`/train`) - Main Feature
**Flow:**
1. User pastes source text
2. Selects source type (article, meeting, podcast, etc.)
3. Optionally links to a subject
4. Records verbal explanation (max 3 minutes)
5. Receives score + detailed feedback

**Features:**
- Real-time recording timer with warnings at 2:00 and auto-stop at 3:00
- Word count indicator with warning for long texts (>1500 words)
- Persona selector (Coach, Professor, Drill Sergeant, Hype Friend, Chill Tutor)
- Voice feedback using TTS (browser or OpenAI)
- Results show: score ring, coverage %, accuracy %, covered points, missed points
- Speech quality metrics (filler words, pace, clarity score)
- Conversational follow-up chat for missed points

### 2. History Page (`/history`)
- Lists all past sessions with scores
- Expandable details showing transcript, feedback, covered/missed points
- Speech quality metrics for each session
- Source type badges

### 3. Workspaces Page (`/workspaces`)
- Create/edit/delete workspaces
- Create/edit/delete subjects within workspaces
- Two-panel layout (workspace list + details)

### 4. Settings Page (`/settings`)
- Persona preference selection
- TTS toggle (enable/disable voice feedback)
- TTS provider selection (Browser vs OpenAI)
- OpenAI voice selection (alloy, echo, fable, onyx, nova, shimmer)

### 5. Books Page (`/books`)

- Upload EPUB files
- List all imported books with progress
- Progress bar showing completed chapters
- Delete books

### 6. Book Detail Page (`/books/:id`)

- Book metadata (title, author, description)
- Chapter list with status indicators (not started, in progress, completed)
- Start/Continue buttons to launch learning loops
- Progress tracking across all chapters

### 7. Home Page (`/`)
- Landing/marketing page

### 8. Knowledge Page (`/knowledge`)

**Features:**

- Stats overview: Total concepts, average mastery, mastered count, in progress
- **Review Soon**: Concepts with low mastery or not seen recently
- **Recent Progress**: Concepts from the last 7 days
- **Weak Spots**: Concepts seen multiple times but still struggling
- **Cross Connections**: Concepts appearing across multiple learning sessions
- **Knowledge Map**: Interactive force-directed graph visualization
  - Node colors indicate mastery level (green/blue/amber/red)
  - Edges show concept relationships
  - Drag to pan, scroll to zoom
- Empty state for new users with link to start learning

---

## Personas System

5 AI personas with distinct feedback styles:

| Persona | Tone | Paid? |
|---------|------|-------|
| **Coach** | Encouraging, supportive, warm | Free |
| **Professor** | Neutral, academic, precise | Free |
| **Drill Sergeant** | Tough love, no excuses, harsh | Free |
| **Hype Friend** | Over-the-top positive, excited | Free |
| **Chill Tutor** | Relaxed, casual, low-key | Free |

Each persona has:
- Unique system prompt for GPT-4o evaluation
- Welcome message
- Ready-to-record message
- Processing message
- TTS voice (for OpenAI TTS)

---

## Speech Quality Analysis

Client-side analysis of transcripts:

### Metrics Tracked
1. **Filler Words**: um, uh, like, you know, I mean, basically, literally, kind of, sort of, right, okay, so, yeah
2. **Hedge Words**: maybe, perhaps, I think, I guess, probably, might be
3. **Speaking Pace**: Words per minute (ideal: 120-160 WPM)
4. **Repeated Phrases**: Detects phrases repeated 2+ times
5. **Clarity Score**: 0-100 composite score

### Pace Ratings
- `too slow`: < 100 WPM
- `slow`: 100-120 WPM
- `good`: 120-160 WPM
- `fast`: 160-180 WPM
- `too fast`: > 180 WPM

---

## TTS (Text-to-Speech) System

### Two Providers
1. **Browser TTS**: Free, uses Web Speech API
2. **OpenAI TTS**: Higher quality, costs money per request

### Cost Optimization
Pre-recorded static audio files for persona messages:
- Welcome messages
- Ready-to-record messages
- Processing messages

**15 audio files** in `/apps/web/public/audio/personas/`:
```
coach-welcome.mp3, coach-ready.mp3, coach-processing.mp3
professor-welcome.mp3, professor-ready.mp3, professor-processing.mp3
sergeant-welcome.mp3, sergeant-ready.mp3, sergeant-processing.mp3
hype-welcome.mp3, hype-ready.mp3, hype-processing.mp3
chill-welcome.mp3, chill-ready.mp3, chill-processing.mp3
```

When OpenAI TTS is selected, static messages play from local files (free). Dynamic content (results feedback) still uses API.

---

## Conversational Follow-up

After receiving results, users can have a chat conversation about missed points:

1. Click "Discuss missed points" to start
2. AI generates contextual follow-up question about missed content
3. User can respond via text or voice
4. AI tracks which missed points are addressed
5. Badge shows remaining missed points count

Conversation history is stored in `conversations` table.

---

## File Structure

```
retension/
├── apps/
│   ├── api/                      # Express.js Backend
│   │   └── src/
│   │       ├── db/
│   │       │   ├── client.ts     # Neon PostgreSQL connection
│   │       │   ├── migrate.ts    # Database migrations
│   │       │   └── queries.ts    # SQL query functions
│   │       ├── middleware/
│   │       │   └── auth.ts       # Clerk JWT verification
│   │       ├── routes/
│   │       │   ├── books.ts      # EPUB book import endpoints
│   │       │   ├── chat.ts       # Follow-up conversation endpoints
│   │       │   ├── evaluate.ts   # GPT-4o evaluation endpoint
│   │       │   ├── knowledge.ts  # Knowledge graph & insights endpoints
│   │       │   ├── sessions.ts   # Session CRUD endpoints
│   │       │   ├── transcribe.ts # Whisper transcription endpoint
│   │       │   ├── tts.ts        # OpenAI TTS endpoint
│   │       │   ├── user.ts       # User preferences endpoints
│   │       │   └── workspaces.ts # Workspace/subject CRUD
│   │       ├── services/
│   │       │   ├── knowledge.ts  # Knowledge graph updates on loop completion
│   │       │   ├── chat.ts       # Chat AI logic
│   │       │   ├── epub.ts       # EPUB parsing service
│   │       │   ├── llm.ts        # OpenAI client + evaluation logic
│   │       │   ├── personas.ts   # Persona configurations
│   │       │   ├── tts.ts        # TTS generation logic
│   │       │   └── whisper.ts    # Audio transcription logic
│   │       ├── types/
│   │       │   └── index.ts      # TypeScript type definitions
│   │       └── index.ts          # Express app entry point
│   └── web/                      # React Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/           # Reusable UI components
│       │   │   │   ├── AnimatedScoreRing.tsx # Score with count-up animation
│       │   │   │   ├── Badge.tsx
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── Card.tsx
│       │   │   │   ├── ScoreRing.tsx # Static score circle
│       │   │   │   ├── Spinner.tsx
│       │   │   │   └── Switch.tsx
│       │   │   ├── empty-states/ # Empty state components
│       │   │   │   ├── EmptyHistory.tsx # No history welcome
│       │   │   │   └── EmptyLearn.tsx   # First-time learning guide
│       │   │   ├── ChatPanel.tsx # Follow-up conversation UI
│       │   │   ├── Confetti.tsx  # Celebration animation
│       │   │   ├── Layout.tsx    # App shell with navigation
│       │   │   ├── LoopProgress.tsx # Step progress indicator
│       │   │   ├── LoopResultsPanel.tsx # Results display with animation
│       │   │   ├── RecordingEncouragement.tsx # Recording tips & encouragements
│       │   │   ├── SocraticChat.tsx # Fill gaps chat interface
│       │   │   └── SpeechMetrics.tsx # Filler words/pace display
│       │   ├── context/
│       │   │   ├── PreferencesContext.tsx # User preferences state
│       │   │   └── TTSContext.tsx        # TTS state and controls
│       │   ├── hooks/
│       │   │   ├── useAuth.ts       # Clerk auth wrapper
│       │   │   └── useRecorder.ts   # Audio recording hook
│       │   ├── lib/
│       │   │   ├── api.ts           # Backend API client
│       │   │   ├── audio.ts         # Audio utilities
│       │   │   ├── cn.ts            # Class name utility
│       │   │   ├── format.ts        # Formatting helpers
│       │   │   ├── personas.ts      # Persona config (frontend)
│       │   │   ├── speechAnalysis.ts # Filler word detection
│       │   │   └── tts.ts           # TTS controller
│       │   ├── pages/
│       │   │   ├── App.tsx          # Test page (quick retention test)
│       │   │   ├── Book.tsx         # Book detail with chapters
│       │   │   ├── Books.tsx        # Book list and EPUB upload
│       │   │   ├── Dashboard.tsx    # Learning hub with stats
│       │   │   ├── History.tsx      # Past sessions list
│       │   │   ├── Home.tsx         # Landing page
│       │   │   ├── Knowledge.tsx    # Knowledge graph & insights
│       │   │   ├── Learn.tsx        # Feynman loop learning flow
│       │   │   ├── Review.tsx       # Spaced repetition review
│       │   │   ├── Settings.tsx     # User settings
│       │   │   └── Workspaces.tsx   # Workspace management
│       │   ├── App.tsx              # Router configuration
│       │   └── main.tsx             # React entry point
│       ├── public/
│       │   └── audio/
│       │       └── personas/        # Pre-recorded TTS audio (15 files)
│       ├── scripts/
│       │   └── generate-audio.ts    # Script to generate persona audio
│       ├── index.html
│       ├── package.json             # Frontend dependencies
│       ├── vite.config.ts
│       └── tsconfig.json
└── package.json
```

---

## Environment Variables

### Frontend (`apps/web/.env`)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=http://localhost:3001/api
```

### Backend (`apps/api/.env`)
```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
```

---

## What's Working (MVP Status)

### Core Features
- [x] User authentication (Clerk)
- [x] Paste source text with word count
- [x] Source type selection (article, meeting, podcast, etc.)
- [x] Audio recording with timer (max 3 minutes)
- [x] Whisper transcription
- [x] GPT-4o comprehension evaluation
- [x] Score calculation (coverage + accuracy weighted)
- [x] Detailed feedback with covered/missed points
- [x] TTS voice feedback (browser + OpenAI)
- [x] Pre-recorded static audio for cost savings
- [x] Session history with expandable details
- [x] 5 distinct AI personas
- [x] User preferences (persona, TTS settings)

### Organization Features
- [x] Workspaces (create, edit, delete)
- [x] Subjects within workspaces
- [x] Link sessions to subjects
- [x] Source type categorization

### Speech Quality
- [x] Filler word detection and counting
- [x] Hedge word detection
- [x] Speaking pace (WPM) calculation
- [x] Repeated phrase detection
- [x] Clarity score
- [x] Personalized tips based on analysis

### Follow-up Learning
- [x] Conversational follow-up chat
- [x] AI-generated questions about missed points
- [x] Conversation history persistence
- [x] Voice input for chat responses

### UX Improvements (Jan 2026)

- [x] Dashboard page with stats, streaks, weekly progress
- [x] Empty states with onboarding guidance
- [x] Recording encouragements (dynamic messages during recording)
- [x] Animated score ring with count-up animation
- [x] Confetti celebration on loop completion
- [x] Two-column layout for Socratic chat (concepts + source material)
- [x] Collapsible panels in chat interface
- [x] Improved loop progress stepper with even connector lines
- [x] Score journey visualization on completion

### EPUB Book Import (Jan 2026)

- [x] EPUB file upload and parsing
- [x] Automatic chapter extraction from EPUB
- [x] Book metadata extraction (title, author, description)
- [x] Chapter-by-chapter learning with progress tracking
- [x] Integration with existing Feynman loop system
- [x] Book and chapter progress visualization

### Knowledge Graph (Jan 2026)

- [x] Normalized concept storage across learning sessions
- [x] User mastery tracking per concept (0-100 score)
- [x] Recency decay applied to mastery in graph/insights/statistics
- [x] Concept relationships (prerequisites, related, etc.)
- [x] Backfill script for existing learning data
- [x] Actionable insights API (needs review, weak spots, cross-connections)
- [x] Interactive force-directed graph visualization
- [x] Mastery-based node coloring
- [x] Knowledge stats on Dashboard
- [x] Prior knowledge assessment for Book/EPUB Chapter 1 (skipped for paste/quick sessions)
- [x] Prior knowledge context used in evaluation (known/focus/misconceptions)
- [x] Concept linking + mastery updates occur on loop completion (not per attempt)
- [x] Relationship strength increases when related concepts are demonstrated
- [x] Knowledge graph endpoints use bulk joins (no N+1 concept lookups)
- [x] Knowledge UI labels recency-adjusted mastery (graph, stats, pills)

---

## What's NOT Done Yet (Future)

- [ ] PDF book import (similar to EPUB)
- [ ] Mobile responsive polish
- [ ] Waveform visualization during recording
- [ ] Listen mode (TTS playback of source material)
- [ ] Export/share sessions
- [ ] Team/organization features
- [ ] Payment integration for premium
- [ ] More personas
- [ ] Custom persona creation
- [ ] Integration with note-taking apps (Readwise)
- [ ] Browser extension for quick capture
- [ ] Offline mode
- [ ] Rate limiting on API

---

## Running the Project

### Development
```bash
# Terminal 1: Frontend
cd apps/web && npm run dev

# Terminal 2: Backend
cd apps/api && npm run dev
```

### Build
```bash
# Frontend
cd apps/web && npm run build

# Backend
cd apps/api && npm run build
```

### Generate Audio Files
```bash
cd apps/web && OPENAI_API_KEY=your_key npm run generate-audio
```

---

## API Costs (OpenAI)

| Service | Cost | When Used |
|---------|------|-----------|
| Whisper | $0.006/min | Every recording |
| GPT-4o | ~$0.01-0.03/eval | Every evaluation |
| TTS | $0.015/1K chars | Dynamic feedback only |

Pre-recorded audio saves ~$0.01-0.02 per session on static messages.
