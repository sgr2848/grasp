import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useWorkspace } from '@/context/WorkspaceContext'
import { getLoops, type LearningLoop, type LoopPhase } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

const PHASE_LABELS: Record<LoopPhase, { label: string; color: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }> = {
  prior_knowledge: { label: 'Prior Knowledge', color: 'neutral' },
  reading: { label: 'Reading', color: 'neutral' },
  first_attempt: { label: 'First Attempt', color: 'info' },
  first_results: { label: 'Review Results', color: 'info' },
  learning: { label: 'Filling Gaps', color: 'warning' },
  second_attempt: { label: 'Second Attempt', color: 'info' },
  second_results: { label: 'Review Results', color: 'info' },
  simplify: { label: 'Simplify Challenge', color: 'warning' },
  simplify_results: { label: 'Review Results', color: 'info' },
  complete: { label: 'Complete', color: 'success' },
}

// Hook to fetch in-progress loops
export function useInProgressLoops() {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { currentSubject } = useWorkspace()
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

  return { loops, loading, error, count: loops.length }
}

// Drawer component for in-progress loops
interface InProgressLoopsDrawerProps {
  isOpen: boolean
  onClose: () => void
  loops: LearningLoop[]
  loading: boolean
}

export function InProgressLoopsDrawer({ isOpen, onClose, loops, loading }: InProgressLoopsDrawerProps) {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      return
    }

    if (!isVisible) return

    const timeout = window.setTimeout(() => setIsVisible(false), 300)
    return () => window.clearTimeout(timeout)
  }, [isOpen, isVisible])

  useEffect(() => {
    if (!isVisible) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isVisible])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleLoopClick = (loopId: string) => {
    onClose()
    navigate(`/learn/${loopId}`)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!isOpen}>
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-neutral-900/20 backdrop-blur-[2px] transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal={isOpen}
        aria-label="In-progress loops"
        className={cn(
          'absolute inset-y-0 right-0 z-10 flex w-full max-w-md flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Continue Learning</div>
            <p className="text-xs text-neutral-500">Pick up where you left off</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-neutral-500">
              <Spinner />
              Loading...
            </div>
          ) : loops.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              No loops in progress
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {loops.map((loop) => {
                const phaseInfo = PHASE_LABELS[loop.currentPhase] || { label: loop.currentPhase, color: 'neutral' as const }

                return (
                  <button
                    key={loop.id}
                    type="button"
                    onClick={() => handleLoopClick(loop.id)}
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
          )}
        </div>
      </div>
    </div>
  )
}

// Legacy inline component (for backwards compatibility)
export function InProgressLoops() {
  const navigate = useNavigate()
  const { loops, loading, error } = useInProgressLoops()
  const { isSignedIn } = useClerkAuth()

  if (!isSignedIn) {
    return null
  }

  if (loading) {
    return null // Don't show loading state inline
  }

  if (error) {
    return null
  }

  if (loops.length === 0) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
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
    </div>
  )
}
