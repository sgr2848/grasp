import { useState } from 'react'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

interface SimplifyChallengeProps {
  sourceText: string
  recorderState: 'idle' | 'requesting' | 'recording' | 'stopped'
  duration: number
  isProcessing: boolean
  recorderError: string | null
  onStart: () => void
  onStop: () => void
}

export function SimplifyChallenge({
  sourceText,
  recorderState,
  duration,
  isProcessing,
  recorderError,
  onStart,
  onStop,
}: SimplifyChallengeProps) {
  const [showTips, setShowTips] = useState(true)

  return (
    <div className="space-y-5">
      {/* Challenge header */}
      <Card className="border-amber-200 bg-amber-50 p-6 text-center">
        <div className="text-5xl mb-3">🎯</div>
        <h2 className="text-xl font-bold text-amber-900">Simplify Challenge</h2>
        <p className="mt-2 text-amber-800">
          Explain this like you're teaching a 10-year-old.
          <br />
          No jargon. Use examples. Keep it simple.
        </p>
      </Card>

      {/* Tips */}
      {showTips && (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-blue-800">Tips for simplifying:</div>
              <ul className="mt-2 space-y-1.5 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Use analogies ("It's like when...")</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Give concrete, everyday examples</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Avoid technical terms - if a kid wouldn't know the word, don't use it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Explain WHY, not just WHAT</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Shorter is often better</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setShowTips(false)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Hide
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Source preview */}
        <Card className="p-6">
          <div className="text-xs font-medium text-neutral-500 mb-3">Original text (for reference)</div>
          <div className="h-48 overflow-y-auto border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-sm text-neutral-600 leading-relaxed">{sourceText}</p>
          </div>
        </Card>

        {/* Recorder */}
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-900">Record your explanation</div>
              <Badge variant={recorderState === 'recording' ? 'danger' : 'neutral'}>
                {recorderState === 'requesting'
                  ? 'Requesting mic...'
                  : recorderState === 'recording'
                    ? 'Recording'
                    : 'Ready'}
              </Badge>
            </div>

            <div
              className={cn(
                'flex flex-col items-center justify-center gap-3 border py-8 transition',
                recorderState === 'recording'
                  ? 'border-red-300 bg-red-50'
                  : 'border-neutral-200 bg-neutral-50'
              )}
            >
              <div
                className={cn(
                  'grid h-16 w-16 place-items-center',
                  recorderState === 'recording' ? 'text-red-500' : 'text-neutral-400'
                )}
              >
                <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>

              <div className="text-2xl font-bold tracking-tight text-neutral-900">
                {formatDuration(duration)}
              </div>

              <div className="text-xs text-neutral-400">Auto-stop at 3:00</div>
            </div>

            {recorderError && (
              <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {recorderError}
              </div>
            )}

            {duration >= 120 && duration < 180 && (
              <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                1 minute left - wrap up!
              </div>
            )}

            <div className="flex flex-col gap-2">
              {recorderState !== 'recording' ? (
                <Button
                  size="lg"
                  onClick={onStart}
                  disabled={recorderState === 'requesting' || isProcessing}
                >
                  {recorderState === 'requesting' ? (
                    <>
                      <Spinner className="border-white/30 border-t-white" />
                      Starting...
                    </>
                  ) : (
                    'Start recording'
                  )}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="danger"
                  onClick={onStop}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Spinner className="border-white/30 border-t-white" />
                      Processing...
                    </>
                  ) : (
                    'Stop & score'
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
