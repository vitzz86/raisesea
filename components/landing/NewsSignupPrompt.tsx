'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'raisesea_news_prompt_seen'

type NewsSignupPromptProps = {
  signedIn: boolean
  /**
   * How the prompt earns the right to interrupt.
   *
   * - `scroll`       — after the visitor has read a meaningful amount of the page (default)
   * - `intersection` — when the anchor element scrolls into view
   * - `immediate`    — on load. Reserve for genuine one-time announcements: it
   *                    blocks the content a first-time visitor actually came for.
   */
  trigger?: 'scroll' | 'intersection' | 'immediate'
  /** Scroll depth (0–1) required for the `scroll` trigger. Default 0.4. */
  scrollDepth?: number
  storageKey?: string
  eyebrow?: string
  title?: string
  body?: string
  ctaLabel?: string
  href?: string
}

export function NewsSignupPrompt({
  signedIn,
  trigger = 'scroll',
  scrollDepth = 0.4,
  storageKey = STORAGE_KEY,
  eyebrow = 'Weekly digest',
  title = 'Get SEA fundraising news in your inbox.',
  body = 'Sign in with Google to receive the newsletter and personalize it by sector.',
  ctaLabel = 'Sign in for newsletter',
  href = '/login?redirectTo=/news',
}: NewsSignupPromptProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  const titleId = 'news-signup-title'
  const bodyId = 'news-signup-body'

  // ─── Trigger ──────────────────────────────────────────────────────
  useEffect(() => {
    if (signedIn || typeof window === 'undefined') return
    if (window.localStorage.getItem(storageKey) === '1') return

    if (trigger === 'immediate') {
      window.localStorage.setItem(storageKey, '1')
      setOpen(true)
      return
    }

    if (trigger === 'scroll') {
      const onScroll = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight
        if (scrollable <= 0) return
        if (window.scrollY / scrollable >= scrollDepth) {
          window.localStorage.setItem(storageKey, '1')
          setOpen(true)
          window.removeEventListener('scroll', onScroll)
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const node = anchorRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        window.localStorage.setItem(storageKey, '1')
        setOpen(true)
        observer.disconnect()
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [signedIn, storageKey, trigger, scrollDepth])

  const close = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, '1')
    setOpen(false)
  }, [storageKey])

  // ─── Dialog behaviour: focus in, trap, Escape, restore ────────────
  // Without this the prompt was a bare <div>: screen readers never announced
  // it, Tab walked out into the page behind the overlay, and Escape did
  // nothing. It also scrolled behind the modal because body overflow was
  // never locked.
  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current

    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(el => el.offsetParent !== null)

    focusables()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus?.()
    }
  }, [open, close])

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay px-6"
          // Click the backdrop to dismiss — standard dialog affordance.
          onClick={event => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            className="relative w-full max-w-sm rounded-modal border border-border bg-surface-card p-6 shadow-modal"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-input text-text-tertiary hover:text-text-primary"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            <div className="text-xs font-semibold uppercase tracking-normal text-brand mb-2 pr-10">{eyebrow}</div>
            <h2 id={titleId} className="text-xl font-semibold tracking-normal text-text-primary leading-tight">
              {title}
            </h2>
            <p id={bodyId} className="text-sm text-text-secondary leading-relaxed mt-3">
              {body}
            </p>
            <div className="flex items-center gap-2 mt-5">
              <Link
                href={href}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-input bg-brand px-4 text-sm font-medium text-text-inverse hover:bg-brand-hover transition"
              >
                {ctaLabel}
              </Link>
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-[44px] items-center justify-center rounded-input border border-border-strong px-4 text-sm font-medium text-text-secondary hover:text-text-primary transition"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
