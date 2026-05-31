import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/admin/news/bulk-approve
// Body: { ids: string[] }  — approves all the given item IDs at once.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { ids?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No item IDs provided' }, { status: 400 })
  }
  // Safety cap to avoid accidental mass updates
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Too many items (max 200)' }, { status: 400 })
  }

  const { error, count } = await supabaseAdmin
    .from('news_items')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id }, { count: 'exact' })
    .in('id', ids)
    .eq('status', 'pending')   // only approve items still pending (don't re-touch rejected)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, approved: count ?? ids.length })
}
