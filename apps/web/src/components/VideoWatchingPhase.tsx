import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface VideoWatchingPhaseProps {
  videoId: string
  transcript: string
  title: string
  channel?: string
  focusAreas: string[]
  onFinishedWatching: () => void
}

export function VideoWatchingPhase({
  videoId,
  transcript,
  title,
  channel,
  focusAreas,
  onFinishedWatching
}: VideoWatchingPhaseProps) {
  const [showTranscript, setShowTranscript] = useState(true)

  const wordCount = useMemo(() => {
    return transcript.trim().split(/\s+/).filter(Boolean).length
  }, [transcript])

  const hasFocusAreas = focusAreas.length > 0

  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-neutral-900 truncate">{title}</h2>
          {channel && (
            <p className="mt-0.5 text-sm text-neutral-500">{channel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="neutral">{wordCount.toLocaleString()} words</Badge>
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {showTranscript ? 'Hide' : 'Show'} Transcript
          </button>
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
              <div className="text-sm font-medium text-blue-700">Pay attention to:</div>
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

      {/* Video and transcript side by side */}
      <div className={`grid ${showTranscript ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-0`}>
        {/* YouTube Player */}
        <div className="bg-black">
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Transcript */}
        {showTranscript && (
          <div className="border-l border-neutral-200 bg-white">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Transcript
              </div>
            </div>
            <div className="h-[400px] lg:h-[calc(56.25vw/2)] max-h-[500px] overflow-y-auto p-4">
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with action */}
      <div className="flex items-center justify-center border-t border-neutral-200 bg-neutral-50 px-6 py-4">
        <Button size="lg" onClick={onFinishedWatching}>
          I've finished watching
          <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </Card>
  )
}
