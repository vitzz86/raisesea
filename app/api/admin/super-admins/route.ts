import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; notes?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const email = (body.email || '').trim().toLowerCase()
  const notes = (body.notes || '').trim().slice(0, 500)
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Check if this email already has an auth user — if so, link it now
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
  const linkedUserId = authUsers?.users.find(u => u.email?.toLowerCase() === email)?.id || null

  const { error } = await supabaseAdmin
    .from('super_admins')
    .insert({ email, notes, user_id: linkedUserId, added_by: user.id })

  if (error) {
    const msg = error.code === '23505' ? 'Already a super admin' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  console.log(`[admin] ${user.email} added super admin ${email}`)
  return NextResponse.json({ ok: true })
}
