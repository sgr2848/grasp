import { useMemo } from 'react'
import { cn } from '@/lib/cn'

interface RecordingEncouragementProps {
  duration: number
  isRecording: boolean
}

interface Encouragement {
  at: number
  message: string
  type: 'info' | 'success' | 'warning'
}

const ENCOURAGEMENTS: Encouragement[] = [
  { at: 5, message: 'Good start!', type: 'info' },
  { at: 15, message: 'Keep going...', type: 'info' },
  { at: 30, message: 'Nice flow!', type: 'success' },
  { at: 45, message: 'Great detail!', type: 'success' },
  { at: 60, message: 'One minute mark', type: 'info' },
  { at: 90, message: 'Solid explanation!', type: 'success' },
  { at: 120, message: 'Wrapping up?', type: 'warning' },
  { at: 150, message: '30 seconds left', type: 'warning' },
]

const TIPS = [
  'Start with the main concept',
  'Include specific details',
  'Explain how ideas connect',
  'Use your own words',
  'Cover the "why" not just "what"',
]

export function RecordingEncouragement({ duration, isRecording }: RecordingEncouragementProps) {
  const currentEncouragement = useMemo(() => {
    if (!isRecording) return null

    // Find the most recent encouragement that applies
    for (let i = ENCOURAGEMENTS.length - 1; i >= 0; i--) {
      if (duration >= ENCOURAGEMENTS[i].at && duration < ENCOURAGEMENTS[i].at + 8) {
        return ENCOURAGEMENTS[i]
      }
    }
    return null
  }, [duration, isRecording])

  const randomTip = useMemo(() => {
    return TIPS[Math.floor(Math.random() * TIPS.length)]
  }, [])

  if (!isRecording && duration === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-neutral-700">Before you start:</div>
        <ul className="space-y-2">
          {TIPS.slice(0, 4).map((tip, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-neutral-500">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (!isRecording) return null

  return (
    <div className="space-y-4">
      {/* Live waveform placeholder */}
      <div className="flex items-center justify-center gap-1 h-12">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-1 rounded-full bg-neutral-400 transition-all duration-150',
              isRecording && 'animate-pulse'
            )}
            style={{
              height: isRecording
                ? `${Math.random() * 32 + 8}px`
                : '8px',
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>

      {/* Encouragement message */}
      {currentEncouragement && (
        <div
          className={cn(
            'text-center py-2 px-4 rounded-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-2 duration-300',
            currentEncouragement.type === 'info' && 'bg-neutral-100 text-neutral-700',
            currentEncouragement.type === 'success' && 'bg-emerald-50 text-emerald-700',
            currentEncouragement.type === 'warning' && 'bg-amber-50 text-amber-700'
          )}
        >
          {currentEncouragement.message}
        </div>
      )}

      {/* Tip reminder */}
      {duration > 10 && duration < 60 && !currentEncouragement && (
        <div className="text-center text-xs text-neutral-400">
          Tip: {randomTip}
        </div>
      )}
    </div>
  )
}
