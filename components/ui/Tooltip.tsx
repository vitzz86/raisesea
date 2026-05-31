// ═══════════════════════════════════════════════════════════════
// Tooltip — hover/focus help for technical terms
//
// Use case: SAFE, MRR, ACV, TAM/SAM/SOM — hover/tap → short definition.
// Touch-friendly: also opens on tap on mobile.
// No external dependencies (no Radix etc) — vanilla CSS-only.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ content, children, placement = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Close on outside click (mobile tap-toggle)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span
      ref={ref}
      className={cn('relative inline-block', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        // Mobile tap-to-toggle (mouse-enter won't fire on touch)
        if ('ontouchstart' in window) {
          e.stopPropagation()
          setOpen(o => !o)
        }
      }}
    >
      <span className="border-b border-dashed border-text-tertiary cursor-help">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-50',
            'bg-text-primary text-text-inverse text-xs',
            'px-3 py-2 rounded-md shadow-modal',
            'whitespace-normal w-max max-w-xs',
            'animate-fade-in pointer-events-none',
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
