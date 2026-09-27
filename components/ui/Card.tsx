// ═══════════════════════════════════════════════════════════════
// Card — foundational container for grouped content
// Design rules:
//   • 8px border radius (rounded-lg in our config)
//   • 1px border at border-DEFAULT, never shadow alone
//   • Surface card background
//   • Padding 24px standard, 16px compact, 32px spacious
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { ReactNode, HTMLAttributes } from 'react'

type Variant = 'default' | 'muted' | 'subtle'
type Padding = 'none' | 'compact' | 'default' | 'spacious'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
  interactive?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  // `surface-sheen` (globals.css) gives cards the landing page's top-down
  // light instead of flat white, so stacked cards read as lit surfaces
  // rather than paper cut-outs.
  default: 'surface-sheen border border-border shadow-subtle',
  muted:   'bg-surface-muted border border-border-muted',
  subtle:  'bg-transparent border border-border-muted',
}

const paddingClasses: Record<Padding, string> = {
  none:     'p-0',
  compact:  'p-4',
  default:  'p-6',
  spacious: 'p-8',
}

export function Card({
  variant = 'default',
  padding = 'default',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg transition-all',
        variantClasses[variant],
        paddingClasses[padding],
        interactive && 'cursor-pointer card-hover hover:border-border-strong',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
