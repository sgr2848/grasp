import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useWorkspace } from '@/context/WorkspaceContext'
import { getLoops, type LearningLoop, type LoopPhase } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

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

export function InProgressLoops() {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { currentSubject } = useWorkspace()
  const navigate = useNavigate()
  const [loops, setLoops] = useState<LearningLoop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    getLoops('in_progress', currentSubject?.id)
      .then((data) => {
        if (cancelled) return
        setLoops(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load loops')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, currentSubject?.id])

  if (!isSignedIn) {
    return null
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-3 text-sm text-neutral-500">
          <Spinner />
          Loading...
        </div>
      </Card>
    )
  }

  if (error) {
    return null // Silently fail - not critical
  }

  if (loops.length === 0) {
    return null // Don't show anything if no in-progress loops
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <div>
          <div className="text-sm font-medium text-neutral-900">Continue Learning</div>
          <p className="mt-0.5 text-sm text-neutral-500">Pick up where you left off</p>
        </div>
        <Badge variant="info">{loops.length} in progress</Badge>
      </div>

      <div className="divide-y divide-neutral-100">
        {loops.slice(0, 5).map((loop) => {
          const phaseInfo = PHASE_LABELS[loop.currentPhase] || { label: loop.currentPhase, color: 'neutral' as const }

          return (
            <button
              key={loop.id}
              type="button"
              onClick={() => navigate(`/learn/${loop.id}`)}
              className="w-full p-5 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">
                      {loop.title || 'Untitled'}
                    </span>
                    <Badge variant={phaseInfo.color}>{phaseInfo.label}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                    {loop.sourceText.substring(0, 150)}...
                  </p>
                  <div className="mt-2 text-xs text-neutral-400">
                    Started {new Date(loop.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <svg
                  className="h-5 w-5 shrink-0 text-neutral-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )
        })}
      </div>

      {loops.length > 5 && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3 text-center">
          <span className="text-sm text-neutral-500">
            +{loops.length - 5} more in progress
          </span>
        </div>
      )}
    </Card>
  )
}
