# Retention Trainer - Build Plan

## Overview

A web app that tests whether you actually understood what you read. Paste text, explain it out loud, get scored on what you retained. Features a conversational TTS experience with selectable personas.

**Tech Stack:**
- Frontend: Vite + React + TypeScript
- Styling: Tailwind CSS
- Auth: Clerk
- Database: Vercel Postgres with Drizzle ORM
- Audio Input: Whisper API (OpenAI)
- Audio Output: Browser SpeechSynthesis API
- LLM: GPT-4o
- Deployment: Vercel

---

## Core Experience Flow

The app feels like a conversation, not a test results screen.

```
1. USER ARRIVES
   TTS: "Hey! Paste something you've been reading and let's see what stuck."

2. USER PASTES TEXT
   TTS: "Got it. Whenever you're ready, hit record and explain it back to me 
         in your own words. No pressure."

3. USER RECORDS EXPLANATION (up to 3 min)
   [Timer running, soft warning at 2:00]

4. USER FINISHES
   TTS: "Alright, let me think about this..."
   [Processing: Whisper transcription → GPT-4o evaluation]

5. RESULTS DELIVERED (conversationally)
   TTS: "Okay! You scored 73 - not bad."
   TTS: "You nailed [covered points summary]."
   TTS: "But you missed [missed points]. That's the stuff to revisit."
   TTS: "Want to try again or tackle something new?"

6. USER CHOOSES
   - "Try Again" → keeps source, clears transcript, back to step 3
   - "New Text" → full reset to step 1
```

---

## Personas (Core Feature)

Persona affects both the written feedback AND the TTS delivery tone.

### Available Personas

| Persona | Vibe | Free/Paid |
|---------|------|-----------|
| Coach | Encouraging, supportive | Free (default) |
| Professor | Neutral, academic | Free |
| Drill Sergeant | Harsh, no BS | Paid |
| Hype Friend | Over the top positive | Paid |
| Chill Tutor | Laid back, casual | Paid |

### Persona Prompt Prefixes

```typescript
// lib/personas.ts

export type Persona = 'coach' | 'professor' | 'sergeant' | 'hype' | 'chill';

export const personaConfig: Record<Persona, {
  name: string;
  description: string;
  promptPrefix: string;
  isPaid: boolean;
}> = {
  coach: {
    name: "Coach",
    description: "Encouraging and supportive",
    promptPrefix: `You are an encouraging learning coach. Be supportive and positive, 
but still honest about what was missed. Use phrases like "solid effort", "you got this", 
"let's work on". Keep feedback warm but constructive.`,
    isPaid: false
  },
  professor: {
    name: "Professor",
    description: "Neutral and academic",
    promptPrefix: `You are a neutral academic professor. Be objective and precise. 
Use formal language. State facts about what was covered and missed without emotional 
language. Keep feedback professional and educational.`,
    isPaid: false
  },
  sergeant: {
    name: "Drill Sergeant",
    description: "Tough love, no excuses",
    promptPrefix: `You are a tough drill sergeant. Be direct and harsh. 
No sugarcoating. Use short, punchy sentences. Call out mistakes bluntly. 
Phrases like "sloppy", "not good enough", "again". Push them to do better.`,
    isPaid: true
  },
  hype: {
    name: "Hype Friend",
    description: "Your biggest fan",
    promptPrefix: `You are an extremely enthusiastic hype friend. Be over-the-top 
positive and excited. Use caps for emphasis, exclamation marks, phrases like 
"YOOO", "literally crushing it", "let's gooo". Make them feel like a genius 
even when pointing out missed stuff.`,
    isPaid: true
  },
  chill: {
    name: "Chill Tutor",
    description: "Relaxed and casual",
    promptPrefix: `You are a laid-back chill tutor. Be super casual and relaxed. 
Use phrases like "yeah pretty much", "no biggie", "you're good". 
Don't make a big deal out of mistakes. Keep it low-key and friendly.`,
    isPaid: true
  }
};
```

### Example Feedback by Persona

**Score: 65, missed 2 key points about "market constraints" and "regulatory timeline"**

| Persona | Feedback |
|---------|----------|
| Coach | "Hey, solid work! You got the main concept down. Let's tighten up on the market constraints and that regulatory timeline next round - you're almost there!" |
| Professor | "You demonstrated comprehension of the primary thesis. However, you omitted discussion of market constraints and the regulatory timeline. Review these sections." |
| Sergeant | "65. You missed market constraints and the regulatory timeline. That's two critical points. Sloppy. Run it again." |
| Hype | "YOOO 65! You understood the CORE thing which is huge! The market constraints and timeline stuff? That's just bonus knowledge waiting for round 2 LET'S GO!" |
| Chill | "Yeah you mostly got it. Missed the market constraints bit and something about timelines but honestly not a big deal. Run it back if you want." |

---

## Database Schema

```typescript
// db/schema.ts
import { pgTable, uuid, text, integer, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  selectedPersona: text('selected_persona').default('coach'),
  ttsEnabled: boolean('tts_enabled').default(true),
  isPaid: boolean('is_paid').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sourceText: text('source_text').notNull(),
  transcript: text('transcript'),
  score: integer('score'),
  persona: text('persona').notNull(),
  analysis: jsonb('analysis'),
  createdAt: timestamp('created_at').defaultNow()
});

// analysis JSON shape:
// {
//   key_points: string[],
//   covered_points: string[],
//   missed_points: string[],
//   coverage: number,
//   accuracy: number,
//   feedback: string,
//   tts_script: {
//     intro: string,
//     score_announcement: string,
//     covered_summary: string,
//     missed_summary: string,
//     closing: string
//   }
// }
```

---

## API Routes

All routes under `/api/`, protected by Clerk auth middleware.

### POST /api/transcribe
- Input: audio file (webm/mp3, max 5MB)
- Process: Send to OpenAI Whisper API
- Output: `{ transcript: string }`

### POST /api/evaluate
- Input: `{ sourceText: string, transcript: string, persona: Persona }`
- Process: 
  1. Extract key points from sourceText (GPT-4o call #1)
  2. Evaluate transcript against key points with persona voice (GPT-4o call #2)
- Output: `{ score: number, analysis: Analysis }`

### GET /api/sessions
- Returns all sessions for authenticated user, ordered by createdAt desc

### POST /api/sessions
- Input: `{ sourceText, transcript, score, persona, analysis }`
- Creates new session record

### GET /api/sessions/:id
- Returns single session by ID (must belong to user)

### GET /api/user/preferences
- Returns user preferences (persona, ttsEnabled)

### PATCH /api/user/preferences
- Input: `{ selectedPersona?: Persona, ttsEnabled?: boolean }`
- Updates user preferences

---

## GPT-4o Prompts

### Prompt 1: Extract Key Points

```
You are analyzing a piece of text to extract its key points for testing comprehension.

Source text:
"""
{sourceText}
"""

Extract 5-10 key points that someone should remember after reading this. Each point must be:
- Self-contained (understandable without the source)
- Factually specific (not vague)
- Max 20 words

Return ONLY valid JSON:
{
  "key_points": ["point 1", "point 2", ...]
}
```

### Prompt 2: Evaluate Explanation (with Persona)

```
{personaPromptPrefix}

You are evaluating a learner's spoken explanation of a text.

Key points they should have covered:
{keyPoints}

Learner's spoken explanation:
"""
{transcript}
"""

Evaluate how well the learner's explanation covers the key points.

For each key point, determine if it was:
- Covered correctly
- Covered but inaccurate  
- Not mentioned

Calculate:
- coverage: (points mentioned / total points) as decimal 0-1
- accuracy: (correctly covered / total covered) as decimal 0-1

Also generate a TTS script for delivering results conversationally. The script should match your persona voice and feel natural when spoken aloud.

Return ONLY valid JSON:
{
  "covered_points": ["points that were mentioned correctly"],
  "missed_points": ["points that were not mentioned"],
  "coverage": 0.0,
  "accuracy": 0.0,
  "feedback": "2-3 sentence written feedback summary",
  "tts_script": {
    "intro": "Short reaction to seeing the results (1 sentence)",
    "score_announcement": "Announce the score with reaction (1 sentence)", 
    "covered_summary": "What they got right (1-2 sentences)",
    "missed_summary": "What they missed (1-2 sentences)",
    "closing": "Encourage retry or moving on (1 sentence)"
  }
}
```

### Score Calculation (in code, not LLM)

```typescript
const score = Math.round((coverage * 0.6 + accuracy * 0.4) * 100);
```

Score is calculated server-side and injected into the TTS script's `{score}` placeholder.

---

## TTS Implementation

### Browser SpeechSynthesis Wrapper

```typescript
// lib/tts.ts

class TTSController {
  private synth: SpeechSynthesis;
  private enabled: boolean = true;
  private queue: string[] = [];
  private speaking: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  async speak(text: string): Promise<void> {
    if (!this.enabled) return;
    
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.synth.speak(utterance);
    });
  }

  async speakSequence(texts: string[]): Promise<void> {
    for (const text of texts) {
      await this.speak(text);
      await this.pause(300); // Brief pause between segments
    }
  }

  private pause(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.synth.cancel();
  }
}

export const tts = new TTSController();
```

### TTS Flow Integration

```typescript
// In App.tsx or session flow component

const deliverResults = async (analysis: Analysis, score: number) => {
  setStep('results');
  
  const script = analysis.tts_script;
  
  // Speak results conversationally
  await tts.speakSequence([
    script.intro,
    script.score_announcement.replace('{score}', score.toString()),
    script.covered_summary,
    script.missed_summary,
    script.closing
  ]);
};
```

---

## Frontend Pages

### 1. Landing/Home (unauthenticated)
- Hero: "Find out if you actually understood what you read"
- Subhead: "Paste. Explain. Get honest feedback."
- Persona preview cards showing the different voices
- CTA: Sign in to start

### 2. Main App (/app)
Single page with state machine managing the flow:

**State: input**
- Persona selector (top right, shows current persona avatar/name)
- TTS toggle (speaker icon)
- Large textarea for pasting source text
- Word count indicator (warn at 1500+ words)
- "Start Recording" button (disabled until text pasted)
- TTS plays welcome prompt when entering this state

**State: recording**
- Source text collapsed/hidden
- Big microphone visualization (pulsing when active)
- Timer counting UP 
- Visual warning when hitting 2:00 (yellow border)
- Hard stop at 3:00
- "Done" button (big, obvious)
- No pause, no redo

**State: processing**
- "Analyzing your explanation..."
- Simple spinner
- TTS: "Alright, let me think about this..."

**State: results**
- Score displayed large (color coded: green 80+, yellow 50-79, red <50)
- Written feedback below
- "What you nailed" section (covered points, green checks)
- "What you missed" section (missed points, orange/red)
- TTS delivers the full script while UI elements animate in
- Two buttons: "Try Again" / "New Text"

**State: error**
- Error message
- "Try Again" button
- TTS: "Hmm, something went wrong. Let's try that again."

### 3. History (/history)
- List of past sessions as cards
- Each card shows: date, first 50 chars of source, score (color coded), persona used
- Click to expand and see full results
- No TTS on this page

### 4. Settings (/settings)
- Persona selector (with preview of each voice)
- TTS on/off toggle
- Account info from Clerk
- Upgrade to paid (if not paid) - unlocks additional personas

---

## Component Structure

```
src/
├── components/
│   ├── Layout.tsx              # Clerk provider, nav, TTS provider
│   ├── PersonaSelector.tsx     # Dropdown/cards to pick persona
│   ├── PersonaAvatar.tsx       # Icon/avatar for each persona
│   ├── SourceInput.tsx         # Textarea with word count
│   ├── AudioRecorder.tsx       # Mic button, timer, visualizer
│   ├── ProcessingState.tsx     # Loading spinner with TTS
│   ├── ScoreDisplay.tsx        # Big animated score number
│   ├── ResultsPanel.tsx        # Full results with covered/missed
│   ├── TTSToggle.tsx           # Speaker icon to enable/disable
│   └── SessionCard.tsx         # For history list
├── pages/
│   ├── Home.tsx                # Landing page
│   ├── App.tsx                 # Main session flow
│   ├── History.tsx             # Past sessions list
│   └── Settings.tsx            # User preferences
├── lib/
│   ├── api.ts                  # Fetch wrappers for all API routes
│   ├── tts.ts                  # SpeechSynthesis wrapper
│   ├── personas.ts             # Persona configs and prompts
│   └── audio.ts                # MediaRecorder helpers
├── hooks/
│   ├── useRecorder.ts          # Audio recording state machine
│   ├── useSession.ts           # Session flow state machine
│   └── useTTS.ts               # TTS context hook
└── context/
    └── TTSContext.tsx          # Global TTS state
```

---

## State Machines

### Session Flow State

```typescript
type SessionState = 
  | { step: 'input' }
  | { step: 'recording'; startTime: number }
  | { step: 'processing' }
  | { step: 'results'; score: number; analysis: Analysis }
  | { step: 'error'; message: string };

type SessionAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; audioBlob: Blob }
  | { type: 'PROCESSING_COMPLETE'; score: number; analysis: Analysis }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };
```

### Audio Recorder State

```typescript
type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped';

interface RecorderContext {
  state: RecorderState;
  audioBlob: Blob | null;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}
```

---

## Environment Variables

```
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# OpenAI
OPENAI_API_KEY=

# Database
DATABASE_URL=

# Optional: Feature flags
VITE_ENABLE_PAID_FEATURES=false
```

---

## Build Order

### Phase 1: Scaffold (Day 1)
1. Init Vite + React + TypeScript project
2. Add Tailwind CSS
3. Set up Clerk auth with sign-in/sign-out
4. Create Vercel Postgres database
5. Set up Drizzle with schema, run migrations
6. Create basic routing (Home, App, History, Settings)
7. Deploy empty shell to Vercel

### Phase 2: TTS Foundation (Day 2)
1. Build TTSController class
2. Create TTSContext provider
3. Build TTSToggle component
4. Test basic TTS with hardcoded messages
5. Add TTS to layout for global access

### Phase 3: Personas (Day 2-3)
1. Create personas.ts with all persona configs
2. Build PersonaSelector component
3. Build PersonaAvatar component
4. Wire up persona selection to user preferences
5. Build /api/user/preferences routes

### Phase 4: Core Recording Flow (Days 3-5)
1. Build SourceInput component with word count
2. Build useRecorder hook with MediaRecorder
3. Build AudioRecorder component with timer
4. Build /api/transcribe route (Whisper)
5. Build /api/evaluate route with persona injection
6. Wire up full flow: paste → record → transcribe → evaluate
7. Test with all personas

### Phase 5: Results Experience (Days 5-6)
1. Build ScoreDisplay with color coding and animation
2. Build ResultsPanel with covered/missed sections
3. Integrate TTS script delivery with UI animations
4. Build ProcessingState with loading TTS
5. Add "Try Again" and "New Text" flows

### Phase 6: Persistence (Day 6-7)
1. Build /api/sessions routes
2. Save sessions after evaluation completes
3. Build SessionCard component
4. Build History page
5. Add session detail expansion

### Phase 7: Polish (Days 7-8)
1. Error handling for all failure modes
2. Loading states throughout
3. Mobile responsive design
4. Empty states (no history, first time user)
5. Soft warning at 2 min, hard stop at 3 min
6. Settings page completion
7. Landing page with persona previews

### Phase 8: Paid Features Prep (Day 8+)
1. Add isPaid flag to user model
2. Gate paid personas behind flag
3. Add upgrade CTA in persona selector
4. Stripe integration (optional, can be manual for now)

---

## Error Handling

Handle these gracefully with appropriate TTS:

| Error | UI Message | TTS |
|-------|-----------|-----|
| Mic permission denied | "Please allow microphone access" | "I need access to your mic to hear your explanation. Check your browser settings." |
| Whisper API fails | "Couldn't process audio" | "Hmm, I couldn't catch that. Want to try recording again?" |
| GPT-4o invalid JSON | Retry once, then error | "Something got tangled up on my end. One more try?" |
| GPT-4o rate limited | "Service busy" | "Lots of people learning right now! Give it a minute and try again." |
| Network offline | "You're offline" | "Looks like we lost connection. Check your internet and try again." |

Never leave user on spinner. Always provide escape hatch.

---

## TTS Script Examples by Step

### Welcome (entering input state)
- Coach: "Hey! Paste something you've been reading and let's see what stuck."
- Professor: "Please paste the text you wish to be evaluated on."
- Sergeant: "Drop your text. Let's see what you've got."
- Hype: "YOOO let's do this! Paste that text and show me what you learned!"
- Chill: "Hey. Paste whatever you've been reading, no rush."

### Ready to Record (text pasted)
- Coach: "Nice! Whenever you're ready, hit record and explain it back to me. Take your time."
- Professor: "Text received. Begin recording when prepared to deliver your explanation."
- Sergeant: "Got it. Hit record. You have 3 minutes. Make them count."
- Hype: "OH we're doing this! Hit record and tell me EVERYTHING you remember!"
- Chill: "Cool, got it. Hit record whenever and just... explain it however."

### Processing
- Coach: "Alright, let me see how you did..."
- Professor: "Analyzing your response..."
- Sergeant: "Let's see if you actually learned anything."
- Hype: "Okay okay okay let me see this!"
- Chill: "Hmm, one sec..."

### Results (dynamic based on score and analysis)
Generated by GPT-4o with persona voice.

---

## Not Building (MVP Scope)

- URL/article scraping
- Spaced repetition scheduling
- Multiple explanation modes
- Social/sharing features  
- Audio playback of recordings
- Editing past sessions
- Export functionality
- Voice selection for TTS (use system default)
- Custom personas

---

## Success Criteria

The app works if users:
1. Smile or react audibly when the persona speaks
2. Feel slightly uncomfortable seeing their score
3. Immediately notice "oh shit I missed that" when hearing missed points
4. Try a different persona out of curiosity
5. Hit "Try Again" without prompting

If users mute TTS immediately → voice is annoying, try different pacing
If users ignore persona selector → personas aren't differentiated enough
If users argue with score → scoring logic needs work
If users shrug → feedback is too soft

---

## Future Enhancements (Post-MVP)

1. **Voice selection** - Let users pick from available system voices
2. **Custom personas** - Create your own persona with custom prompt
3. **Spaced repetition** - Resurface old sessions for re-testing
4. **URL scraping** - Paste article URL instead of text
5. **Chrome extension** - Test retention on any page
6. **Streaks/gamification** - Daily learning streaks
7. **Teams** - Shared content for study groups
8. **OpenAI TTS upgrade** - Better voices for paid tier
