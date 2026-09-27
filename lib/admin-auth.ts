// ═══════════════════════════════════════════════════════════════
// lib/admin-auth.ts — legacy shared-secret admin gate
// ═══════════════════════════════════════════════════════════════
// Three /api/admin/* routes still authenticate with the `admin_auth`
// cookie compared against ADMIN_PASSWORD:
//   • /api/admin/submissions   (GET  — dumps submissions incl. founder_email)
//   • /api/admin/toggle-public (POST — WRITES submissions.is_public)
//   • /api/admin/feedback      (GET  — dumps feedback + user emails)
//
// These live under /api/*, which middleware.ts deliberately excludes
// ("api routes do their own auth checking"), so this function IS the gate.
//
// FAIL-CLOSED, and that is the whole point of this module.
// The original inline check was:
//     if (cookie?.value !== process.env.ADMIN_PASSWORD) { 401 }
// When ADMIN_PASSWORD is unset, `cookie?.value` is undefined and
// process.env.ADMIN_PASSWORD is undefined, so `undefined !== undefined`
// is FALSE — the guard did not fire and the route ran with NO
// authentication at all, including the toggle-public write endpoint.
// Verified live: ADMIN_PASSWORD is currently set (401 with no cookie and
// with a wrong cookie), so this was latent, not exploited — but a single
// missing env var in a preview deploy would have opened all three.
//
// NOTE: this is the legacy gate. These routes are superseded by their
// super-admin equivalents (getSessionUser + isSuperAdmin) and are kept for
// backward compatibility only. Prefer isSuperAdmin for new work; the
// eventual cleanup is to delete these three routes and the secret.

import type { NextRequest } from 'next/server'

/**
 * True only when ADMIN_PASSWORD is configured AND the request carries a
 * matching `admin_auth` cookie. Never throws.
 */
export function isLegacyAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  // Fail closed: a missing secret must never mean "allow".
  if (!expected) return false
  const cookie = req.cookies.get('admin_auth')
  return cookie?.value === expected
}
