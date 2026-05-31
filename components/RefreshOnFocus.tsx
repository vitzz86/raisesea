// ═══════════════════════════════════════════════════════════════
// components/RefreshOnFocus.tsx
//
// Tiny client component that triggers Next.js server-component
// re-fetch when the tab regains focus or becomes visible.
//
// This is the "real-time-ish" pattern used by Linear, Notion, and
// most modern SaaS dashboards. It's NOT websockets — but it covers
// the 95% case where a user makes a change elsewhere, comes back
// to the dashboard, and expects to see fresh data.
//
// Behavior:
//   • On 'focus' event (tab regains focus)        → router.refresh()
//   • On 'visibilitychange' (tab becomes visible) → router.refresh()
//   • Throttled to once per 2 seconds (no thrashing if user
//     switches focus rapidly)
//   • Skips refresh if the page was just loaded (<3s ago) — avoids
//     double-fetching on initial mount
//
// Usage: mount once anywhere inside a page. The router.refresh()
// invalidates the server-component cache and re-fetches all data.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface RefreshOnFocusProps {
  /** Minimum ms between refreshes (default 2000) */
  throttleMs?: number
  /** Don't refresh if page is younger than this in ms (default 3000) */
  minPageAge?: number
}

export function RefreshOnFocus({ throttleMs = 2000, minPageAge = 3000 }: RefreshOnFocusProps = {}) {
  const router = useRouter()
  const lastRefreshRef = useRef<number>(Date.now())
  const mountedAtRef = useRef<number>(Date.now())

  useEffect(() => {
    const tryRefresh = () => {
      const now = Date.now()
      // Skip if page just loaded (initial focus event from mount)
      if (now - mountedAtRef.current < minPageAge) return
      // Throttle: skip if we refreshed recently
      if (now - lastRefreshRef.current < throttleMs) return
      lastRefreshRef.current = now
      router.refresh()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tryRefresh()
    }
    const onFocus = () => tryRefresh()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [router, throttleMs, minPageAge])

  return null  // headless — renders nothing
}
