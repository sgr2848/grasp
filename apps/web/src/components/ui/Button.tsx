import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]'

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-900/50 shadow-sm hover:shadow',
    secondary: 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300 focus-visible:ring-neutral-500/30',
    ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-neutral-500/30',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500/50 shadow-sm hover:shadow',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-500/50 shadow-sm hover:shadow',
  }

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  }

  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
}
