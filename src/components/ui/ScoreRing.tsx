import { cn } from '@/lib/cn'

export interface ScoreRingProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function ScoreRing({ value, size = 140, strokeWidth = 8, className }: ScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const dash = (clamped / 100) * c

  const textTone =
    clamped >= 80
      ? 'text-emerald-600'
      : clamped >= 60
        ? 'text-blue-600'
        : clamped >= 40
          ? 'text-amber-600'
          : 'text-red-600'

  const strokeTone =
    clamped >= 80
      ? 'stroke-emerald-500'
      : clamped >= 60
        ? 'stroke-blue-500'
        : clamped >= 40
          ? 'stroke-amber-500'
          : 'stroke-red-500'

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          className="fill-none stroke-neutral-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ strokeDasharray: `${dash} ${c}` }}
          className={cn('fill-none', strokeTone)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className={cn('text-4xl font-bold tracking-tight', textTone)}>{Math.round(clamped)}</div>
          <div className="mt-1 text-xs font-medium text-neutral-400">Grasp</div>
        </div>
      </div>
    </div>
  )
}
