import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { INVESTOR_STAGES, GENERAL_STAGES, type Priority } from '@/lib/crm'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

// PATCH /api/crm/contacts/[id] — update fields on a contact
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // First verify ownership + current board (for stage validation)
  const { data: existing, error: e1 } = await supabaseAdmin
    .from('crm_contacts').select('id, board').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  const setText = (key: string, max: number) => {
    if (key in body) updates[key] = String(body[key] || '').slice(0, max) || null
  }
  setText('name', 120); if (updates.name === null) delete updates.name  // never blank name
  setText('title', 120)
  setText('company', 120)
  setText('email', 200)
  setText('phone', 60)
  setText('linkedin_url', 300)
  setText('contact_type', 80); if (updates.contact_type === null) delete updates.contact_type
  setText('met_at_source', 60)
  setText('met_at_details', 200)
  setText('notes', 10000)
  setText('next_action', 200)
  if ('next_action_date' in body) {
    updates.next_action_date = body.next_action_date ? String(body.next_action_date).slice(0, 10) : null
  }
  if ('priority' in body && PRIORITIES.includes(body.priority as Priority)) {
    updates.priority = body.priority
  }
  if ('is_lost' in body) updates.is_lost = Boolean(body.is_lost)

  // Stage move — validate against the contact's board
  if ('stage' in body) {
    const stages = (existing.board === 'investor' ? INVESTOR_STAGES : GENERAL_STAGES).map(s => s.key)
    if (!stages.includes(body.stage as typeof stages[number])) {
      return NextResponse.json({ error: 'Invalid stage for board' }, { status: 400 })
    }
    updates.stage = body.stage
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('crm_contacts').update(updates).eq('id', id).eq('user_id', user.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}

// DELETE /api/crm/contacts/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabaseAdmin.from('crm_contacts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
