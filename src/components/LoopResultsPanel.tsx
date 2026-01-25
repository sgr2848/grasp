import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AnimatedScoreRing } from '@/components/ui/AnimatedScoreRing'
import { SpeechMetrics } from '@/components/SpeechMetrics'
import type { LoopAttempt, LoopPhase } from '@/lib/api'
import type { SpeechAnalysis } from '@/lib/speechAnalysis'

interface LoopResultsPanelProps {
  attempt: LoopAttempt
  previousAttempt: LoopAttempt | null
  phase: LoopPhase
  speechAnalysis: SpeechAnalysis | null
  onContinue: () => void
  onRetry: () => void
  onTestYourself?: () => void
}

function getPhaseInfo(phase: LoopPhase): { title: string; subtitle: string; nextAction: string } {
  switch (phase) {
    case 'first_results':
      return {
        title: 'First Attempt Results',
        subtitle: "Let's see what you remembered - and what needs work.",
        nextAction: 'Fill in the gaps',
      }
    case 'second_results':
      return {
        title: 'Second Attempt Results',
        subtitle: 'Great progress! See how much you improved.',
        nextAction: 'Take the simplify challenge',
      }
    case 'simplify_results':
      return {
        title: 'Simplify Challenge Results',
        subtitle: 'The ultimate test: can you explain it simply?',
        nextAction: 'Complete the loop',
      }
    default:
      return {
        title: 'Results',
        subtitle: '',
        nextAction: 'Continue',
      }
  }
}

export function LoopResultsPanel({
  attempt,
  previousAttempt,
  phase,
  speechAnalysis,
  onContinue,
  onRetry,
  onTestYourself,
}: LoopResultsPanelProps) {
  const phaseInfo = getPhaseInfo(phase)
  const scoreDelta = previousAttempt ? attempt.score - previousAttempt.score : null
  const isImprovement = scoreDelta !== null && scoreDelta > 0

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      {/* Score panel */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-neutral-900">{phaseInfo.title}</div>
            <p className="mt-1 text-sm text-neutral-500">{phaseInfo.subtitle}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <AnimatedScoreRing value={attempt.score} animate duration={1200} />
        </div>

        {/* Score comparison */}
        {scoreDelta !== null && (
          <div
            className={cn(
              'mt-4 flex items-center justify-center gap-2 p-3',
              isImprovement ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
            )}
          >
            <span className="text-sm text-neutral-600">
              {previousAttempt!.score} → {attempt.score}
            </span>
            <span
              className={cn(
                'text-sm font-bold',
                isImprovement ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {isImprovement ? '+' : ''}
              {scoreDelta} points
            </span>
          </div>
        )}

        {/* Newly covered concepts */}
        {attempt.newlyCovered && attempt.newlyCovered.length > 0 && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-xs font-medium text-emerald-700 mb-2">Newly covered this time:</div>
            <ul className="space-y-1">
              {attempt.newlyCovered.map((concept, index) => (
                <li key={index} className="text-sm text-emerald-600 flex items-start gap-2">
                  <span>✓</span>
                  <span>{concept}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Card className="bg-neutral-50 p-4">
            <div className="text-xs font-medium text-neutral-500">Coverage</div>
            <div className="mt-1 text-lg font-bold text-neutral-900">
              {Math.round(attempt.coverage * 100)}%
            </div>
          </Card>
          <Card className="bg-neutral-50 p-4">
            <div className="text-xs font-medium text-neutral-500">Accuracy</div>
            <div className="mt-1 text-lg font-bold text-neutral-900">
              {Math.round(attempt.accuracy * 100)}%
            </div>
          </Card>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" onClick={onContinue}>
            {phaseInfo.nextAction}
          </Button>
          <Button variant="secondary" size="lg" onClick={onRetry}>
            Try again
          </Button>
          {onTestYourself && (
            <Button variant="ghost" size="lg" onClick={onTestYourself}>
              Quick test →
            </Button>
          )}
        </div>
      </Card>

      {/* Feedback panel */}
      <div className="space-y-5">
        <Card className="p-6">
          <div className="text-sm font-medium text-neutral-900">Feedback</div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">
            {attempt.analysis.feedback}
          </p>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="border-emerald-200 bg-emerald-50 p-6">
            <div className="text-sm font-medium text-emerald-700">Covered</div>
            <ul className="mt-3 space-y-2 text-sm text-emerald-600">
              {attempt.analysis.covered_points.length === 0 && (
                <li className="text-emerald-500">None detected.</li>
              )}
              {attempt.analysis.covered_points.map((point, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden>✓</span>
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-amber-200 bg-amber-50 p-6">
            <div className="text-sm font-medium text-amber-700">Missed</div>
            <ul className="mt-3 space-y-2 text-sm text-amber-600">
              {attempt.analysis.missed_points.length === 0 && (
                <li className="text-amber-500">Nothing major missed!</li>
              )}
              {attempt.analysis.missed_points.map((point, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Speech metrics */}
        {speechAnalysis && <SpeechMetrics analysis={speechAnalysis} />}

        {/* Transcript */}
        <Card className="p-6">
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900">
              <span className="inline-flex items-center gap-2">
                Transcript
                <span className="text-xs font-medium text-neutral-400">(expand)</span>
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-600">
              {attempt.transcript}
            </p>
          </details>
        </Card>
      </div>
    </div>
  )
}
