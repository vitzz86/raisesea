import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteDeck, isStoragePath } from '@/lib/storage'

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await context.params

  // Read storage path first so we can delete the file too
  const { data: row, error: readErr } = await supabaseAdmin
    .from('submissions')
    .select('deck_url, company_name')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !row) {
    return NextResponse.json({ error: readErr?.message || 'Not found' }, { status: 404 })
  }

  // Delete deck file from storage (if it's a storage path, not an old Drive URL)
  if (isStoragePath(row.deck_url)) {
    await deleteDeck(row.deck_url)  // non-fatal — log if fails inside helper
  }

  const { error: delErr } = await supabaseAdmin
    .from('submissions')
    .delete()
    .eq('id', id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  console.log(`[admin] deleted submission ${id} (${row.company_name}) by ${user.email}`)
  return NextResponse.json({ ok: true })
}
