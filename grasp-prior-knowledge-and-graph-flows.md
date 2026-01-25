# Grasp - Prior Knowledge & Knowledge Graph Flows

## Part 1: Prior Knowledge Assessment

### Purpose

Before learning new content, understand what the user already knows so we can:
1. Tell them what to focus on
2. Skip wasting time on things they know
3. Identify misconceptions to correct
4. Make the Feynman evaluation smarter

### When to Trigger

| Content Type | Trigger Prior Knowledge? |
|--------------|-------------------------|
| Book (first chapter) | Yes, required |
| Book (subsequent chapters) | No, unless new topic |
| Readwise highlights | Yes, required |
| Paste (article/meeting) | Optional (skip button) |

### The Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRIOR KNOWLEDGE FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STEP 1: TOPIC PREVIEW                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Chapter 1: The Two Systems"                            │    │
│  │                                                         │    │
│  │ This chapter covers:                                    │    │
│  │ • How the mind uses two different modes of thinking    │    │
│  │ • When each system activates                           │    │
│  │ • Why this matters for decision-making                 │    │
│  │                                                         │    │
│  │ [Continue] or [I know nothing about this, skip →]      │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                              │                        │
│         ▼                              ▼                        │
│    Continue                     Skip (go straight to reading)   │
│         │                                                       │
│  STEP 2: RECORD PRIOR KNOWLEDGE                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │ "What do you already know about how humans think       │    │
│  │  and make decisions?"                                   │    │
│  │                                                         │    │
│  │ Just talk for a minute. No pressure to be complete.    │    │
│  │                                                         │    │
│  │              🎤 [Record - up to 90 seconds]             │    │
│  │                                                         │    │
│  │ Or: [I really don't know anything, skip →]             │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│  STEP 3: AI ANALYSIS (loading state ~5 seconds)                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │           "Mapping what you know..."                    │    │
│  │                    ⟳                                    │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│  STEP 4: FOCUS AREAS                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │ "Here's what I'm seeing:"                              │    │
│  │                                                         │    │
│  │ ✓ You know:                                            │    │
│  │   • Cognitive biases exist                             │    │
│  │   • Confirmation bias concept                          │    │
│  │                                                         │    │
│  │ ~ Fuzzy on:                                            │    │
│  │   • System 1 vs System 2 (you've heard of it)         │    │
│  │                                                         │    │
│  │ ✗ New to you:                                          │    │
│  │   • Heuristics                                         │    │
│  │   • Cognitive ease                                     │    │
│  │                                                         │    │
│  │ ─────────────────────────────────────────────────────  │    │
│  │                                                         │    │
│  │ 📍 FOCUS ON:                                           │    │
│  │                                                         │    │
│  │ "Pay attention to the DIFFERENCE between System 1     │    │
│  │  and System 2 - you know they exist but not how       │    │
│  │  they're different. Also watch for 'heuristics' -     │    │
│  │  that's a key term."                                   │    │
│  │                                                         │    │
│  │ "You can skim the basic bias examples since you       │    │
│  │  already get that concept."                           │    │
│  │                                                         │    │
│  │              [Got it, I'll go read now →]              │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│  STEP 5: READING PROMPT                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │ "Go read Chapter 1."                                   │    │
│  │                                                         │    │
│  │ 📖 ~15 min read · 3,200 words                         │    │
│  │                                                         │    │
│  │ Remember: Focus on System 1 vs 2 differences          │    │
│  │                                                         │    │
│  │            [I've finished reading →]                   │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│  [FEYNMAN LOOP - existing flow]                                │
│  But evaluation is now aware of:                                │
│  - What they already knew (don't reward for this)              │
│  - What they were supposed to focus on (weight this higher)    │
│  - Misconceptions to check (did they correct them?)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AI Analysis Prompt

**Input:**
- Topic/chapter summary
- User's prior knowledge transcript
- Key concepts that will be in the content (pre-extracted or from chapter)

**Output (JSON):**
```json
{
  "known_concepts": [
    {
      "concept": "cognitive biases",
      "confidence": "solid",
      "evidence": "User correctly explained that biases are systematic errors in thinking"
    }
  ],
  "fuzzy_concepts": [
    {
      "concept": "System 1 and System 2",
      "issue": "Mentioned but couldn't explain the difference",
      "clarification_needed": "Focus on HOW they differ, not just that they exist"
    }
  ],
  "unknown_concepts": [
    "heuristics",
    "cognitive ease",
    "anchoring effect"
  ],
  "misconceptions": [
    {
      "claim": "User said biases are always bad",
      "correction": "Biases are often useful shortcuts, not always errors"
    }
  ],
  "focus_areas": [
    "The difference between System 1 (fast, automatic) and System 2 (slow, deliberate)",
    "What 'heuristics' means - it's a key term throughout the book"
  ],
  "skip_areas": [
    "Basic examples of biases - you already understand this concept"
  ]
}
```

### How It Affects Feynman Evaluation

Pass prior knowledge context to the evaluation:

```
When evaluating, consider:

USER ALREADY KNEW:
- Cognitive biases (solid understanding)

USER WAS TOLD TO FOCUS ON:
- System 1 vs System 2 differences
- Heuristics definition

MISCONCEPTIONS TO CHECK:
- User thought biases are always bad (they're not)

SCORING ADJUSTMENTS:
- Don't give full credit for explaining cognitive biases (they already knew)
- Weight System 1/2 explanation higher (this was the focus)
- Check if they corrected the misconception about biases
```

---

## Part 2: Knowledge Graph

### Purpose

Build a visual map of everything you've learned that:
1. Shows what you know and how well
2. Reveals connections between concepts
3. Identifies gaps and weak spots
4. Feels like progress, not clutter

### Design Principles

1. **Quality over quantity** - 5-10 meaningful concepts per chapter, not 50 generic ones
2. **Mastery is earned** - Mentioning something once ≠ knowing it
3. **Decay is real** - Knowledge you haven't touched fades
4. **Connections matter** - The graph should reveal relationships you didn't see
5. **Actionable** - Always answer "so what should I do?"

### Concept Extraction

**What makes a good concept:**
- Specific enough to test ("System 1 thinking" not "thinking")
- Important to the source material
- Stands alone (understandable without context)
- Can be explained in 1-2 sentences

**Extraction prompt should produce:**

```json
{
  "concepts": [
    {
      "name": "System 1 Thinking",
      "description": "Fast, automatic, intuitive mental processing that requires no effort",
      "importance": "core",
      "category": "cognitive-science"
    },
    {
      "name": "System 2 Thinking", 
      "description": "Slow, deliberate, effortful mental processing used for complex tasks",
      "importance": "core",
      "category": "cognitive-science"
    },
    {
      "name": "Cognitive Ease",
      "description": "The feeling when information is processed fluently, leading to acceptance",
      "importance": "supporting",
      "category": "cognitive-science"
    }
  ],
  "relationships": [
    {
      "from": "System 1 Thinking",
      "to": "System 2 Thinking",
      "type": "contrasts_with",
      "explanation": "Two opposing modes of thought"
    },
    {
      "from": "Cognitive Ease",
      "to": "System 1 Thinking",
      "type": "activates",
      "explanation": "Cognitive ease keeps us in System 1"
    }
  ]
}
```

**Importance levels:**
- `core` - Central to the chapter, must understand
- `supporting` - Important context, helps understanding
- `detail` - Nice to know, not essential

Only extract 5-10 per chapter. Resist the urge to capture everything.

### Mastery Scoring

**Mastery is NOT:**
- Binary (know it / don't know it)
- Based on one mention
- Static

**Mastery IS:**
- A score from 0-100
- Based on demonstrated understanding
- Decays over time without review

**Scoring formula:**

```
base_score = (times_correctly_explained / times_encountered) × 100

recency_factor = based on days since last seen
  - < 7 days: 1.0
  - 7-14 days: 0.9
  - 14-30 days: 0.75
  - 30-60 days: 0.5
  - > 60 days: 0.25

mastery_score = base_score × recency_factor
```

**Mastery levels for display:**

| Score | Level | Color | Meaning |
|-------|-------|-------|---------|
| 80-100 | Mastered | Green | You can explain this well |
| 60-79 | Solid | Light green | Good understanding, some gaps |
| 40-59 | Developing | Yellow | Partial understanding |
| 20-39 | Weak | Orange | Heard of it, can't explain |
| 0-19 | Fading | Red | Needs review or never learned |

### Graph Visualization

**Layout:**
- Force-directed with clustering by domain/book
- Nodes sized by importance (core > supporting > detail)
- Nodes colored by mastery level
- Edges show relationships (styled by type)

**Interaction:**
- Click node → see details panel
- Hover → highlight connected nodes
- Filter by: domain, mastery level, book/source
- Search concepts
- Zoom/pan

**Visual hierarchy:**
```
┌─────────────────────────────────────────────────────────────────┐
│  KNOWLEDGE GRAPH                           [Filter ▼] [Search]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌─────┐                                                      │
│    │     │ Cognitive                                            │
│    │ ███ │ Science        ┌───┐                                │
│    │     │ cluster        │   │ Business                       │
│    └──┬──┘               │ █ │ cluster                        │
│       │                   └───┘                                 │
│       │    ┌─────┐                                              │
│       └────│     │                                              │
│            │ ██  │                                              │
│            └──┬──┘                                              │
│               │         ┌───┐                                   │
│               └─────────│   │                                   │
│                         │ █ │                                   │
│                         └───┘                                   │
│                                                                 │
│  Legend:  ███ = Mastered  ██ = Solid  █ = Developing           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SELECTED: System 1 Thinking                                    │
│  Mastery: 85% (Mastered) · Last seen: 2 days ago               │
│  "Fast, automatic, intuitive mental processing"                │
│                                                                 │
│  Connected to: System 2 Thinking, Cognitive Ease, Heuristics   │
│  Source: Thinking Fast and Slow, Chapter 1                     │
│                                                                 │
│  [Review This Concept]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Insights Panel

Below or beside the graph, show actionable insights:

```
┌─────────────────────────────────────────────────────────────────┐
│  INSIGHTS                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️  NEEDS REVIEW (score dropping)                              │
│  • Anchoring Effect - was 75%, now 52%                         │
│  • Availability Heuristic - was 80%, now 61%                   │
│  [Review These →]                                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  🔗 CROSS-CONNECTIONS                                           │
│  "System 1 Thinking" from Kahneman connects to                 │
│  "Intuitive Decision Making" from your strategy book           │
│  [Explore Connection →]                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📍 SUGGESTED NEXT                                              │
│  Based on what you know, you might want to learn:              │
│  • Prospect Theory (builds on System 1/2)                      │
│  • Behavioral Economics (connects 4 concepts you know)         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  💪 STRONGEST AREAS                                             │
│  • Cognitive Science (8 concepts, avg mastery 78%)             │
│  • Decision Making (5 concepts, avg mastery 71%)               │
│                                                                 │
│  😅 WEAKEST AREAS                                               │
│  • Statistics (3 concepts, avg mastery 34%)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Dashboard Integration

On the main dashboard, show a summary card:

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR KNOWLEDGE                                    [View Graph]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  47 concepts · 12 mastered · 3 domains                         │
│                                                                 │
│  ████████████████░░░░░░░░ 58% average mastery                  │
│                                                                 │
│  ⚠️ 4 concepts need review                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Post-Session Integration

After completing a Feynman loop, show what was learned:

```
┌─────────────────────────────────────────────────────────────────┐
│  CONCEPTS FROM THIS SESSION                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Demonstrated:                                                │
│    • System 1 Thinking (+15 mastery → 85%)                     │
│    • System 2 Thinking (+12 mastery → 78%)                     │
│                                                                 │
│  ✗ Missed:                                                      │
│    • Cognitive Ease (still at 23%)                             │
│    • Heuristics (new, 0%)                                      │
│                                                                 │
│  🔗 New connections:                                            │
│    "System 1" now links to "Intuitive Judgment"                │
│    you learned last week                                       │
│                                                                 │
│                                        [View in Graph →]        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: How They Work Together

### The Full Learning Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. USER IMPORTS BOOK                                           │
│     └─→ Concepts pre-extracted per chapter                     │
│                                                                 │
│  2. USER STARTS CHAPTER 1                                       │
│     └─→ Prior knowledge assessment triggered                   │
│         └─→ Maps what they know vs chapter concepts            │
│         └─→ Outputs focus areas                                │
│                                                                 │
│  3. USER READS CHAPTER                                          │
│     └─→ Focus areas shown as reminder                          │
│                                                                 │
│  4. USER DOES FEYNMAN LOOP                                      │
│     └─→ Evaluation knows prior knowledge context               │
│     └─→ Weights focus areas higher                             │
│     └─→ Checks for misconception corrections                   │
│                                                                 │
│  5. USER COMPLETES LOOP                                         │
│     └─→ Concepts updated in graph                              │
│         └─→ Mastery scores adjusted                            │
│         └─→ Relationships strengthened                         │
│         └─→ New connections surfaced                           │
│     └─→ Post-session concept summary shown                     │
│                                                                 │
│  6. OVER TIME                                                   │
│     └─→ Mastery decays on concepts not reviewed                │
│     └─→ Insights surface what needs attention                  │
│     └─→ Graph grows and reveals cross-book connections         │
│     └─→ User sees their knowledge compound                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Book Import
    │
    ▼
Chapter Content ──→ Concept Extraction ──→ concepts table
    │                                           │
    ▼                                           │
Prior Knowledge ──→ Analysis ──→ known/fuzzy/gaps
    │                               │
    ▼                               │
Focus Areas ◄───────────────────────┘
    │
    ▼
Reading Phase (focus areas displayed)
    │
    ▼
Feynman Loop ──→ Evaluation (with prior knowledge context)
    │                               │
    ▼                               │
Results ◄───────────────────────────┘
    │
    ▼
Update Knowledge Graph
    │
    ├──→ user_concepts (mastery scores)
    ├──→ concept_relationships (strengthen connections)
    └──→ loop_concepts (track what was covered)
    │
    ▼
Surface Insights
    │
    ├──→ Needs review (decaying mastery)
    ├──→ Cross-connections (between books/domains)
    └──→ Suggested next (based on graph gaps)
```

---

## Implementation Checklist

### Prior Knowledge
- [ ] Topic preview step with skip option
- [ ] Recording step (90 sec max)
- [ ] Analysis prompt that outputs structured JSON
- [ ] Focus areas display with known/fuzzy/unknown/misconceptions
- [ ] Pass context to Feynman evaluation
- [ ] Evaluation weights focus areas higher
- [ ] Misconception checking in evaluation

### Knowledge Graph - Extraction
- [ ] Quality extraction prompt (5-10 concepts per chapter)
- [ ] Importance levels (core/supporting/detail)
- [ ] Relationship extraction with types
- [ ] Concept normalization/deduplication
- [ ] Pre-extract on book import

### Knowledge Graph - Mastery
- [ ] Scoring formula with recency decay
- [ ] Update on Feynman completion
- [ ] Track demonstrated vs encountered
- [ ] Mastery levels with colors

### Knowledge Graph - Visualization
- [ ] Force-directed layout with clustering
- [ ] Node sizing by importance
- [ ] Node coloring by mastery
- [ ] Edge styling by relationship type
- [ ] Click to select, show details
- [ ] Filter by domain/mastery/source
- [ ] Search
- [ ] Zoom/pan

### Knowledge Graph - Insights
- [ ] Needs review (decaying scores)
- [ ] Cross-connections (between sources)
- [ ] Suggested next concepts
- [ ] Strongest/weakest areas
- [ ] Dashboard summary card
- [ ] Post-session concept summary

---

## Success Criteria

**Prior Knowledge works if:**
- Users feel like it saves them time (skip what they know)
- Focus areas actually match what they're fuzzy on
- Feynman scores feel more fair (not penalized for prior knowledge)
- < 2 minutes total time for the step

**Knowledge Graph works if:**
- Users look at it and recognize their knowledge
- Concepts are meaningful (not generic garbage)
- Mastery scores feel accurate
- Cross-connections create "aha" moments
- Users check back to see growth
- Insights lead to action (reviews, new learning)

**Together they work if:**
- Learning feels personalized, not one-size-fits-all
- Each session builds on the last
- The graph makes you feel smarter over time
- You can't get this experience from just using ChatGPT
