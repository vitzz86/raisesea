// ═══════════════════════════════════════════════════════════════
// EmptyState — the empty state IS the onboarding
//
// Pattern (DocSend-inspired):
//   • Small line-art icon (Lucide, stroke 1.5)
//   • Headline (one sentence)
//   • Description (1-2 sentences, ends with time estimate)
//   • Single primary CTA, optional secondary
//
// Voice: "Sharp friend" — direct, no fluff, encouraging.
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  primaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function EmptyState({ icon, title, description, primaryAction, secondaryAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center py-12 px-6', className)}>
      <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center mb-4 text-text-tertiary">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-tertiary max-w-sm mb-6">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {primaryAction && (
            primaryAction.href ? (
              <a href={primaryAction.href}>
                <Button variant="primary">{primaryAction.label}</Button>
              </a>
            ) : (
              <Button variant="primary" onClick={primaryAction.onClick}>{primaryAction.label}</Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <a href={secondaryAction.href}>
                <Button variant="ghost">{secondaryAction.label}</Button>
              </a>
            ) : (
              <Button variant="ghost" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
            )
          )}
        </div>
      )}
    </div>
  )
}
