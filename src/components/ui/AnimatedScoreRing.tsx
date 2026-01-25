import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

export interface AnimatedScoreRingProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  animate?: boolean
  duration?: number
  showLabel?: boolean
  label?: string
}

export function AnimatedScoreRing({
  value,
  size = 140,
  strokeWidth = 8,
  className,
  animate = true,
  duration = 1500,
  showLabel = true,
  label = 'Grasp',
}: AnimatedScoreRingProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value)
  const [hasAnimated, setHasAnimated] = useState(!animate)

  const clamped = Math.min(100, Math.max(0, displayValue))
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

  // Animate the score count-up
  useEffect(() => {
    if (!animate || hasAnimated) return

    const startTime = Date.now()
    const targetValue = Math.min(100, Math.max(0, value))

    const animateValue = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.round(eased * targetValue)

      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animateValue)
      } else {
        setHasAnimated(true)
      }
    }

    requestAnimationFrame(animateValue)
  }, [animate, value, duration, hasAnimated])

  // Update display value when prop changes (after initial animation)
  useEffect(() => {
    if (hasAnimated) {
      setDisplayValue(value)
    }
  }, [value, hasAnimated])

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          className="fill-none stroke-neutral-100"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            strokeDasharray: `${dash} ${c}`,
            transition: animate && !hasAnimated ? 'none' : 'stroke-dasharray 0.5s ease-out',
          }}
          className={cn('fill-none transition-colors duration-500', strokeTone)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className={cn('text-4xl font-bold tracking-tight transition-colors duration-500', textTone)}>
            {Math.round(clamped)}
          </div>
          {showLabel && <div className="mt-1 text-xs font-medium text-neutral-400">{label}</div>}
        </div>
      </div>
    </div>
  )
}
