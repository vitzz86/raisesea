// ═══════════════════════════════════════════════════════════════
// lib/expert-status.ts — small helper to check if a user is an
// approved expert. Used by DashboardShell consumers to decide
// whether to show the expert nav section.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from './supabase'

export async function isApprovedExpert(userId: string): Promise<boolean> {
  // Use a list query (not maybeSingle) so multiple rows don't return null.
  const { data } = await supabaseAdmin
    .from('vc_profiles')
    .select('application_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)
  if (!data || data.length === 0) return false
  // Approved if ANY profile row is active/approved.
  return data.some(row =>
    row.application_status === 'active' || row.application_status === 'approved'
  )
}
