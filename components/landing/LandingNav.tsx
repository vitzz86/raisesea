'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { RaiseSEALogo } from '@/components/brand/RaiseSEALogo'

// Navigation link set. Kept in one place so the desktop bar and the mobile
// panel can never drift apart — the previous nav hid four links below `sm`
// with no menu, so on a phone nobody could reach them at all.
//
// There is deliberately no "News" entry. The APAC Intelligence section below
// already renders live news previews from the same feed and links on to
// /news, so a second top-level link to the same destination was duplicating
// a nav slot. /news itself is untouched and still reachable from the footer,
// the dashboard, and the weekly digest.
const PRIMARY_LINKS = [
  { label: 'Product',               href: '#journey' },
  { label: 'Investor Intelligence', href: '#investors' },
  { label: 'APAC Intelligence',     href: '#intelligence' },
  { label: 'For Programs',          href: '#programs' },
  { label: 'FAQ',                   href: '#faq' },
]

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  // Escape closes the panel and returns focus to the trigger, so a keyboard
  // user is never stranded inside a closed menu.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-40 bg-surface-page/90 backdrop-blur border-b border-border-muted"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-input"
        >
          <RaiseSEALogo variant="primary" height={32} />
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-7">
          {PRIMARY_LINKS.map(link =>
            link.href.startsWith('#') ? (
              <a
                key={link.label}
                href={link.href}
                className="inline-flex min-h-[44px] items-center px-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex min-h-[44px] items-center px-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex min-h-[44px] items-center rounded-input px-4 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex min-h-[44px] items-center rounded-input px-4 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
          )}

          <Link
            href={signedIn ? '/apply' : '/login?next=/apply'}
            className="inline-flex min-h-[44px] items-center rounded-input bg-brand px-4 text-sm font-medium text-text-inverse hover:bg-brand-hover transition-colors"
          >
            Get started
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="lg:hidden flex h-11 w-11 items-center justify-center rounded-input text-text-secondary hover:text-text-primary"
          >
            {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          className="lg:hidden border-t border-border-muted bg-surface-page px-6 py-4"
        >
          <ul className="flex flex-col">
            {PRIMARY_LINKS.map(link => (
              <li key={link.label}>
                {link.href.startsWith('#') ? (
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[48px] items-center text-base text-text-secondary hover:text-text-primary"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[48px] items-center text-base text-text-secondary hover:text-text-primary"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
            <li className="sm:hidden">
              <Link
                href={signedIn ? '/dashboard' : '/login'}
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center text-base text-text-secondary hover:text-text-primary"
              >
                {signedIn ? 'Dashboard' : 'Sign in'}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}
