import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  className?: string
}

export function Switch({ checked, onCheckedChange, disabled, label, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-2 disabled:opacity-50',
        checked ? 'bg-neutral-900' : 'bg-neutral-200',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition',
          checked && 'translate-x-6',
        )}
      />
    </button>
  )
}

