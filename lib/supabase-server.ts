// ═══════════════════════════════════════════════════════════════
// lib/supabase-server.ts — Server-side Supabase client
// ═══════════════════════════════════════════════════════════════
// Used in:
//   • Server components (app/dashboard/page.tsx, app/admin/page.tsx)
//   • Route handlers (app/api/.../route.ts)
//   • Middleware (middleware.ts) — but via supabase-middleware.ts variant
//
// Reads the user's session from HTTP-only cookies set by Supabase Auth.
// Each request creates a fresh client (do NOT cache across requests).

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client bound to the current request's cookies.
 * Call this fresh in every server component / route handler — do not memoize.
 *
 * The returned client respects RLS policies based on the user's session.
 * For service-role operations that bypass RLS (e.g. admin actions), use
 * `supabaseAdmin` from lib/supabase.ts instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions)
            })
          } catch {
            // setAll is called from a Server Component → ignore.
            // Middleware handles cookie refresh on each request.
          }
        },
      },
    },
  )
}

/**
 * Convenience: get the currently authenticated user, or null.
 * Use this at the top of server components to gate access.
 *
 *   const user = await getSessionUser()
 *   if (!user) redirect('/login')
 */
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
