// ═══════════════════════════════════════════════════════════════
// POST /api/google/calendar/disconnect
// VC chooses to remove our Calendar access. We mark the token as
// revoked in our DB and flip calendar_connected=false on profile.
// (We don't call Google's revoke endpoint — the user can do that
// themselves at myaccount.google.com if they want full revocation.)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { revokeOAuthToken } from '@/lib/token-storage'

export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  await revokeOAuthToken(user.id, 'google_calendar')
  await supabaseAdmin
    .from('vc_profiles')
    .update({ calendar_connected: false })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
