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

  // Read current value, flip it
  const { data: row, error: readErr } = await supabaseAdmin
    .from('submissions')
    .select('is_public')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !row) {
    return NextResponse.json({ error: readErr?.message || 'Not found' }, { status: 404 })
  }

  const { error: updErr } = await supabaseAdmin
    .from('submissions')
    .update({ is_public: !row.is_public })
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, is_public: !row.is_public })
}
