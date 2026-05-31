// ═══════════════════════════════════════════════════════════════
// components/ui/TermTooltip.tsx
//
// Wraps a fundraising term (SAFE, MRR, TAM, etc.) with a hoverable
// dotted underline. On hover/tap, shows the plain-English definition.
//
// IMPORTANT — uses a React Portal so the tooltip escapes any ancestor
// container with overflow:hidden (tables, cards with rounded corners,
// collapsible guides). This was a real bug previously — see chunk 12.7.6.
//
// The tooltip is positioned with `position: fixed` using getBoundingClientRect
// of the trigger. It auto-flips to below the trigger when there's not
// enough room above (within ~140px of viewport top).
//
// Closes automatically on scroll or resize so stale positions don't
// linger. Recomputes position on every open.
//
// Usage:
//   <TermTooltip term="SAFE">SAFE</TermTooltip>
//   <TermTooltip term="cap table">your cap table</TermTooltip>
//
// Lookup is case-insensitive and supports aliases. If the term isn't
// in the glossary, falls back to rendering children plainly (safe drop-in).
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { findTerm } from '@/lib/glossary'
import { cn } from '@/lib/cn'

interface TermTooltipProps {
  /** Term to look up in the glossary (case-insensitive, supports aliases) */
  term: string
  /** Visible content — usually the term itself */
  children: ReactNode
  /** Optional className override on the trigger */
  className?: string
}

interface TooltipPosition {
  top:       number   // viewport pixels
  left:      number
  flipBelow: boolean  // true when there's not enough room above
}

const TOOLTIP_WIDTH        = 256   // matches w-64 = 16rem (assumes 16px base font)
const TOOLTIP_HEIGHT_EST   = 140   // approx — enough buffer for short + long lines
const VIEWPORT_PADDING     = 8     // keep tooltip this far from viewport edges

export function TermTooltip({ term, children, className }: TermTooltipProps) {
  const [open, setOpen]         = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const [mounted, setMounted]   = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<NodeJS.Timeout | null>(null)

  // Avoid SSR portal flash — only render portal once mounted client-side
  useEffect(() => { setMounted(true) }, [])

  const entry = findTerm(term)

  // Silent no-op: term not in glossary, render children plainly
  if (!entry) return <>{children}</>

  function calcPosition() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth  = window.innerWidth

    // Flip below if not enough room above
    const flipBelow = rect.top < TOOLTIP_HEIGHT_EST + VIEWPORT_PADDING

    // Horizontal: center on trigger, clamp to viewport
    let left = rect.left + rect.width / 2
    const halfWidth = TOOLTIP_WIDTH / 2
    if (left - halfWidth < VIEWPORT_PADDING)                  left = halfWidth + VIEWPORT_PADDING
    if (left + halfWidth > viewportWidth - VIEWPORT_PADDING)  left = viewportWidth - halfWidth - VIEWPORT_PADDING

    // Vertical
    const top = flipBelow ? rect.bottom + 8 : rect.top - 8

    // Suppress unused var warning — viewportHeight is referenced for future use
    void viewportHeight

    setPosition({ top, left, flipBelow })
  }

  function handleEnter() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    calcPosition()
    setOpen(true)
  }

  function handleLeave() {
    // Small delay so cursor can move to the popup itself without closing
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      setPosition(null)
    }, 150)
  }

  // Close tooltip on scroll or resize to avoid stale positioning
  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      setPosition(null)
    }
    window.addEventListener('scroll', close, true)   // capture-phase catches nested scroll containers
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // Cleanup any pending close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const tooltipNode = (open && position && mounted)
    ? createPortal(
        <span
          role="tooltip"
          id={`tooltip-${term}`}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            position:  'fixed',
            top:       position.top,
            left:      position.left,
            width:     TOOLTIP_WIDTH,
            transform: position.flipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            zIndex:    9999,
            pointerEvents: 'auto',
          }}
          className="bg-surface-card border border-border rounded-lg shadow-elevated p-3 text-left"
        >
          <div className="text-xs font-semibold text-text-primary mb-1">
            {entry.term}
            {entry.fullName && entry.fullName !== entry.term && (
              <span className="text-text-tertiary font-normal ml-1.5">({entry.fullName})</span>
            )}
          </div>
          <div className="text-xs text-text-secondary leading-relaxed">
            {entry.short}
          </div>
          <a
            href="/glossary"
            className="text-[11px] text-brand hover:underline mt-2 inline-block"
          >
            Full glossary →
          </a>
        </span>,
        document.body
      )
    : null

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        onClick={() => {
          // Tap-to-toggle for touch devices
          if (open) {
            setOpen(false)
            setPosition(null)
          } else {
            handleEnter()
          }
        }}
        className={cn(
          'border-b border-dotted border-text-tertiary cursor-help',
          'text-inherit font-inherit',
          'focus:outline-none focus:border-brand',
          className
        )}
        aria-describedby={open ? `tooltip-${term}` : undefined}
      >
        {children}
      </button>
      {tooltipNode}
    </>
  )
}
