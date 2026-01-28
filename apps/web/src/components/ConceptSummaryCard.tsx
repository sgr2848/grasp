import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ConceptSummaryCardProps {
  coveredConcepts: string[]
  missedConcepts: string[]
}

export function ConceptSummaryCard({ coveredConcepts, missedConcepts }: ConceptSummaryCardProps) {
  const hasCovered = coveredConcepts.length > 0
  const hasMissed = missedConcepts.length > 0
  const hasAnyConcepts = hasCovered || hasMissed

  if (!hasAnyConcepts) {
    return null
  }

  return (
    <Card className="p-5 text-left">
      <div className="space-y-4">
        {/* Header */}
        <div className="text-sm font-medium text-neutral-900">Concepts from this session</div>

        {/* Demonstrated concepts */}
        {hasCovered && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Demonstrated</span>
              </div>
              <span className="text-xs text-emerald-600">{coveredConcepts.length}</span>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <ul className="space-y-1">
                {coveredConcepts.map((concept, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    <span>{concept}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Missed concepts */}
        {hasMissed && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span>Not covered</span>
              </div>
              <span className="text-xs text-neutral-400">{missedConcepts.length}</span>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <ul className="space-y-1">
                {missedConcepts.map((concept, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-500">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
                    <span>{concept}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* View in Knowledge Graph button */}
        <div className="pt-2">
          <Link to="/knowledge">
            <Button variant="secondary" size="sm" className="w-full">
              View in Knowledge Graph
              <svg className="ml-1.5 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
