# Retention Trainer V1 - Implementation Plan

## V1 Goal

**"Import anything, learn it properly, see your knowledge grow."**

Three additions to complete V1:
1. Content Import (PDF/books + Readwise)
2. Prior Knowledge Assessment
3. Knowledge Graph

---

# Part 1: Content Import

## 1.1 PDF/Book Import

### What It Does
User uploads a PDF. App parses it into chapters. User learns chapter-by-chapter with the existing Feynman loop.

### User Flow
```
Upload PDF
    ↓
App detects chapters/sections
    ↓
"What do you already know about [topic]?" (prior knowledge)
    ↓
"Start with Chapter 1. Come back when you've read it."
    ↓
[Existing Feynman loop per chapter]
    ↓
"Chapter 1 done. Ready for Chapter 2?"
    ↓
[Repeat until book complete]
```

### Data Model

**books**
- id
- user_id
- title
- author (optional, extracted or manual)
- file_url (stored PDF)
- total_chapters
- status (processing, ready, error)
- created_at

**chapters**
- id
- book_id
- chapter_number
- title
- content (extracted text)
- word_count
- status (not_started, in_progress, mastered)

**book_progress**
- id
- user_id
- book_id
- current_chapter_id
- prior_knowledge_transcript
- prior_knowledge_analysis (JSONB)
- started_at
- completed_at

### API Endpoints

`POST /api/books/upload`
- Accepts PDF
- Queues processing
- Returns book ID

`GET /api/books/:id`
- Returns book with chapters and progress

`GET /api/books`
- List user's books

`DELETE /api/books/:id`
- Remove book and all related data

### PDF Parsing Requirements
- Extract full text
- Detect chapter boundaries (headings, "Chapter X", page patterns)
- Handle table of contents if present
- Fallback: split by page count if no chapters detected

### Frontend

**New page: `/books`**
- List of imported books
- Upload button
- Progress indicator per book

**New page: `/books/:id`**
- Book overview
- Chapter list with status
- "Continue Learning" button
- Prior knowledge summary (if completed)

**Update Learn.tsx**
- Accept book_id and chapter_id params
- Show "Chapter X of Y" context
- "Next Chapter" CTA on completion
- Link back to book overview

---

## 1.2 Readwise Integration

### What It Does
User connects Readwise. App syncs their highlights. User can test retention on any book's highlights.

### User Flow
```
Connect Readwise (paste API token)
    ↓
App syncs highlights, groups by book
    ↓
"You have 47 highlights from 'Atomic Habits'. Test yourself?"
    ↓
"What do you remember about this book?" (prior knowledge)
    ↓
[Feynman loop on the highlights as source material]
```

### Data Model

**integrations**
- id
- user_id
- provider (readwise)
- access_token (encrypted)
- last_synced_at
- status (active, error, disconnected)

**readwise_books**
- id
- user_id
- integration_id
- external_id (Readwise book ID)
- title
- author
- highlight_count
- last_synced_at

**readwise_highlights**
- id
- readwise_book_id
- external_id
- content (highlight text)
- note (user's note, if any)
- location
- highlighted_at

### API Endpoints

`POST /api/integrations/readwise/connect`
- Validates token
- Stores encrypted
- Triggers initial sync

`POST /api/integrations/readwise/sync`
- Pulls new highlights since last sync

`POST /api/integrations/readwise/disconnect`
- Removes token and optionally data

`GET /api/readwise/books`
- List synced books with highlight counts

`GET /api/readwise/books/:id`
- Get book with all highlights

`POST /api/readwise/books/:id/learn`
- Creates learning session from highlights

### Readwise API Notes
- Uses simple token auth (no OAuth)
- Rate limits are generous
- Endpoints: /highlights, /books
- Pagination required for large libraries

### Frontend

**Settings addition**
- "Connect Readwise" section
- Token input
- Sync status and last synced time
- Disconnect option

**New page: `/readwise`**
- List of synced books
- Highlight count per book
- "Learn This" button per book
- Manual sync button

**Integration with Learn.tsx**
- Readwise highlights become source_text
- Grouped highlights as learning material

---

# Part 2: Prior Knowledge Assessment

## What It Does
Before learning any new content, ask: "What do you already know about this?"

Personalizes the learning path - skip what they know, focus on gaps.

## User Flow
```
User starts learning [book/chapter/content]
    ↓
"Before we dive in - what do you already know about [topic]?"
    ↓
User records explanation (60-90 seconds)
    ↓
AI analyzes:
  - Concepts they understand → skip
  - Partial understanding → note for later
  - Gaps → focus here
  - Misconceptions → correct
    ↓
"You understand X and Y. Focus on Z when reading."
    ↓
Proceed to reading/learning
```

## When to Trigger
- First chapter of a new book (required)
- Readwise book review (required)
- Regular paste sessions (optional, can skip)

## AI Prompt Requirements

Input: Topic/content summary + user's prior knowledge transcript

Output:
- Concepts they understand (skip these)
- Partial understanding (probe later)
- Gaps (focus areas)
- Misconceptions (things to correct)
- Personalized focus areas for reading

## Data Storage

Add to book_progress / sessions:
- prior_knowledge_transcript
- prior_knowledge_analysis (JSONB)
- focus_areas (derived from analysis)

## API Endpoint

`POST /api/assess-prior-knowledge`
- Input: topic, content_summary, transcript
- Output: analysis with focus areas

## Frontend

**New component: PriorKnowledgeStep**
- Shows topic/content preview
- Recording interface (reuse existing recorder)
- Results display with focus areas
- "Got it, let's start" button

**Integration with Learn.tsx**
- New phase before first_attempt (for books/readwise)
- Optional for quick paste sessions
- Display focus areas during "go read" prompt

---

# Part 3: Knowledge Graph

## What It Does
Extracts concepts from everything you learn. Shows connections. Tracks mastery. Identifies gaps.

## Concept Extraction

For every piece of content (chapter, article, highlights), extract:
- Concepts (ideas, principles, frameworks)
- Entities (people, companies, specific things)  
- Relationships (how concepts connect)
- Domain (what field this belongs to)

### When to Extract
- On book import (per chapter)
- On Readwise sync (per book's highlights)
- On session creation (from source_text)

## Data Model

**concepts**
- id
- name (normalized)
- description
- domain (psychology, tech, business, etc.)
- concept_type (framework, principle, entity, etc.)

**user_concepts**
- user_id
- concept_id
- mastery_score (0-100)
- times_encountered
- times_explained_correctly
- first_seen_at
- last_seen_at

**concept_relationships**
- from_concept_id
- to_concept_id
- relationship_type (prerequisite, related, part_of, contrasts_with, causes)
- strength (how often seen together)

**session_concepts**
- session_id
- concept_id
- was_in_source
- was_covered_in_explanation
- was_accurate

## Mastery Tracking

Update mastery when user completes a session:
- Concept was in source + covered accurately → increase mastery
- Concept was in source + missed → note gap
- Recency matters → mastery decays if not reviewed

## API Endpoints

`GET /api/knowledge-graph`
- Returns user's full graph (nodes + edges)
- Filter by domain optional

`GET /api/knowledge-graph/stats`
- Total concepts, mastered count, domains

`GET /api/knowledge-graph/gaps`
- Concepts connected to known things but not yet learned

`GET /api/knowledge-graph/concept/:id`
- Details + related sessions

## Frontend

**New page: `/knowledge`**
- Force-directed graph visualization
- Nodes = concepts (sized by mastery)
- Edges = relationships
- Color by domain
- Click node for details
- Filter/search

**Dashboard addition**
- "Your Knowledge" stats card
- X concepts, Y mastered
- Link to full graph

**Post-session addition**
- "Concepts from this session"
- "This connects to X you learned before"
- New concepts highlighted

## Visualization

Keep simple for V1:
- Force-directed layout
- Zoom/pan
- Click to select
- Domain filtering
- Search

Don't over-engineer. Basic D3 or react-force-graph is fine.

---

# Build Order

## Week 1: PDF Import + Prior Knowledge

**Days 1-2: PDF Infrastructure**
- Upload endpoint with file storage
- PDF text extraction
- Chapter detection logic
- Book/chapter tables and queries

**Days 3-4: Book Learning Flow**
- `/books` list page
- `/books/:id` detail page
- Chapter progression in Learn.tsx
- "Next chapter" flow

**Days 5-6: Prior Knowledge**
- Assessment endpoint
- New step in Learn.tsx (before first_attempt)
- Focus areas display
- Store results

**Day 7: Edge Cases**
- PDFs without clear chapters
- Very long chapters (split?)
- Error handling

## Week 2: Knowledge Graph

**Days 1-2: Extraction**
- Concept extraction prompt
- Run on new sessions/chapters
- Deduplication logic
- Store concepts + relationships

**Days 3-4: Mastery Tracking**
- Update scores on session complete
- Link sessions to concepts
- Decay over time

**Days 5-6: Visualization**
- `/knowledge` page
- Graph component
- Node/edge rendering
- Basic interactions

**Day 7: Integration**
- Dashboard card
- Post-session concept summary
- "This connects to..." messaging

## Week 3: Readwise + Polish

**Days 1-3: Readwise**
- Connection flow in settings
- Sync endpoint
- Books/highlights storage
- `/readwise` page
- Learn from highlights flow

**Days 4-7: Polish**
- Error states everywhere
- Loading states
- Empty states
- Mobile check
- Bug fixes
- Performance (large graphs)

---

# Success Criteria

## Functional
- [ ] Upload PDF → learn chapter by chapter
- [ ] Connect Readwise → learn from highlights
- [ ] Prior knowledge shapes focus areas
- [ ] Graph shows all concepts
- [ ] Concepts connect across sources

## Quality
- [ ] 80%+ of PDFs parse correctly
- [ ] Graph handles 100+ nodes smoothly
- [ ] No broken states

## Experience
- [ ] Feels like guided learning, not testing
- [ ] Graph creates "it's all connected" moment
- [ ] Obvious value for Readwise users

---

# Out of Scope (V2+)

- YouTube/podcast integration
- Pocket/Instapaper
- Custom concepts
- Social/shared graphs
- Personalized forgetting curves
- Advanced analytics
- Mobile app
- Offline mode

Ship V1. Get users. Then iterate.
