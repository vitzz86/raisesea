// ═══════════════════════════════════════════════════════════════
// lib/super-admin.ts — Super admin access check
// ═══════════════════════════════════════════════════════════════
// Two-layer check:
//   1. SUPER_ADMIN_EMAILS env var (fast, no DB call)
//   2. super_admins DB table (allows runtime additions)
//
// samudravito4@gmail.com is the seeded founder account (in both layers).

import { supabaseAdmin } from './supabase'

type AuthUser = {
  id: string
  email?: string | null
}

/**
 * Check if a user is a super admin.
 *
 * Layer 1: parse SUPER_ADMIN_EMAILS env var (comma-separated).
 *          O(n) string comparison, no I/O — runs in microseconds.
 *
 * Layer 2: query super_admins table by user_id.
 *          Runs only when layer 1 doesn't match.
 *
 * @returns true if super admin, false otherwise
 */
export async function isSuperAdmin(user: AuthUser | null): Promise<boolean> {
  if (!user) return false

  // Layer 1: env var (case-insensitive)
  const envList = process.env.SUPER_ADMIN_EMAILS || ''
  const allowedEmails = envList
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  const userEmail = (user.email || '').toLowerCase()
  if (userEmail && allowedEmails.includes(userEmail)) {
    return true
  }

  // Layer 2: DB lookup by user_id (covers super admins added post-deploy)
  try {
    const { data, error } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[isSuperAdmin] DB check failed:', error.message)
      return false
    }
    return !!data
  } catch (err) {
    console.error('[isSuperAdmin] threw:', err)
    return false
  }
}
