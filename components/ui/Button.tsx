// ═══════════════════════════════════════════════════════════════
// Button — primary, secondary, ghost, danger
// Design rules:
//   • 6px border radius (rounded-md / DEFAULT in our config)
//   • Height: 32px small / 36px default / 44px large (44px = mobile thumb)
//   • 14px text (sm) / 13px text on small (xs)
//   • 150ms hover transition
//   • Focus ring: brand-tinted, 2px offset
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'default' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand text-text-inverse hover:bg-brand-hover active:bg-brand-active disabled:bg-text-disabled disabled:cursor-not-allowed',
  secondary:
    'bg-surface-card text-text-primary border border-border hover:border-border-strong hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger-solid text-text-inverse hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeClasses: Record<Size, string> = {
  sm:      'h-8 px-3 text-xs gap-1',
  default: 'h-9 px-4 text-sm gap-2',
  lg:      'h-11 px-6 text-sm gap-2',  // 44px for mobile thumb-reach
}

export function Button({
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        loading && 'cursor-wait',
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  )
}
