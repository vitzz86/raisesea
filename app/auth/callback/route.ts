// ═══════════════════════════════════════════════════════════════
// /auth/callback — OAuth + magic link redirect target
// ═══════════════════════════════════════════════════════════════
// Supabase Auth redirects here after a user clicks a magic link or
// completes Google OAuth. We:
//   1. Exchange the `code` param for a session (cookies are set)
//   2. Call claim_submissions_by_email() to link pre-auth submissions
//   3. Redirect to `redirectTo` (default: /dashboard)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  const redirectTo = url.searchParams.get('redirectTo') || '/dashboard'

  // If OAuth provider returned an error (e.g. user cancelled), bounce back to login
  if (errorParam) {
    const params = new URLSearchParams({ error: errorDescription || errorParam })
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, url.origin))
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=Missing+authorization+code', url.origin),
    )
  }

  // Exchange the code for a session — sets HTTP-only cookies on the response
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions)
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.error('[auth/callback] code exchange failed:', error?.message)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || 'Sign-in failed')}`, url.origin),
    )
  }

  // Claim pre-auth submissions by email — links existing rows to new user_id.
  // Uses the service role (supabaseAdmin) so RLS doesn't block us.
  // Failure is non-fatal — we still let the user in.
  try {
    const userEmail = data.user.email
    if (userEmail) {
      const { data: claimedCount, error: claimErr } = await supabaseAdmin.rpc(
        'claim_submissions_by_email',
        { p_user_id: data.user.id, p_email: userEmail },
      )
      if (claimErr) {
        console.error('[auth/callback] claim_submissions failed:', claimErr.message)
      } else if (claimedCount && (claimedCount as number) > 0) {
        console.log(`[auth/callback] linked ${claimedCount} pre-auth submissions to ${userEmail}`)
      }
    }
  } catch (err) {
    console.error('[auth/callback] claim threw:', err)
  }

  // Final redirect — to /dashboard by default, or wherever they tried to go
  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
