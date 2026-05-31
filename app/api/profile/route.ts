// ═══════════════════════════════════════════════════════════════
// PATCH /api/profile — update current user's profile
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_COUNTRIES = ['Singapore', 'Indonesia', 'Malaysia', 'Vietnam', 'Thailand', 'Philippines', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'Timor-Leste']
const ALLOWED_SECTORS = ['AI/ML', 'Fintech', 'SaaS', 'E-commerce', 'Healthtech', 'Logistics', 'Edtech', 'Agritech', 'Cleantech', 'Deep Tech', 'Consumer', 'Cybersecurity', 'Crypto/Web3']

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Sanitize each field — never trust client input
  const updates: Record<string, unknown> = {}

  if (typeof body.full_name === 'string') {
    updates.full_name = body.full_name.trim().slice(0, 100)
  }
  if (typeof body.company_name === 'string') {
    updates.company_name = body.company_name.trim().slice(0, 100)
  }
  if (typeof body.country === 'string') {
    if (body.country === '' || ALLOWED_COUNTRIES.includes(body.country)) {
      updates.country = body.country || null
    }
  }
  if (Array.isArray(body.news_sectors)) {
    updates.news_sectors = body.news_sectors
      .filter((s): s is string => typeof s === 'string' && ALLOWED_SECTORS.includes(s))
      .slice(0, 20)
  }
  if (typeof body.email_digest_enabled === 'boolean') {
    updates.email_digest_enabled = body.email_digest_enabled
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Use service role to bypass RLS (we've already authenticated above)
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    console.error('[/api/profile] update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
