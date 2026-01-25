# Retention Trainer - UX Improvements Plan

## Overview

This document outlines prioritized UX improvements for the Retention Trainer app. These improvements focus on user engagement, clarity, and creating a more polished learning experience.

---

## Priority 1: Dashboard / Home Page

**Problem:** Users launch the app without context. No visibility into their learning progress, recent activity, or what they should do next.

**Solution:** Create a dashboard that serves as the user's "learning hub."

### Features

| Component | Description |
|-----------|-------------|
| Weekly Progress | Visual showing loops completed this week vs goal |
| Streak Counter | "5 day streak" with flame icon, motivates daily use |
| Recent Loops | Quick access to last 3-5 sessions with scores |
| Subject Progress | Cards showing progress by subject/workspace |
| Quick Actions | "Continue Learning" and "Start New" buttons |
| Upcoming Reviews | List of subjects due for spaced repetition |

### Component Structure

```
src/
├── pages/
│   └── Dashboard.tsx          # Main dashboard page
├── components/
│   ├── dashboard/
│   │   ├── WeeklyProgress.tsx # Visual week view with completion dots
│   │   ├── StreakBadge.tsx    # Animated streak counter
│   │   ├── RecentLoops.tsx    # List of recent loop cards
│   │   ├── SubjectCard.tsx    # Progress card per subject
│   │   └── QuickActions.tsx   # Primary CTAs
```

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                    [Settings] [+New] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐│
│  │ 🔥 5 Day Streak  │  │  This Week                           ││
│  │    Keep it up!   │  │  ● ● ● ○ ○ ○ ○   3 of 7 days        ││
│  └──────────────────┘  └──────────────────────────────────────┘│
│                                                                 │
│  Continue Where You Left Off                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [▶] The Feynman Technique - Fill Gaps phase    Score: 72 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Your Subjects                                    [View All →]  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 📚 Physics   │ │ 💻 React     │ │ 🧠 Psychology│            │
│  │ 4 loops      │ │ 7 loops      │ │ 2 loops      │            │
│  │ Avg: 78      │ │ Avg: 85      │ │ Avg: 65      │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  Due for Review                                                 │
│  • The Feynman Technique (learned 3 days ago)                   │
│  • React Hooks (learned 5 days ago)                             │
└────────────────────────────────────────────────────────────────┘
```

### Database Changes

```typescript
// Add to existing schema
export const userStats = pgTable('user_stats', {
  userId: text('user_id').primaryKey().references(() => users.id),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  lastActivityDate: timestamp('last_activity_date'),
  totalLoops: integer('total_loops').default(0),
  weeklyGoal: integer('weekly_goal').default(5)
});
```

---

## Priority 2: Recording Phase Improvements

**Problem:** Users sit awkwardly waiting for something to happen. No guidance on what to say, how long to speak, or what good looks like.

**Solution:** Transform the recording phase into a guided, supportive experience.

### Features

| Component | Description |
|-----------|-------------|
| Pre-recording Prompt | "Try to cover: main idea, key details, why it matters" |
| Audio Waveform | Real-time visual feedback that mic is working |
| Gentle Progress | "Keep going..." at 30s, "Good depth!" at 60s |
| Tips Sidebar | Collapsible panel with speaking tips |
| Visual Timer | Circular progress with time remaining |

### Component Updates

```typescript
// src/components/AudioRecorder.tsx additions

interface RecordingTips {
  id: string
  text: string
  timing: 'before' | 'during' | 'after'
}

const RECORDING_TIPS: RecordingTips[] = [
  { id: 'main-idea', text: 'Start with the main concept', timing: 'before' },
  { id: 'details', text: 'Include specific details and examples', timing: 'before' },
  { id: 'connections', text: 'Explain how ideas connect', timing: 'during' },
  { id: 'own-words', text: "Use your own words, don't quote", timing: 'during' },
]

// Encouraging messages based on duration
const ENCOURAGEMENTS = [
  { at: 15, message: 'Good start...' },
  { at: 30, message: 'Keep going...' },
  { at: 60, message: 'Nice depth!' },
  { at: 90, message: 'Wrapping up?' },
]
```

### Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  Explain What You Learned                              [Tips ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌─────────────────┐                          │
│                    │                 │                          │
│                    │   ◉ 1:23        │  ← Circular timer        │
│                    │   Recording...  │                          │
│                    │                 │                          │
│                    └─────────────────┘                          │
│                                                                  │
│            ▁▂▄▆█▆▄▂▁▂▄▆█▆▄▂▁  ← Waveform                       │
│                                                                  │
│                    "Keep going..."   ← Dynamic encouragement    │
│                                                                  │
│                    ┌─────────────┐                              │
│                    │   ⏹ Done    │                              │
│                    └─────────────┘                              │
│                                                                  │
│  ┌─ Tips ──────────────────────────────────────────────────┐    │
│  │ • Start with the main concept                           │    │
│  │ • Include specific details and examples                 │    │
│  │ • Explain how ideas connect to each other               │    │
│  │ • Use your own words - don't just quote                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Priority 3: Better Empty States

**Problem:** New users see blank screens with no guidance. First-time experience feels cold and confusing.

**Solution:** Design thoughtful empty states that guide users to success.

### Empty State Locations

| Location | Current State | Improved State |
|----------|---------------|----------------|
| Dashboard (no loops) | Blank | Welcome message + "Start your first loop" CTA |
| History (no sessions) | "No sessions" | Illustration + explanation of what history shows |
| Subject (no content) | Empty | "Add your first reading material" with tips |
| Learning phase (first time) | Just starts | Onboarding tooltip explaining the flow |

### Component Structure

```
src/
├── components/
│   ├── empty-states/
│   │   ├── EmptyDashboard.tsx   # First-time user welcome
│   │   ├── EmptyHistory.tsx     # No past sessions
│   │   ├── EmptySubject.tsx     # Subject with no loops
│   │   └── FirstTimeOverlay.tsx # Onboarding tooltips
```

### Copy Examples

**Empty Dashboard:**
```
Welcome to Retention! 🎯

The best way to learn is to explain what you've read.

Here's how it works:
1. Paste something you're studying
2. Explain it in your own words
3. Get feedback on what you retained

[Start Your First Loop →]
```

**Empty History:**
```
Your Learning Journey Starts Here

After you complete loops, they'll appear here so you can:
• Track your progress over time
• See which topics need review
• Celebrate your improvements

[Go Learn Something →]
```

---

## Priority 4: Completion Celebration

**Problem:** Completing a loop feels anticlimactic. Users don't feel a sense of achievement or clear next steps.

**Solution:** Create a satisfying completion moment with clear path forward.

### Features

| Component | Description |
|-----------|-------------|
| Score Animation | Number counting up with color transition |
| Confetti | Subtle celebration for high scores (80+) |
| Improvement Badge | "+15 from first try!" highlight |
| Next Steps | Clear options: Review again, Next topic, Take a break |
| Scheduled Review | Show when this topic will resurface |

### Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         🎉                                       │
│                                                                  │
│                        92                                        │
│                     Mastered!                                    │
│                                                                  │
│                   ┌─────────────┐                               │
│                   │ +20 points  │  ← Improvement from 1st try   │
│                   │ from first  │                               │
│                   │   attempt   │                               │
│                   └─────────────┘                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ What You Nailed                                         │    │
│  │ ✓ Main concept of spaced repetition                     │    │
│  │ ✓ Forgetting curve explanation                          │    │
│  │ ✓ Practical application strategies                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  📅 Scheduled for review: January 28                            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Review Now  │  │ Next Topic  │  │    Done     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Scoring Thresholds

```typescript
type CompletionLevel = 'struggling' | 'learning' | 'proficient' | 'mastered'

const getCompletionLevel = (score: number): CompletionLevel => {
  if (score >= 90) return 'mastered'
  if (score >= 75) return 'proficient'
  if (score >= 50) return 'learning'
  return 'struggling'
}

const COMPLETION_CONFIG: Record<CompletionLevel, {
  title: string
  color: string
  showConfetti: boolean
  nextReview: number // days
}> = {
  mastered: {
    title: 'Mastered!',
    color: 'emerald',
    showConfetti: true,
    nextReview: 7
  },
  proficient: {
    title: 'Great Work!',
    color: 'blue',
    showConfetti: false,
    nextReview: 3
  },
  learning: {
    title: 'Making Progress',
    color: 'amber',
    showConfetti: false,
    nextReview: 1
  },
  struggling: {
    title: 'Keep Practicing',
    color: 'neutral',
    showConfetti: false,
    nextReview: 0 // suggest immediate retry
  }
}
```

---

## Priority 5: Mobile Recording UX

**Problem:** Recording on mobile is awkward. Screen stays on, can't multitask, feels tied to the device.

**Solution:** Add a "listen mode" that lets users review while walking/commuting.

### Features

| Feature | Description |
|---------|-------------|
| Listen Mode | TTS reads source material aloud before recording |
| Background Audio | Audio continues when screen locks |
| Simplified Controls | Large touch targets, minimal UI |
| Voice Commands | "I'm done" to stop recording (stretch goal) |

### Implementation Notes

```typescript
// For background audio on mobile
// Requires proper audio session configuration

// Web Audio API approach
const audioContext = new AudioContext()

// For iOS, need to handle audio session
if ('audioSession' in navigator) {
  // @ts-ignore - experimental API
  navigator.audioSession.type = 'playback'
}
```

### Mobile Wireframe

```
┌─────────────────────────┐
│                         │
│  The Feynman Technique  │
│                         │
│     ┌───────────┐       │
│     │           │       │
│     │    🎙     │       │
│     │  2:34     │       │
│     │           │       │
│     └───────────┘       │
│                         │
│   ▁▂▄▆█▆▄▂▁▂▄▆█▆▄▂▁    │
│                         │
│    "Nice depth!"        │
│                         │
│   ┌───────────────┐     │
│   │               │     │
│   │     Done      │     │
│   │               │     │
│   └───────────────┘     │
│                         │
└─────────────────────────┘
```

---

## Implementation Order

### Phase 1: Quick Wins (Low effort, High impact)
1. Empty states for Dashboard and History
2. Recording phase encouragements
3. Score animation on completion

### Phase 2: Core Experience
4. Full Dashboard implementation
5. Recording waveform visualization
6. Tips panel during recording

### Phase 3: Engagement Features
7. Streak tracking
8. Completion celebration with confetti
9. Scheduled review visibility

### Phase 4: Mobile Polish
10. Listen mode (TTS for source material)
11. Mobile-optimized recording UI
12. Background audio support

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Loop completion rate | Unknown | 80%+ | Track started vs completed loops |
| Retry rate | Unknown | 40%+ | Users who try again after first attempt |
| Return rate (7 day) | Unknown | 50%+ | Users who return within a week |
| Recording length | Unknown | 60s avg | Average recording duration |
| Streak engagement | N/A | 30% with 3+ day streak | Users maintaining streaks |

---

## Not in Scope

- Gamification beyond streaks (badges, leaderboards)
- Social features (sharing, groups)
- Advanced analytics/insights
- AI-generated study recommendations
- Integration with external content sources

---

## Design Principles

1. **Encourage, don't pressure** - Gentle nudges over hard requirements
2. **Show progress** - Make improvement visible and satisfying
3. **Reduce friction** - Minimize clicks between wanting to learn and learning
4. **Celebrate wins** - Small moments of delight for achievements
5. **Guide new users** - Never leave someone staring at a blank screen
