// ═══════════════════════════════════════════════════════════════
// GET /api/google/calendar/connect
// VC clicks "Connect Google Calendar" → we generate a state token,
// stash it in a cookie, and redirect them to Google's consent screen.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSessionUser } from '@/lib/supabase-server'
import { buildAuthUrl } from '@/lib/google-calendar'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?redirectTo=/experts/profile/availability', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  }

  // CSRF: random state, set as HTTP-only cookie, verified on callback
  const state = randomBytes(16).toString('hex')

  const authUrl = buildAuthUrl(state)
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('gcal_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   600,  // 10 min — must complete OAuth within that
  })
  return response
}
