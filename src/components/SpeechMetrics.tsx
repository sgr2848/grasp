import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { SpeechAnalysis } from '@/lib/speechAnalysis'

interface SpeechMetricsProps {
  analysis: SpeechAnalysis
}

function getPaceColor(rating: SpeechAnalysis['paceRating']) {
  switch (rating) {
    case 'good':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    case 'slow':
    case 'fast':
      return 'text-amber-600 bg-amber-50 border-amber-200'
    case 'too slow':
    case 'too fast':
      return 'text-red-600 bg-red-50 border-red-200'
  }
}

function getClarityColor(score: number) {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

export function SpeechMetrics({ analysis }: SpeechMetricsProps) {
  const hasFillers = analysis.totalFillers > 0
  const hasHedges = analysis.totalHedges > 0
  const hasRepeats = analysis.repeatedPhrases.length > 0

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-neutral-900">Speech Quality</div>
          <p className="mt-1 text-sm text-neutral-500">Filler words, pace, and clarity analysis</p>
        </div>
        <div className={cn('text-2xl font-bold', getClarityColor(analysis.clarityScore))}>
          {analysis.clarityScore}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {/* Pace */}
        <div className="border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-medium text-neutral-500">Speaking Pace</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{analysis.wordsPerMinute} WPM</div>
          <Badge variant="neutral" className={cn('mt-2', getPaceColor(analysis.paceRating))}>
            {analysis.paceRating}
          </Badge>
          <p className="mt-2 text-xs text-neutral-400">Ideal: 120-160 WPM</p>
        </div>

        {/* Filler Words */}
        <div className="border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-medium text-neutral-500">Filler Words</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{analysis.totalFillers}</div>
          <div className="mt-1 text-xs text-neutral-500">
            {analysis.fillerRate} per 100 words
          </div>
          {hasFillers && (
            <div className="mt-2 flex flex-wrap gap-1">
              {analysis.fillerWords.slice(0, 3).map((f) => (
                <span key={f.word} className="text-xs text-neutral-500">
                  "{f.word}" ({f.count})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hedging */}
        <div className="border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-medium text-neutral-500">Hedge Words</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{analysis.totalHedges}</div>
          <p className="mt-1 text-xs text-neutral-400">Words showing uncertainty</p>
          {hasHedges && (
            <div className="mt-2 flex flex-wrap gap-1">
              {analysis.hedgeWords.slice(0, 3).map((h) => (
                <span key={h.word} className="text-xs text-neutral-500">
                  "{h.word}" ({h.count})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Repeated Phrases */}
      {hasRepeats && (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <div className="text-xs font-medium text-neutral-500">Repeated Phrases</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {analysis.repeatedPhrases.map((p) => (
              <Badge key={p.phrase} variant="neutral">
                "{p.phrase}" x{p.count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-4 border-t border-neutral-100 pt-4">
        <div className="text-xs font-medium text-neutral-500">Tips</div>
        <ul className="mt-2 space-y-1 text-xs text-neutral-500">
          {analysis.paceRating === 'too fast' && (
            <li>• Slow down a bit - your audience needs time to process</li>
          )}
          {analysis.paceRating === 'too slow' && (
            <li>• Try to speak a bit faster to maintain engagement</li>
          )}
          {analysis.fillerRate > 3 && (
            <li>• Practice pausing silently instead of using "um" or "uh"</li>
          )}
          {analysis.totalHedges > 5 && (
            <li>• Be more assertive - reduce "I think" and "maybe"</li>
          )}
          {analysis.clarityScore >= 80 && (
            <li>• Great clarity! Your delivery was clean and confident</li>
          )}
        </ul>
      </div>
    </Card>
  )
}
