// ═══════════════════════════════════════════════════════════════
// GET /api/google/calendar/callback
// Google redirects here after the VC grants consent. We:
//  1. Verify state matches the cookie (CSRF protection)
//  2. Exchange the code for tokens
//  3. Persist the refresh token (encrypted)
//  4. Mark vc_profiles.calendar_connected = true
//  5. Redirect back to /experts/profile/availability
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { exchangeCodeForTokens, persistConnection } from '@/lib/google-calendar'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function redirectWithMsg(success: boolean, message: string) {
  const url = new URL('/experts/profile/availability', BASE)
  url.searchParams.set(success ? 'connected' : 'error', message)
  return NextResponse.redirect(url)
}

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.redirect(new URL('/login', BASE))

  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return redirectWithMsg(false, errorParam === 'access_denied' ? 'You declined the request' : errorParam)
  }
  if (!code || !state) {
    return redirectWithMsg(false, 'Missing code or state')
  }

  // Verify state cookie (CSRF)
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gcal_oauth_state')?.value
  if (!expectedState || expectedState !== state) {
    return redirectWithMsg(false, 'Invalid state — try again')
  }

  // Exchange code for tokens
  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    console.error('[gcal/callback] exchange failed:', err)
    return redirectWithMsg(false, 'Failed to complete Google auth')
  }

  if (!tokens.refresh_token) {
    // This happens if the user previously granted access without prompt=consent.
    // Our auth URL uses prompt=consent so this is rare, but cover it.
    return redirectWithMsg(false, 'Did not receive a refresh token — try disconnecting from your Google account and reconnecting')
  }

  // Persist encrypted refresh token
  const persisted = await persistConnection({
    userId:       user.id,
    refreshToken: tokens.refresh_token,
    scope:        tokens.scope,
    expiresIn:    tokens.expires_in,
  })
  if (!persisted) {
    return redirectWithMsg(false, 'Failed to save Calendar credentials')
  }

  // Mark vc_profile as connected (if a profile exists)
  await supabaseAdmin
    .from('vc_profiles')
    .update({ calendar_connected: true })
    .eq('user_id', user.id)

  // Clear state cookie
  const res = redirectWithMsg(true, '1')
  res.cookies.delete('gcal_oauth_state')
  return res
}
