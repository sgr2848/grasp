import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { YouTubeVideoInfo } from '@/lib/api'

interface YouTubePreviewProps {
  video: YouTubeVideoInfo
  onStartLearning: (alreadyWatched: boolean) => void
  onStartPriorKnowledge?: () => void
  isLoading?: boolean
}

export function YouTubePreview({ video, onStartLearning, onStartPriorKnowledge, isLoading }: YouTubePreviewProps) {
  const [alreadyWatched, setAlreadyWatched] = useState(true)
  const [wantsPriorAssessment, setWantsPriorAssessment] = useState(false)

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins} min`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const estimatedReadTime = Math.max(1, Math.ceil(video.wordCount / 225))

  return (
    <Card className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-5">
        {/* Video info header */}
        <div className="flex gap-4">
          {/* Thumbnail */}
          <a
            href={`https://youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 group"
          >
            <div className="relative w-40 h-24 rounded-lg overflow-hidden bg-neutral-100">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </a>

          {/* Video details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-neutral-900 line-clamp-2">
              {video.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">{video.channel}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {video.duration && (
                <Badge variant="neutral">{formatDuration(video.duration)}</Badge>
              )}
              <Badge variant="neutral">{video.wordCount.toLocaleString()} words</Badge>
              <Badge variant="success">
                <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {video.transcriptionMethod === 'assemblyai'
                  ? 'Speaker identified'
                  : video.transcriptionMethod === 'whisper'
                    ? 'AI transcribed'
                    : 'Captions'}
              </Badge>
              {video.speakers && video.speakers.length > 0 && (
                <Badge variant="info">
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {new Set(video.speakers.map(s => s.speaker)).size} speakers
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Transcript preview (collapsible) */}
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700">
              <svg
                className="w-4 h-4 transition-transform group-open:rotate-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Preview transcript</span>
            </div>
          </summary>
          <div className="mt-3 p-4 rounded-lg bg-neutral-50 border border-neutral-200 max-h-48 overflow-y-auto">
            <p className="text-sm text-neutral-600 whitespace-pre-wrap line-clamp-12">
              {video.transcript.slice(0, 1000)}
              {video.transcript.length > 1000 && '...'}
            </p>
          </div>
        </details>

        {/* Watch status selection */}
        <div className="border-t border-neutral-200 pt-5">
          <div className="text-sm font-medium text-neutral-700 mb-3">
            Have you watched this video?
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
              <input
                type="radio"
                name="watchStatus"
                checked={alreadyWatched}
                onChange={() => setAlreadyWatched(true)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  Yes, I've already watched it
                </div>
                <div className="text-xs text-neutral-500">
                  Skip straight to explaining what you learned
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
              <input
                type="radio"
                name="watchStatus"
                checked={!alreadyWatched}
                onChange={() => setAlreadyWatched(false)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  No, I'll watch/read it now
                </div>
                <div className="text-xs text-neutral-500">
                  Read the transcript first (~{estimatedReadTime} min), then explain
                </div>
              </div>
            </label>
          </div>

          {/* Prior knowledge assessment option */}
          {onStartPriorKnowledge && (
            <label className="flex items-center gap-3 p-3 mt-3 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors">
              <input
                type="checkbox"
                checked={wantsPriorAssessment}
                onChange={(e) => setWantsPriorAssessment(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-blue-900">
                  Assess what I already know first
                </div>
                <div className="text-xs text-blue-600">
                  Share your existing knowledge before learning - helps personalize your experience
                </div>
              </div>
            </label>
          )}
        </div>

        {/* Start button */}
        <div className="flex justify-center pt-2">
          <Button
            size="lg"
            onClick={() => {
              if (wantsPriorAssessment && onStartPriorKnowledge) {
                onStartPriorKnowledge()
              } else {
                onStartLearning(alreadyWatched)
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Setting up...
              </>
            ) : (
              <>
                {wantsPriorAssessment ? 'Start Assessment' : 'Start Learning'}
                <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
