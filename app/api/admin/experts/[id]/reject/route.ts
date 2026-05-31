import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await context.params
  let body: { notes?: string }
  try { body = await req.json() } catch { body = {} }
  const notes = (body.notes || '').trim().slice(0, 1000)

  const { error } = await supabaseAdmin
    .from('vc_profiles')
    .update({
      application_status: 'rejected',
      is_listed: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      application_notes: notes || null,
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[admin] ${user.email} rejected expert ${id}: ${notes || '(no reason)'}`)
  return NextResponse.json({ ok: true })
}
