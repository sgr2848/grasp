import { cn } from '@/lib/cn'
import type { LoopAttempt, LoopPhase } from '@/lib/api'

interface LoopProgressProps {
  phase: LoopPhase
  attempts: LoopAttempt[]
}

const STEPS = [
  { id: 'prior', label: 'Prepare', phases: ['prior_knowledge', 'reading'] },
  { id: 'first', label: 'First Try', phases: ['first_attempt', 'first_results'] },
  { id: 'learn', label: 'Fill Gaps', phases: ['learning'] },
  { id: 'second', label: 'Second Try', phases: ['second_attempt', 'second_results'] },
  { id: 'simplify', label: 'Simplify', phases: ['simplify', 'simplify_results'] },
  { id: 'complete', label: 'Mastered', phases: ['complete'] },
]

export function LoopProgress({ phase, attempts }: LoopProgressProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.phases.includes(phase))

  return (
    <div className="border border-neutral-200 bg-white p-4">
      {/* Steps */}
      <div className="flex items-start">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex
          const isCurrent = index === currentStepIndex
          const isFuture = index > currentStepIndex
          const isLast = index === STEPS.length - 1

          return (
            <div key={step.id} className={cn('flex items-start', !isLast && 'flex-1')}>
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'grid h-8 w-8 place-items-center text-sm font-medium transition',
                    isComplete && 'bg-emerald-500 text-white',
                    isCurrent && 'bg-neutral-900 text-white',
                    isFuture && 'bg-neutral-100 text-neutral-400'
                  )}
                >
                  {isComplete ? (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-xs font-medium whitespace-nowrap',
                    isCurrent ? 'text-neutral-900' : isFuture ? 'text-neutral-400' : 'text-emerald-600'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 pt-4 px-2">
                  <div
                    className={cn(
                      'h-0.5 w-full',
                      index < currentStepIndex ? 'bg-emerald-500' : 'bg-neutral-200'
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Score progression */}
      {attempts.length > 0 && (
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4 text-sm">
          <span className="text-neutral-500">Scores:</span>
          <div className="flex items-center gap-1">
            {attempts.map((attempt, index) => {
              const scoreColor =
                attempt.score >= 80
                  ? 'text-emerald-600 bg-emerald-50'
                  : attempt.score >= 60
                    ? 'text-blue-600 bg-blue-50'
                    : attempt.score >= 40
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-red-600 bg-red-50'

              return (
                <div key={attempt.id} className="flex items-center">
                  <span className={cn('px-2 py-0.5 text-sm font-medium', scoreColor)}>{attempt.score}</span>
                  {index < attempts.length - 1 && <span className="mx-1 text-neutral-300">→</span>}
                </div>
              )
            })}
          </div>

          {attempts.length > 1 && (
            <span
              className={cn(
                'ml-2 text-sm font-medium',
                attempts[attempts.length - 1].score > attempts[0].score ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {attempts[attempts.length - 1].score > attempts[0].score ? '+' : ''}
              {attempts[attempts.length - 1].score - attempts[0].score} overall
            </span>
          )}
        </div>
      )}
    </div>
  )
}
