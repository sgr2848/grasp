import { cn } from '@/lib/cn'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes: Record<NonNullable<SpinnerProps['size']>, string> = {
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-7 w-7 border-[3px]',
  }

  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-neutral-200 border-t-neutral-600',
        sizes[size],
        className,
      )}
      aria-hidden
    />
  )
}

