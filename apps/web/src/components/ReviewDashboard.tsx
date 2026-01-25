import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { getDueReviews, type DueReview } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

export function ReviewDashboard() {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const navigate = useNavigate()
  const [reviews, setReviews] = useState<DueReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false)
      return
    }

    let cancelled = false

    getDueReviews()
      .then((data) => {
        if (cancelled) return
        setReviews(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load reviews')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn])

  if (!isSignedIn) {
    return null
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-3 text-sm text-neutral-500">
          <Spinner />
          Loading reviews...
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 p-5">
        <div className="text-sm font-medium text-red-700">Couldn't load reviews</div>
        <div className="mt-1 text-sm text-red-600">{error}</div>
      </Card>
    )
  }

  if (reviews.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="text-4xl mb-2">✨</div>
        <div className="text-sm font-medium text-neutral-900">All caught up!</div>
        <p className="mt-1 text-sm text-neutral-500">No reviews due. Keep learning!</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <div>
          <div className="text-sm font-medium text-neutral-900">Due for Review</div>
          <p className="mt-0.5 text-sm text-neutral-500">Reinforce what you've learned</p>
        </div>
        <Badge variant="danger">{reviews.length} due</Badge>
      </div>

      <div className="divide-y divide-neutral-100">
        {reviews.map((review) => (
          <button
            key={review.id}
            type="button"
            onClick={() => navigate(`/review/${review.loopId}`)}
            className="w-full p-5 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900/20"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-neutral-900">
                  {review.loop?.title || 'Untitled'}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                  {review.loop?.sourceText?.substring(0, 150)}...
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                  <span>Reviewed {review.timesReviewed}x</span>
                  {review.lastScore !== null && (
                    <span>Last score: {review.lastScore}</span>
                  )}
                  <span>Interval: {review.intervalDays}d</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="warning">Review</Badge>
                <svg
                  className="h-5 w-5 text-neutral-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
