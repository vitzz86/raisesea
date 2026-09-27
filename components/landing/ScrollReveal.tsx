// ═══════════════════════════════════════════════════════════════
// components/landing/ScrollReveal.tsx
//
// Lightweight scroll-reveal wrapper. Fades + slides children up
// when they enter the viewport. Triggered once per element.
//
// Used throughout the landing page for the subtle motion style
// that matches Linear/Mercury/Stripe in 2026.
//
// Why IntersectionObserver and not framer-motion: keeps the bundle
// tiny. The landing page is the first impression — fast LCP matters.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ─── Shared hook: detect when an element enters viewport (once) ───
// Mockups use this to trigger their internal SVG/bar animations.
// Returns [ref, inView]. inView flips true on first intersection.

export function useInView<T extends Element = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.25, rootMargin: '0px 0px -60px 0px' }
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion: jump straight to revealed
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const obs = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setInView(true)
          obs.unobserve(entry.target)
        }
      }
    }, options)

    obs.observe(el)
    return () => obs.disconnect()
  }, [options])

  return [ref, inView]
}

interface ScrollRevealProps {
  children:    ReactNode
  /** Delay in ms before the reveal starts (cascading staggers) */
  delay?:      number
  /** Optional className for the wrapping div */
  className?:  string
  /** Override the slide-up distance (default 12px) */
  slideY?:     number
}

export function ScrollReveal({ children, delay = 0, className, slideY = 12 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion — skip the animation entirely
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Apply delay if set, then reveal
            setTimeout(() => setRevealed(true), delay)
            observer.unobserve(entry.target)
          }
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -80px 0px', // start a bit before fully in view
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      // `data-reveal` lets a <noscript> style block force these wrappers (and
      // everything inside them) visible. Without JS the IntersectionObserver
      // never fires, so `opacity-0` would hide most of the page permanently.
      data-reveal=""
      className={cn(
        'transition-all duration-700 ease-out',
        revealed ? 'opacity-100 translate-y-0' : 'opacity-0',
        className
      )}
      style={{
        transform: revealed ? 'translateY(0)' : `translateY(${slideY}px)`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Count-up number ──────────────────────────────────────────────
// Animates a number from 0 to target when scrolled into view.
// Used for the trust-strip stats (750+, 60s, 8, etc.)

interface CountUpProps {
  end:        number
  /** Suffix appended after the number (e.g. "+", "s", "%") */
  suffix?:    string
  /** Duration in ms (default 1400) */
  duration?:  number
  className?: string
}

export function CountUp({ end, suffix = '', duration = 1400, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  // Render the REAL value on first paint, not 0.
  //
  // Audit P0: these counters are the first numbers a visitor sees. When the
  // server render (and every non-JS / pre-intersection frame) shows 0, the
  // landing page opens on "0+ active investors" / "0/100" — which reads as a
  // broken product rather than a loading state. Starting at `end` means the
  // correct number is always the baseline, and the count-up becomes a
  // progressive enhancement that only runs when it can actually be seen.
  const [current, setCurrent] = useState(end)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(end)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const startTime = Date.now()
            // Only reset to 0 at the moment we begin animating on screen.
            setCurrent(0)
            const tick = () => {
              const elapsed = Date.now() - startTime
              const progress = Math.min(elapsed / duration, 1)
              // ease-out curve so the final digits don't whip past
              const eased = 1 - Math.pow(1 - progress, 3)
              setCurrent(Math.round(end * eased))
              if (progress < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return (
    <span ref={ref} className={className}>
      {current}{suffix}
    </span>
  )
}
