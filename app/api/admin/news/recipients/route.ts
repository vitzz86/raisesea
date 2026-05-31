import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH /api/admin/news/recipients — enable/disable a subscriber's digest
export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: { userId?: string; enabled?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.userId || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing userId or enabled' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ email_digest_enabled: body.enabled })
    .eq('id', body.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
