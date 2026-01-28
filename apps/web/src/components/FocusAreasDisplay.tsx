import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { PriorKnowledgeAnalysis } from '@/lib/api'

interface FocusAreasDisplayProps {
  analysis: PriorKnowledgeAnalysis
  onContinue: () => void
}

export function FocusAreasDisplay({ analysis, onContinue }: FocusAreasDisplayProps) {
  const { knownConcepts, partialConcepts, unknownConcepts, misconceptions, focusAreas } = analysis

  const hasKnown = knownConcepts.length > 0
  const hasPartial = partialConcepts.length > 0
  const hasUnknown = unknownConcepts.length > 0
  const hasMisconceptions = misconceptions && misconceptions.length > 0
  const hasFocusAreas = focusAreas.length > 0

  return (
    <Card className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Here's what I'm seeing</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Based on what you shared, here's your starting point for this content.
          </p>
        </div>

        {/* Concept cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Known concepts */}
          {hasKnown && (
            <ConceptCard
              icon="✓"
              title="You know"
              count={knownConcepts.length}
              items={knownConcepts}
              variant="success"
            />
          )}

          {/* Partial concepts */}
          {hasPartial && (
            <ConceptCard
              icon="~"
              title="Fuzzy on"
              count={partialConcepts.length}
              items={partialConcepts}
              variant="warning"
            />
          )}

          {/* Unknown concepts */}
          {hasUnknown && (
            <ConceptCard
              icon="✗"
              title="New to you"
              count={unknownConcepts.length}
              items={unknownConcepts}
              variant="danger"
            />
          )}
        </div>

        {/* Misconceptions */}
        {hasMisconceptions && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <span>Watch out for</span>
            </div>
            <ul className="mt-3 space-y-3">
              {misconceptions!.map((m, i) => (
                <li key={i} className="text-sm">
                  <div className="text-amber-700">
                    <span className="font-medium">You said:</span> "{m.claim}"
                  </div>
                  <div className="mt-1 text-amber-600">
                    <span className="font-medium">Actually:</span> {m.correction}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Focus areas */}
        {hasFocusAreas && (
          <div className="border-t border-neutral-200 pt-6">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Focus on while reading</span>
            </div>
            <ul className="mt-3 space-y-2">
              {focusAreas.map((area, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Continue button */}
        <div className="flex justify-center pt-2">
          <Button size="lg" onClick={onContinue}>
            Got it, let's read
            <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </div>
    </Card>
  )
}

interface ConceptCardProps {
  icon: string
  title: string
  count: number
  items: string[]
  variant: 'success' | 'warning' | 'danger'
}

function ConceptCard({ icon, title, count, items, variant }: ConceptCardProps) {
  const variantStyles = {
    success: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      title: 'text-emerald-700',
      count: 'bg-emerald-100 text-emerald-700',
      text: 'text-emerald-600',
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      title: 'text-amber-700',
      count: 'bg-amber-100 text-amber-700',
      text: 'text-amber-600',
    },
    danger: {
      border: 'border-red-200',
      bg: 'bg-red-50',
      icon: 'text-red-600',
      title: 'text-red-700',
      count: 'bg-red-100 text-red-700',
      text: 'text-red-600',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className={cn('rounded-lg border p-4', styles.border, styles.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-semibold', styles.icon)}>{icon}</span>
          <span className={cn('text-sm font-medium', styles.title)}>{title}</span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', styles.count)}>
          {count}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className={cn('flex items-start gap-2 text-sm', styles.text)}>
            <span className="mt-1.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
