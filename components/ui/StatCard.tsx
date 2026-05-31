// ═══════════════════════════════════════════════════════════════
// StatCard — single-metric display for dashboards and overviews
//
// Layout:
//   icon + label (top)
//   big number (40px / 2xl)
//   subline / delta (small text)
// ═══════════════════════════════════════════════════════════════

import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon?: ReactNode
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' }
  description?: string
  className?: string
}

export function StatCard({ label, value, unit, icon, delta, description, className }: StatCardProps) {
  return (
    <div className={cn('bg-surface-card border border-border rounded-lg p-6 transition-colors hover:border-border-strong', className)}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-text-tertiary">{icon}</span>}
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-semibold text-text-primary tracking-tight leading-none">
          {value}
        </span>
        {unit && <span className="text-base text-text-tertiary">{unit}</span>}
      </div>
      {(delta || description) && (
        <div className="flex items-center gap-2 text-xs">
          {delta && (
            <span className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              delta.direction === 'up' ? 'text-success-text' :
              delta.direction === 'down' ? 'text-danger-text' :
              'text-text-tertiary'
            )}>
              {delta.direction === 'up' && <ArrowUp className="w-3 h-3" />}
              {delta.direction === 'down' && <ArrowDown className="w-3 h-3" />}
              {delta.value}
            </span>
          )}
          {description && <span className="text-text-tertiary">{description}</span>}
        </div>
      )}
    </div>
  )
}
