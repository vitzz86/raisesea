import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await context.params

  let body: {
    status?: 'pending' | 'approved' | 'rejected'
    category?: 'fundraising' | 'tech' | 'policy' | 'exit'
    title?: string
    company_name?: string | null
    amount_usd?: number | null
    stage?: string | null
    sector?: string | null
    country?: string | null
    lead_investor?: string | null
    ai_summary?: string
    ai_why_it_matters?: string
    reject_reason?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updates: Record<string, unknown> = {}
  if (body.status && ['pending', 'approved', 'rejected'].includes(body.status)) {
    updates.status = body.status
    if (body.status === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = user.id
      updates.reject_reason = null
    } else if (body.status === 'rejected') {
      updates.reject_reason = body.reject_reason?.trim().slice(0, 500) || 'manual_delist'
    }
  }
  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 300)
  if (body.category && ['fundraising', 'tech', 'policy', 'exit'].includes(body.category)) updates.category = body.category
  for (const field of ['company_name', 'stage', 'sector', 'country', 'lead_investor'] as const) {
    if (body[field] === null) updates[field] = null
    else if (typeof body[field] === 'string') updates[field] = body[field].trim().slice(0, 200) || null
  }
  if (body.amount_usd === null) updates.amount_usd = null
  else if (typeof body.amount_usd === 'number' && Number.isFinite(body.amount_usd) && body.amount_usd >= 0) {
    updates.amount_usd = Math.round(body.amount_usd)
  }
  if (typeof body.ai_summary === 'string') updates.ai_summary = body.ai_summary.trim().slice(0, 1000)
  if (typeof body.ai_why_it_matters === 'string') updates.ai_why_it_matters = body.ai_why_it_matters.trim().slice(0, 1500)
  if (typeof body.reject_reason === 'string') updates.reject_reason = body.reject_reason.trim().slice(0, 500)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('news_items').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await context.params
  const { error } = await supabaseAdmin
    .from('news_items')
    .update({ status: 'rejected', reject_reason: 'manual_delist' })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, delisted: true })
}
