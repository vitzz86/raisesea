// ═══════════════════════════════════════════════════════════════
// Tabs — consistent tab navigation pattern
//
// Used in: deck analysis result, mock pitch debrief, etc.
// Replaces the ad-hoc tab patterns scattered across MatchView,
// DebriefView, CRM, etc.
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
  count?: number
}

interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ items, activeId, onChange, className }: TabsProps) {
  return (
    <div className={cn('border-b border-border', className)}>
      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {items.map(item => {
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap',
                'border-b-2 transition-colors -mb-px',
                active
                  ? 'border-brand text-brand font-medium'
                  : 'border-transparent text-text-tertiary hover:text-text-primary'
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
              {item.count != null && item.count > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs',
                  active ? 'bg-brand-soft text-brand' : 'bg-surface-muted text-text-tertiary'
                )}>
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
