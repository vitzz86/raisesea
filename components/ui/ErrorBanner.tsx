// ═══════════════════════════════════════════════════════════════
// ErrorBanner — specific error messages with recovery action
//
// Voice rule: never just "Something went wrong."
// Format: <what happened> + <why, if known> + <what to do>
// ═══════════════════════════════════════════════════════════════

import { AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Tone = 'error' | 'warning' | 'info'

interface ErrorBannerProps {
  tone?: Tone
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
  className?: string
  icon?: ReactNode
}

const toneClasses: Record<Tone, string> = {
  error:   'bg-danger-bg border-danger-border text-danger-text',
  warning: 'bg-warning-bg border-warning-border text-warning-text',
  info:    'bg-info-bg border-info-border text-info-text',
}

export function ErrorBanner({ tone = 'error', title, description, action, onDismiss, className, icon }: ErrorBannerProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 border rounded-lg',
      toneClasses[tone],
      className,
    )}>
      <span className="shrink-0 mt-0.5">
        {icon ?? <AlertCircle className="w-4 h-4" strokeWidth={2} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs mt-1 opacity-90">{description}</div>}
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-medium underline mt-2 hover:no-underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
