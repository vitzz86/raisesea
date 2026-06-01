'use client'

import { useEffect, useState } from 'react'

/**
 * Renders a UTC ISO instant in the VIEWER's local timezone, labelled with the
 * zone abbreviation — e.g. "Mon, Jun 2, 10:00 AM GMT+7".
 *
 * Why this must be a client component: `toLocaleString` without an explicit
 * `timeZone` formats in the *runtime's* zone. On Vercel the server runtime is
 * UTC, so any time formatted in a Server Component comes out in UTC regardless
 * of who's viewing. Formatting inside useEffect guarantees it runs in the
 * browser (the viewer's zone) and sidesteps a hydration mismatch: the server
 * emits a neutral placeholder, the browser swaps in the local time on mount.
 */
export default function LocalTime({ iso }: { iso: string | null | undefined }) {
  const [text, setText] = useState<string>('')

  useEffect(() => {
    if (!iso) return
    const d = new Date(iso)
    if (isNaN(d.getTime())) return
    setText(
      d.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZoneName: 'short',
      }),
    )
  }, [iso])

  if (!iso) return <>—</>
  return <span suppressHydrationWarning>{text || '…'}</span>
}
