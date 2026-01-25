import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'premium'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

export function Badge({ variant = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    premium: 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200',
  }

  const dotColors: Record<BadgeVariant, string> = {
    neutral: 'bg-neutral-400',
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    premium: 'bg-amber-500',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium leading-tight',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}
