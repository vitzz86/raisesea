// ═══════════════════════════════════════════════════════════════
// Badge — status indicators, tags, pills
// Design rules:
//   • Tiny text (xs / 13px)
//   • Pill shape (rounded-full)
//   • Compact padding (2px / 8px)
//   • Status colors only — no random palette
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Tone = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
type Size = 'sm' | 'default'

interface BadgeProps {
  tone?: Tone
  size?: Size
  leftIcon?: ReactNode
  children: ReactNode
  className?: string
}

const toneClasses: Record<Tone, string> = {
  default: 'bg-surface-muted text-text-secondary',
  brand:   'bg-brand-soft text-brand',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger:  'bg-danger-bg text-danger-text',
  info:    'bg-info-bg text-info-text',
  muted:   'bg-transparent border border-border text-text-tertiary',
}

const sizeClasses: Record<Size, string> = {
  sm:      'h-5 px-2 text-xs gap-1',
  default: 'h-6 px-3 text-xs gap-1',
}

export function Badge({ tone = 'default', size = 'default', leftIcon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        toneClasses[tone],
        sizeClasses[size],
        className
      )}
    >
      {leftIcon && <span className="inline-flex">{leftIcon}</span>}
      {children}
    </span>
  )
}
