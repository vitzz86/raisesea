import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isLegacyAdmin } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  // Shared fail-closed gate. This endpoint WRITES submissions.is_public,
  // so the previous inline comparison was a latent auth bypass with teeth.
  if (!isLegacyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, is_public } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('submissions')
    .update({ is_public })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, is_public })
}
