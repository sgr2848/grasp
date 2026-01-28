import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ReaderPreview } from '@/components/ReaderPreview'

interface ReadingPhaseProps {
  sourceText: string
  title?: string
  focusAreas: string[]
  onFinishedReading: () => void
}

export function ReadingPhase({ sourceText, title, focusAreas, onFinishedReading }: ReadingPhaseProps) {
  const wordCount = useMemo(() => {
    return sourceText.trim().split(/\s+/).filter(Boolean).length
  }, [sourceText])

  const estimatedMinutes = useMemo(() => {
    // Average reading speed: 200-250 words per minute
    return Math.max(1, Math.ceil(wordCount / 225))
  }, [wordCount])

  const hasFocusAreas = focusAreas.length > 0

  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Read the content</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Take your time. Focus on the areas mentioned below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">~{estimatedMinutes} min</Badge>
          <Badge variant="neutral">{wordCount.toLocaleString()} words</Badge>
        </div>
      </div>

      {/* Focus areas reminder */}
      {hasFocusAreas && (
        <div className="border-b border-blue-200 bg-blue-50 px-6 py-3">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-700">Remember to focus on:</div>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {focusAreas.map((area, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-sm text-blue-600">
                    <span className="h-1 w-1 rounded-full bg-blue-400" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Reader content */}
      <div className="h-[500px] overflow-y-auto bg-white">
        <ReaderPreview text={sourceText} title={title} />
      </div>

      {/* Footer with action */}
      <div className="flex items-center justify-center border-t border-neutral-200 bg-neutral-50 px-6 py-4">
        <Button size="lg" onClick={onFinishedReading}>
          I've finished reading
          <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </Card>
  )
}
