import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost'
  hover?: boolean
}

export function Card({
  className,
  variant = 'default',
  hover = false,
  ...props
}: CardProps) {
  const variants = {
    default: 'border border-neutral-200 bg-white shadow-sm',
    elevated: 'bg-white shadow-elevated',
    outlined: 'border border-neutral-200 bg-transparent',
    ghost: 'bg-neutral-50',
  }

  return (
    <div
      className={cn(
        variants[variant],
        hover && 'transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  )
}
