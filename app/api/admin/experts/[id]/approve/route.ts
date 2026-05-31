import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await context.params

  const { error } = await supabaseAdmin
    .from('vc_profiles')
    .update({
      application_status: 'active',
      is_listed: true,           // appears in directory immediately
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      application_notes: null,
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[admin] ${user.email} approved expert ${id}`)
  // Email notification: deferred to chunk 8 when Resend ships.
  return NextResponse.json({ ok: true })
}
