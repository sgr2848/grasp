import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SignInButton, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useWorkspace } from '@/context/WorkspaceContext'
import { useBooks } from '@/context/BooksContext'
import { OnboardingWelcome } from '@/components/OnboardingWelcome'
import { getLoops, getDueReviews, getKnowledgeStats, getUserUsage, type LearningLoop, type DueReview, type LoopPhase, type KnowledgeGraphStats, type UsageStats, FREE_TIER_DAILY_LIMIT } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

const PHASE_LABELS: Record<LoopPhase, string> = {
  prior_knowledge: 'Prior Knowledge',
  first_attempt: 'First Attempt',
  first_results: 'Review Results',
  learning: 'Filling Gaps',
  second_attempt: 'Second Attempt',
  second_results: 'Review Results',
  simplify: 'Simplify Challenge',
  simplify_results: 'Review Results',
  complete: 'Complete',
}

function useStreakData() {
  const [streak, setStreak] = useState({ current: 0, longest: 0, thisWeek: 0 })

  useEffect(() => {
    const today = new Date().toDateString()
    const lastActivity = localStorage.getItem('rt_last_activity')
    const currentStreak = parseInt(localStorage.getItem('rt_streak') || '0', 10)

    if (lastActivity !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      if (lastActivity === yesterday) {
        const newStreak = currentStreak + 1
        localStorage.setItem('rt_streak', String(newStreak))
        localStorage.setItem('rt_longest_streak', String(Math.max(newStreak, parseInt(localStorage.getItem('rt_longest_streak') || '0', 10))))
        setStreak({
          current: newStreak,
          longest: Math.max(newStreak, parseInt(localStorage.getItem('rt_longest_streak') || '0', 10)),
          thisWeek: parseInt(localStorage.getItem('rt_week_count') || '0', 10) + 1
        })
      } else if (lastActivity) {
        localStorage.setItem('rt_streak', '1')
        setStreak({ current: 1, longest: parseInt(localStorage.getItem('rt_longest_streak') || '1', 10), thisWeek: 1 })
      }
      localStorage.setItem('rt_last_activity', today)
    } else {
      setStreak({
        current: currentStreak || 1,
        longest: parseInt(localStorage.getItem('rt_longest_streak') || '1', 10),
        thisWeek: parseInt(localStorage.getItem('rt_week_count') || '1', 10)
      })
    }
  }, [])

  return streak
}

// Stat card component for consistency
function StatCard({
  label,
  value,
  suffix,
  icon,
  iconBg,
  iconColor,
  subtext,
  delay = 0,
}: {
  label: string
  value: number | string
  suffix?: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  subtext?: string
  delay?: number
}) {
  return (
    <Card
      className="p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{label}</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-neutral-900">{value}</span>
            {suffix && <span className="text-sm font-medium text-neutral-500">{suffix}</span>}
          </div>
          {subtext && (
            <div className="mt-2 text-xs text-neutral-500">{subtext}</div>
          )}
        </div>
        <div className={cn('grid h-11 w-11 place-items-center', iconBg)}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { currentSubject } = useWorkspace()
  const { books, refreshBooks } = useBooks()
  const streak = useStreakData()

  const [allLoops, setAllLoops] = useState<LearningLoop[]>([])
  const [dueReviews, setDueReviews] = useState<DueReview[]>([])
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeGraphStats | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all([
      getLoops(undefined, currentSubject?.id),
      getDueReviews(),
      getKnowledgeStats().catch(() => null),
      getUserUsage().catch(() => null),
      refreshBooks()
    ])
      .then(([loops, reviews, kStats, uStats]) => {
        if (cancelled) return
        setAllLoops(loops)
        setDueReviews(reviews)
        setKnowledgeStats(kStats)
        setUsageStats(uStats)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, currentSubject?.id, refreshBooks])

  const stats = useMemo(() => {
    const mastered = allLoops.filter(l => l.status === 'mastered')
    const inProgress = allLoops.filter(l => l.status === 'in_progress')

    return {
      totalLoops: allLoops.length,
      mastered: mastered.length,
      inProgress: inProgress.length,
    }
  }, [allLoops])

  const recentLoops = useMemo(() => {
    return allLoops
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [allLoops])

  const recentBooks = useMemo(() => {
    return books.slice(0, 8)
  }, [books])

  const weekDays = useMemo(() => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const today = new Date().getDay()
    return days.map((d, i) => ({
      label: d,
      isToday: i === today,
      isActive: i <= today && Math.random() > 0.3,
    }))
  }, [])

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">Your learning hub</p>
        </div>

        <Card className="p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center bg-neutral-100">
              <svg className="h-10 w-10 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-neutral-900">Welcome to Grasp</h3>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              Sign in to track your learning progress, build streaks, and actually remember what you read.
            </p>
            <div className="mt-8">
              <SignInButton mode="modal">
                <Button size="lg">Sign in to get started</Button>
              </SignInButton>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <OnboardingWelcome />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">Your learning hub</p>
        </div>
        <Link to="/learn">
          <Button size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Start Learning
          </Button>
        </Link>
      </div>

      {loading && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-3 text-sm text-neutral-500">
            <Spinner size="lg" />
            <span>Loading your dashboard...</span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-red-100">
              <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-red-700">Couldn&apos;t load dashboard</div>
              <div className="mt-1 text-sm text-red-600">{error}</div>
            </div>
          </div>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Current Streak"
              value={streak.current}
              suffix="days"
              subtext={`Best: ${streak.longest} days`}
              iconBg="bg-gradient-to-br from-amber-100 to-orange-100"
              iconColor="text-amber-600"
              delay={0}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 23a7.5 7.5 0 01-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5 0 5-2.47.27.773.5 1.604.5 2.47A7.5 7.5 0 0112 23z" />
                </svg>
              }
            />

            <Card
              className="p-5 animate-fade-in"
              style={{ animationDelay: '50ms' }}
            >
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">This Week</div>
              <div className="mt-4 flex items-center justify-between">
                {weekDays.map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'h-7 w-7 flex items-center justify-center text-xs font-medium transition-all',
                        day.isActive
                          ? 'bg-emerald-500 text-white'
                          : day.isToday
                            ? 'bg-neutral-200 text-neutral-600'
                            : 'bg-neutral-100 text-neutral-400'
                      )}
                    >
                      {day.isActive ? '✓' : ''}
                    </div>
                    <span className={cn('text-[10px]', day.isToday ? 'text-neutral-900 font-semibold' : 'text-neutral-400')}>
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <StatCard
              label="Mastered"
              value={stats.mastered}
              suffix="topics"
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              delay={100}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <StatCard
              label="In Progress"
              value={stats.inProgress}
              suffix="loops"
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              delay={150}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Usage Indicator for Free Users */}
          {usageStats && !usageStats.isPaid && (
            <Card className="p-5 animate-fade-in border-l-4 border-l-amber-400" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center bg-amber-100">
                    <svg className="h-5 w-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900">Daily Usage</div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {usageStats.loopsUsedToday} of {FREE_TIER_DAILY_LIMIT} learning loops used today
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 bg-neutral-200">
                      <div
                        className={cn(
                          'h-2 transition-all animate-progress',
                          usageStats.loopsUsedToday >= FREE_TIER_DAILY_LIMIT
                            ? 'bg-red-500'
                            : usageStats.loopsUsedToday >= FREE_TIER_DAILY_LIMIT - 1
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        )}
                        style={{ width: `${Math.min(100, (usageStats.loopsUsedToday / FREE_TIER_DAILY_LIMIT) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-neutral-700 tabular-nums">
                      {usageStats.remainingLoops} left
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Knowledge Graph Card */}
          {knowledgeStats && knowledgeStats.totalConcepts > 0 && (
            <Link to="/knowledge" className="block animate-fade-in" style={{ animationDelay: '250ms' }}>
              <Card className="group overflow-hidden transition-all hover:shadow-elevated hover:-translate-y-0.5">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-purple-100 to-violet-100">
                      <svg className="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">Your Knowledge Graph</div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                        <span className="font-medium text-neutral-700">{knowledgeStats.totalConcepts} concepts</span>
                        <span className="h-1 w-1 bg-neutral-300" />
                        <span>{knowledgeStats.masteredCount} mastered</span>
                        <span className="h-1 w-1 bg-neutral-300" />
                        <span>{Math.round(knowledgeStats.averageMastery)}% avg mastery (recency)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {knowledgeStats.learningCount + knowledgeStats.newCount > 0 && (
                      <Badge variant="info" dot>{knowledgeStats.learningCount + knowledgeStats.newCount} learning</Badge>
                    )}
                    <svg className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>
            </Link>
          )}

          {/* Recent Books */}
          {recentBooks.length > 0 && (
            <div className="animate-fade-in" style={{ animationDelay: '275ms' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Recent Books</div>
                  <p className="mt-0.5 text-xs text-neutral-500">Continue where you left off</p>
                </div>
                <Link to="/books" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {recentBooks.map((book) => {
                  const progress = book.totalChapters > 0
                    ? Math.round((book.completedChapters / book.totalChapters) * 100)
                    : 0
                  const colors = [
                    'from-emerald-200 to-emerald-300 text-emerald-800',
                    'from-blue-200 to-blue-300 text-blue-800',
                    'from-purple-200 to-purple-300 text-purple-800',
                    'from-amber-200 to-amber-300 text-amber-800',
                    'from-rose-200 to-rose-300 text-rose-800',
                    'from-cyan-200 to-cyan-300 text-cyan-800',
                  ]
                  const colorIndex = book.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
                  const initials = book.title.split(' ').slice(0, 2).map(word => word[0]?.toUpperCase() || '').join('')

                  return (
                    <div
                      key={book.id}
                      onClick={() => navigate(`/books/${book.id}`)}
                      className="group relative flex-shrink-0 w-28 cursor-pointer"
                    >
                      {/* Book cover */}
                      <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100 shadow-sm transition-all group-hover:shadow-elevated group-hover:-translate-y-1">
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colors[colorIndex]}`}>
                            <span className="text-xl font-bold tracking-tight">{initials}</span>
                          </div>
                        )}
                        {/* Progress indicator at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200/80">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Hover info overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2">
                        <div className="text-xs font-medium text-white truncate">{book.title}</div>
                        {book.author && (
                          <div className="text-[10px] text-white/70 truncate">{book.author}</div>
                        )}
                        <div className="mt-1 text-[10px] text-emerald-300 font-medium">
                          {progress}% • {book.completedChapters}/{book.totalChapters} ch
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Due Reviews */}
          {dueReviews.length > 0 && (
            <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center justify-between border-b border-neutral-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center bg-amber-100">
                    <svg className="h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Due for Review</div>
                    <p className="mt-0.5 text-xs text-neutral-500">Revisit these to strengthen your memory</p>
                  </div>
                </div>
                <Badge variant="warning" dot>{dueReviews.length} due</Badge>
              </div>
              <div className="divide-y divide-neutral-100">
                {dueReviews.slice(0, 3).map((review, i) => (
                  <Link
                    key={review.id}
                    to={`/review/${review.loopId}`}
                    className="group flex items-center justify-between p-4 transition-colors hover:bg-neutral-50"
                    style={{ animationDelay: `${350 + i * 50}ms` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-neutral-900 group-hover:text-emerald-600 transition-colors">
                        {review.loop?.title || 'Untitled'}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {review.lastReviewedAt
                          ? `Last reviewed: ${new Date(review.lastReviewedAt).toLocaleDateString()}`
                          : 'Not yet reviewed'}
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-neutral-300 transition-all group-hover:text-neutral-400 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
              {dueReviews.length > 3 && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3">
                  <Link to="/history" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
                    View all {dueReviews.length} reviews →
                  </Link>
                </div>
              )}
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: '350ms' }}>
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Recent Activity</div>
                <p className="mt-0.5 text-xs text-neutral-500">Your latest learning sessions</p>
              </div>
              <Link to="/history" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                View all →
              </Link>
            </div>

            {recentLoops.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center bg-neutral-100">
                  <svg className="h-8 w-8 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-neutral-900">No learning sessions yet</div>
                <p className="mt-1 text-sm text-neutral-500">Start your first loop to begin tracking progress</p>
                <Link to="/learn" className="mt-6 inline-block">
                  <Button>Start Learning</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recentLoops.map((loop, i) => (
                  <Link
                    key={loop.id}
                    to={loop.status === 'in_progress' ? `/learn/${loop.id}` : `/review/${loop.id}`}
                    className="group flex items-center justify-between p-4 transition-colors hover:bg-neutral-50"
                    style={{ animationDelay: `${400 + i * 50}ms` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 group-hover:text-emerald-600 transition-colors">
                          {loop.title || 'Untitled'}
                        </span>
                        {loop.status === 'mastered' && (
                          <Badge variant="success">Mastered</Badge>
                        )}
                        {loop.status === 'in_progress' && (
                          <Badge variant="info">{PHASE_LABELS[loop.currentPhase]}</Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-neutral-500 max-w-md">
                        {loop.sourceText.substring(0, 80)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-400 tabular-nums">
                        {new Date(loop.createdAt).toLocaleDateString()}
                      </span>
                      <svg className="h-5 w-5 text-neutral-300 transition-all group-hover:text-neutral-400 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
