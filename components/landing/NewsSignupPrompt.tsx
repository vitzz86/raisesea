'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'raisesea_news_prompt_seen'

type NewsSignupPromptProps = {
  signedIn: boolean
  trigger?: 'intersection' | 'immediate'
  storageKey?: string
  eyebrow?: string
  title?: string
  body?: string
  ctaLabel?: string
  href?: string
}

export function NewsSignupPrompt({
  signedIn,
  trigger = 'intersection',
  storageKey = STORAGE_KEY,
  eyebrow = 'Weekly digest',
  title = 'Get SEA fundraising news in your inbox.',
  body = 'Sign in with Google to receive the newsletter and personalize it by sector.',
  ctaLabel = 'Sign in for newsletter',
  href = '/login?redirectTo=/news',
}: NewsSignupPromptProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (signedIn || typeof window === 'undefined') return
    if (window.localStorage.getItem(storageKey) === '1') return

    if (trigger === 'immediate') {
      window.localStorage.setItem(storageKey, '1')
      setOpen(true)
      return
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
  }, [signedIn, storageKey, trigger])

  function close() {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, '1')
    setOpen(false)
  }

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" />
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay px-6">
          <div className="w-full max-w-sm rounded-modal border border-border bg-surface-card p-6 shadow-modal">
            <div className="text-xs font-semibold uppercase tracking-normal text-brand mb-2">{eyebrow}</div>
            <h2 className="text-xl font-semibold tracking-normal text-text-primary leading-tight">{title}</h2>
            <p className="text-sm text-text-secondary leading-relaxed mt-3">
              {body}
            </p>
            <div className="flex items-center gap-2 mt-5">
              <Link
                href={href}
                className="inline-flex flex-1 items-center justify-center rounded-input bg-brand px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-brand-hover transition"
              >
                {ctaLabel}
              </Link>
              <button
                type="button"
                onClick={close}
                className="rounded-input border border-border-strong px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary transition"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
