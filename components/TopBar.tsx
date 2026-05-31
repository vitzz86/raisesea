// ═══════════════════════════════════════════════════════════════
// components/TopBar.tsx
// Auth-aware top bar for non-dashboard pages (landing, /match/<slug>).
// Shows different CTAs depending on sign-in state.
//
// SERVER COMPONENT — pulls session from cookies on each render.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'

type Props = {
  /** Pass `true` only on the landing page so we don't double-link to /. */
  isLandingPage?: boolean
}

export default async function TopBar({ isLandingPage = false }: Props) {
  const user = await getSessionUser()
  const admin = user ? await isSuperAdmin(user) : false

  return (
    <div className="bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {isLandingPage ? (
          <span className="text-lg font-semibold text-[#1a4d2e]">RaiseSEA</span>
        ) : (
          <Link href="/" className="text-lg font-semibold text-[#1a4d2e] hover:opacity-80 transition">
            RaiseSEA
          </Link>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {admin && (
                <Link href="/admin" className="text-xs font-medium text-amber-700 hover:text-amber-900 transition">
                  ★ Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
              >
                Dashboard
              </Link>
              <form action="/api/auth/signout" method="POST" className="inline">
                <button
                  type="submit"
                  className="text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Sign out
                </button>
              </form>
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                <div className="w-7 h-7 rounded-full bg-[#1a4d2e] text-white flex items-center justify-center text-xs font-semibold">
                  {(user.email?.[0] || 'U').toUpperCase()}
                </div>
                <span className="text-xs text-gray-600 hidden sm:block">{user.email}</span>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium bg-[#1a4d2e] hover:bg-[#143d24] text-white rounded-md px-4 py-1.5 transition"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
