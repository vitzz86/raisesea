// ═══════════════════════════════════════════════════════════════
// NextActionsBlock — the signature directed-graph CTA component
//
// Renders at every "completion" point: deck analysis done, mock pitch
// debrief done, meeting confirmed, CRM contact added, etc.
//
// Purpose: founders never reach a dead-end. After ANY completion they
// see 1-3 contextually-relevant next actions, ranked by priority.
//
// No competitor does this. It's a RaiseSEA differentiator.
// ═══════════════════════════════════════════════════════════════

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Priority = 'primary' | 'secondary' | 'tertiary'

export interface NextAction {
  priority: Priority
  icon: ReactNode
  label: string
  description?: string
  href: string
}

interface NextActionsBlockProps {
  title?: string
  subtitle?: string
  actions: NextAction[]
  className?: string
}

const priorityClasses: Record<Priority, string> = {
  primary:
    'bg-brand text-text-inverse hover:bg-brand-hover',
  secondary:
    'bg-surface-card text-text-primary border border-border hover:border-border-strong',
  tertiary:
    'bg-transparent text-text-secondary hover:bg-surface-muted',
}

export function NextActionsBlock({ title = 'What\'s next', subtitle, actions, className }: NextActionsBlockProps) {
  if (actions.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action, i) => (
          <a
            key={i}
            href={action.href}
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg transition-colors group',
              priorityClasses[action.priority]
            )}
          >
            <span className={cn(
              'shrink-0 inline-flex',
              action.priority === 'primary' ? 'text-text-inverse' : 'text-text-tertiary'
            )}>
              {action.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{action.label}</div>
              {action.description && (
                <div className={cn(
                  'text-xs mt-0.5',
                  action.priority === 'primary' ? 'text-text-inverse opacity-90' : 'text-text-tertiary'
                )}>
                  {action.description}
                </div>
              )}
            </div>
            <ArrowRight
              className={cn(
                'w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                action.priority === 'primary' ? 'text-text-inverse' : 'text-text-tertiary'
              )}
              strokeWidth={2}
            />
          </a>
        ))}
      </div>
    </div>
  )
}
