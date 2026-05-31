// ═══════════════════════════════════════════════════════════════
// PageHeader + SectionHeader — consistent page chrome
//
// Every page uses PageHeader at the top.
// SectionHeader divides content within a page.
//
// Layout (PageHeader):
//   title (xl / 28px semibold)
//   subtitle (sm tertiary, optional)
//   actions on the right (responsive)
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-4 flex-wrap mb-6', className)}>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-tertiary mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, actions, icon, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-text-tertiary shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
