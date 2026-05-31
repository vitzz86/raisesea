// ═══════════════════════════════════════════════════════════════
// middleware.ts — Route protection + session refresh
// ═══════════════════════════════════════════════════════════════
// Runs on every matched request before page render. Two jobs:
//   1. Refresh the user's session cookie (Supabase Auth SSR pattern)
//   2. Gate protected routes — redirect to /login if not authenticated
//
// Protected routes (chunks 4+):  /dashboard, /settings, /apply, /raise,
//                                /crm/*, /captable, /calculator,
//                                /intelligence, /admin
//
// Public routes (no auth required): /, /login, /auth/*, /match/<slug>,
//                                   /api/* (their own auth applies)
//
// Special: /admin requires super admin (extra check inside the route).

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Pages that REQUIRE login. Listed as path prefixes.
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/settings',
  '/apply',
  '/raise',
  '/crm',
  '/captable',
  '/calculator',
  '/intelligence',
  '/admin',
]

// Legacy admin cookie route — kept for backward compat until chunk 5 retires it.
const LEGACY_ADMIN_LOGIN = '/admin/login'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Legacy admin-login cookie check (kept for backward compat).
  // The new super-admin gate ships in chunk 5 and uses Supabase Auth instead.
  if (pathname === LEGACY_ADMIN_LOGIN) {
    return NextResponse.next()
  }

  // Create a response we can mutate cookies on
  let response = NextResponse.next({ request })

  // Create a Supabase client bound to this request's cookies.
  // The setAll callback writes refreshed cookies back to the response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as CookieOptions)
          })
        },
      },
    },
  )

  // IMPORTANT: getUser() refreshes the session if needed. Do not skip this.
  const { data: { user } } = await supabase.auth.getUser()

  // Does this path need authentication?
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtected && !user) {
    // Redirect to /login with redirectTo preserved so we bounce back after sign-in
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // Match everything EXCEPT static files, _next internals, and api routes
  // (api routes do their own auth checking — middleware would break SSE/streaming).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
