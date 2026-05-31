// ═══════════════════════════════════════════════════════════════
// PATCH /api/experts/profile — update the current user's vc_profile
// Only available to approved experts. Validates and whitelists fields.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Confirm an approved profile exists
  const { data: existing } = await supabaseAdmin
    .from('vc_profiles')
    .select('id, application_status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'No expert profile found — apply first' }, { status: 404 })

  // Allow avatar_url updates even when not active (used right after upload)
  const isAvatarOnly = Object.keys(body).length === 1 && 'avatar_url' in body
  if (existing.application_status !== 'active' && !isAvatarOnly) {
    return NextResponse.json({ error: 'Only approved experts can edit their profile' }, { status: 403 })
  }

  // Whitelist + sanitize allowed updates
  const updates: Record<string, unknown> = {}

  const stringFields = [
    'display_name', 'fund_or_firm', 'title', 'bio', 'what_i_offer',
    'linkedin_url', 'website', 'company_linkedin_url', 'company_website',
    'hq_country', 'hq_city', 'investment_thesis',
  ]
  for (const f of stringFields) {
    if (typeof body[f] === 'string') {
      const s = (body[f] as string).trim()
      const max = f === 'bio' || f === 'what_i_offer' || f === 'investment_thesis' ? 2000 : 500
      updates[f] = s.slice(0, max) || null
    }
  }

  if (typeof body.avatar_url === 'string' && (body.avatar_url as string).startsWith('http')) {
    updates.avatar_url = (body.avatar_url as string).slice(0, 1000)
  }

  if (typeof body.years_experience === 'number' && body.years_experience >= 0 && body.years_experience <= 80) {
    updates.years_experience = body.years_experience
  } else if (body.years_experience === null) {
    updates.years_experience = null
  }

  if (typeof body.ticket_min_usd === 'number' && body.ticket_min_usd >= 0) {
    updates.ticket_min_usd = body.ticket_min_usd
  } else if (body.ticket_min_usd === null) {
    updates.ticket_min_usd = null
  }

  if (typeof body.ticket_max_usd === 'number' && body.ticket_max_usd >= 0) {
    updates.ticket_max_usd = body.ticket_max_usd
  } else if (body.ticket_max_usd === null) {
    updates.ticket_max_usd = null
  }

  if (Array.isArray(body.languages)) {
    updates.languages = (body.languages as unknown[]).filter(x => typeof x === 'string').slice(0, 15)
  }
  if (Array.isArray(body.expertise_areas)) {
    updates.expertise_areas = (body.expertise_areas as unknown[])
      .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 80)
      .slice(0, 30)
  }
  if (Array.isArray(body.invest_stages)) {
    updates.invest_stages = (body.invest_stages as unknown[]).filter(x => typeof x === 'string').slice(0, 10)
  }
  if (Array.isArray(body.invest_sectors)) {
    updates.invest_sectors = (body.invest_sectors as unknown[]).filter(x => typeof x === 'string').slice(0, 20)
  }
  if (typeof body.is_listed === 'boolean') {
    updates.is_listed = body.is_listed
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('vc_profiles')
    .update(updates)
    .eq('user_id', user.id)

  if (error) {
    console.error('[/api/experts/profile] update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
