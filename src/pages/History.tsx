import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignInButton, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useWorkspace } from '@/context/WorkspaceContext'
import { getSession, getSessions, getLoops, type SessionSummary, type LearningLoop, type LoopPhase } from '@/lib/api'
import { personaConfig } from '@/lib/personas'
import { analyzeSpeech } from '@/lib/speechAnalysis'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { SpeechMetrics } from '@/components/SpeechMetrics'
import { EmptyHistory } from '@/components/empty-states/EmptyHistory'
import { cn } from '@/lib/cn'

type FullSession = Awaited<ReturnType<typeof getSession>>

// Unified history item type
type HistoryItem =
  | { type: 'test'; data: SessionSummary }
  | { type: 'learn'; data: LearningLoop }

const PHASE_LABELS: Record<LoopPhase, { label: string; color: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }> = {
  prior_knowledge: { label: 'Prior Knowledge', color: 'neutral' },
  first_attempt: { label: 'First Attempt', color: 'info' },
  first_results: { label: 'Review Results', color: 'info' },
  learning: { label: 'Filling Gaps', color: 'warning' },
  second_attempt: { label: 'Second Attempt', color: 'info' },
  second_results: { label: 'Review Results', color: 'info' },
  simplify: { label: 'Simplify Challenge', color: 'warning' },
  simplify_results: { label: 'Review Results', color: 'info' },
  complete: { label: 'Complete', color: 'success' },
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function scoreTone(score: number) {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200'
  if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  article: { label: 'Article', icon: '📄' },
  meeting: { label: 'Meeting', icon: '👥' },
  podcast: { label: 'Podcast', icon: '🎙️' },
  video: { label: 'Video', icon: '🎬' },
  book: { label: 'Book', icon: '📚' },
  lecture: { label: 'Lecture', icon: '🎓' },
  other: { label: 'Other', icon: '📝' },
}

export default function History() {
  const navigate = useNavigate()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { currentSubject } = useWorkspace()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loops, setLoops] = useState<LearningLoop[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSession, setExpandedSession] = useState<FullSession | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [filter, setFilter] = useState<'all' | 'learn' | 'test'>('all')

  const canLoad = isLoaded && isSignedIn

  useEffect(() => {
    if (!canLoad) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Fetch both sessions and loops in parallel
    Promise.all([
      getSessions(currentSubject?.id),
      getLoops(undefined, currentSubject?.id)
    ])
      .then(([sessionsData, loopsData]) => {
        if (cancelled) return
        setSessions(sessionsData)
        setLoops(loopsData)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load history')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [canLoad, currentSubject?.id])

  // Combine and sort by date
  const historyItems = useMemo(() => {
    const items: HistoryItem[] = []

    if (filter === 'all' || filter === 'test') {
      sessions.forEach(s => items.push({ type: 'test', data: s }))
    }
    if (filter === 'all' || filter === 'learn') {
      loops.forEach(l => items.push({ type: 'learn', data: l }))
    }

    // Sort by date descending
    items.sort((a, b) => {
      const dateA = new Date(a.type === 'test' ? a.data.createdAt : a.data.createdAt)
      const dateB = new Date(b.type === 'test' ? b.data.createdAt : b.data.createdAt)
      return dateB.getTime() - dateA.getTime()
    })

    return items
  }, [sessions, loops, filter])

  const handleToggleExpand = useCallback(
    async (id: string, itemType: 'test' | 'learn') => {
      if (expandedId === id) {
        setExpandedId(null)
        setExpandedSession(null)
        return
      }

      // For learn items, navigate to the loop page instead of expanding
      if (itemType === 'learn') {
        navigate(`/learn/${id}`)
        return
      }

      setExpandedId(id)
      setExpandedSession(null)
      setLoadingDetails(true)

      try {
        const session = await getSession(id)
        setExpandedSession(session)
      } catch {
        // Keep it quiet; list still works.
      } finally {
        setLoadingDetails(false)
      }
    },
    [expandedId, navigate],
  )

  const emptyState = useMemo(
    () => canLoad && !loading && !error && historyItems.length === 0,
    [canLoad, error, loading, historyItems.length],
  )

  const speechAnalysis = useMemo(() => {
    if (!expandedSession?.transcript || !expandedSession?.durationSeconds) return null
    return analyzeSpeech(expandedSession.transcript, expandedSession.durationSeconds)
  }, [expandedSession])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">History</h1>
          <p className="mt-1 text-sm text-neutral-500">Your past learning sessions and scores.</p>
        </div>

        {/* Filter tabs */}
        {isSignedIn && (
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                filter === 'all'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('learn')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                filter === 'learn'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              Learn
            </button>
            <button
              type="button"
              onClick={() => setFilter('test')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                filter === 'test'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              Test
            </button>
          </div>
        )}
      </div>

      {!isSignedIn && (
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to see your history</div>
              <p className="mt-1 text-sm text-neutral-500">
                Your learning progress is saved to your account.
              </p>
            </div>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 p-5">
          <div className="text-sm font-medium text-red-700">Couldn&apos;t load history</div>
          <div className="mt-1 text-sm text-red-600">{error}</div>
        </Card>
      )}

      {loading && (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3 text-sm text-neutral-500">
            <Spinner />
            Loading history…
          </div>
        </Card>
      )}

      {emptyState && <EmptyHistory />}

      {historyItems.length > 0 && (
        <div className="grid gap-3">
          {historyItems.map((item) => {
            if (item.type === 'test') {
              const s = item.data
              const isOpen = expandedId === s.id

              return (
                <Card key={`test-${s.id}`} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => void handleToggleExpand(s.id, 'test')}
                    aria-expanded={isOpen}
                    aria-controls={`history-test-${s.id}`}
                    className="w-full p-5 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">Test</Badge>
                          <Badge variant="info">{personaConfig[s.persona].name}</Badge>
                          {s.sourceType && SOURCE_TYPE_LABELS[s.sourceType] && (
                            <Badge variant="neutral">
                              {SOURCE_TYPE_LABELS[s.sourceType].icon} {SOURCE_TYPE_LABELS[s.sourceType].label}
                            </Badge>
                          )}
                          <Badge variant="neutral">{formatTimestamp(s.createdAt)}</Badge>
                        </div>
                        <p className="mt-2 truncate text-sm text-neutral-600" title={s.sourceText}>{s.sourceText}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={cn('grid h-11 w-11 place-items-center border text-base font-bold', scoreTone(s.score))}>
                          {s.score}
                        </div>
                        <svg
                          className={cn('h-5 w-5 text-neutral-400 transition-transform', isOpen && 'rotate-180')}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div id={`history-test-${s.id}`} className="border-t border-neutral-100 bg-neutral-50 p-5">
                      {loadingDetails && (
                        <div className="flex items-center justify-center gap-3 py-6 text-sm text-neutral-500">
                          <Spinner />
                          Loading details…
                        </div>
                      )}

                      {!loadingDetails && expandedSession && (
                        <div className="space-y-5">
                          <div className="grid gap-5 lg:grid-cols-2">
                            <div>
                              <div className="text-xs font-medium text-neutral-500">Your explanation</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{expandedSession.transcript}</p>
                            </div>

                            <div>
                              <div className="text-xs font-medium text-neutral-500">Feedback</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{expandedSession.analysis.feedback}</p>

                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div className="border border-emerald-200 bg-emerald-50 p-4">
                                  <div className="text-xs font-medium text-emerald-700">Covered</div>
                                  <ul className="mt-2 space-y-1 text-sm text-emerald-600">
                                    {expandedSession.analysis.covered_points.slice(0, 5).map((point) => (
                                      <li key={point} className="flex gap-2">
                                        <span aria-hidden>✓</span>
                                        <span className="min-w-0">{point}</span>
                                      </li>
                                    ))}
                                    {expandedSession.analysis.covered_points.length === 0 && (
                                      <li className="text-emerald-500">No covered points detected.</li>
                                    )}
                                  </ul>
                                </div>

                                <div className="border border-amber-200 bg-amber-50 p-4">
                                  <div className="text-xs font-medium text-amber-700">Missed</div>
                                  <ul className="mt-2 space-y-1 text-sm text-amber-600">
                                    {expandedSession.analysis.missed_points.slice(0, 5).map((point) => (
                                      <li key={point} className="flex gap-2">
                                        <span aria-hidden>•</span>
                                        <span className="min-w-0">{point}</span>
                                      </li>
                                    ))}
                                    {expandedSession.analysis.missed_points.length === 0 && (
                                      <li className="text-amber-500">No missed points detected.</li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>

                          {speechAnalysis && <SpeechMetrics analysis={speechAnalysis} />}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            }

            // Learn loop item
            const loop = item.data
            const phaseInfo = PHASE_LABELS[loop.currentPhase] || { label: loop.currentPhase, color: 'neutral' as const }

            return (
              <Card key={`learn-${loop.id}`} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => void handleToggleExpand(loop.id, 'learn')}
                  className="w-full p-5 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">Learn</Badge>
                        <Badge variant={phaseInfo.color}>{phaseInfo.label}</Badge>
                        {loop.sourceType && SOURCE_TYPE_LABELS[loop.sourceType] && (
                          <Badge variant="neutral">
                            {SOURCE_TYPE_LABELS[loop.sourceType].icon} {SOURCE_TYPE_LABELS[loop.sourceType].label}
                          </Badge>
                        )}
                        <Badge variant="neutral">{formatTimestamp(loop.createdAt)}</Badge>
                      </div>
                      <div className="mt-2">
                        {loop.title && (
                          <p className="text-sm font-medium text-neutral-900">{loop.title}</p>
                        )}
                        <p className="truncate text-sm text-neutral-600">
                          {loop.sourceText.substring(0, 100)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {loop.status === 'in_progress' && (
                        <Badge variant="warning">In Progress</Badge>
                      )}
                      {loop.status === 'mastered' && (
                        <Badge variant="success">Mastered</Badge>
                      )}
                      <svg
                        className="h-5 w-5 text-neutral-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
