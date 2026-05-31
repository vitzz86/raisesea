import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params

  // Read the row we're about to delete — needed for sanity checks
  const { data: row } = await supabaseAdmin
    .from('super_admins')
    .select('email, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Safety: don't allow removing yourself (would lock you out)
  if (row.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself. Ask another super admin to do it.' }, { status: 400 })
  }

  // Safety: don't allow removing the last remaining super admin
  const { count } = await supabaseAdmin
    .from('super_admins')
    .select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last super admin' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('super_admins')
    .delete()
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[admin] ${user.email} removed super admin ${row.email}`)
  return NextResponse.json({ ok: true })
}
