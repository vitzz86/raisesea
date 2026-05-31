// ═══════════════════════════════════════════════════════════════
// PUT /api/experts/availability — replace the user's full set of
// weekly availability windows in one transaction (delete + reinsert).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

type WindowIn = {
  day_of_week: number
  start_time:  string  // 'HH:MM'
  end_time:    string
  timezone:    string
  is_active:   boolean
}

const VALID_TZ = new Set(['Asia/Singapore', 'Asia/Jakarta', 'Asia/Hong_Kong', 'Asia/Tokyo', 'UTC'])

export async function PUT(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { vc_profile_id?: string; windows?: WindowIn[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.vc_profile_id || !Array.isArray(body.windows)) {
    return NextResponse.json({ error: 'Missing vc_profile_id or windows' }, { status: 400 })
  }

  // Authorize: the vc_profile must belong to the requesting user AND be active
  const { data: profile } = await supabaseAdmin
    .from('vc_profiles')
    .select('user_id, application_status')
    .eq('id', body.vc_profile_id)
    .maybeSingle()

  if (!profile || profile.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile.application_status !== 'active') {
    return NextResponse.json({ error: 'Only approved experts can set availability' }, { status: 403 })
  }

  // Validate each window
  const valid: WindowIn[] = []
  for (const w of body.windows.slice(0, 50)) {
    if (typeof w.day_of_week !== 'number' || w.day_of_week < 0 || w.day_of_week > 6) continue
    if (!/^\d{2}:\d{2}$/.test(w.start_time) || !/^\d{2}:\d{2}$/.test(w.end_time)) continue
    if (w.end_time <= w.start_time) continue
    if (!VALID_TZ.has(w.timezone)) continue
    valid.push({
      day_of_week: w.day_of_week,
      start_time:  w.start_time + ':00',  // PG expects HH:MM:SS
      end_time:    w.end_time + ':00',
      timezone:    w.timezone,
      is_active:   w.is_active !== false,
    })
  }

  // Replace strategy: delete all existing then insert new (simpler than diffing)
  const { error: delErr } = await supabaseAdmin
    .from('vc_availability')
    .delete()
    .eq('vc_profile_id', body.vc_profile_id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (valid.length > 0) {
    const { error: insErr } = await supabaseAdmin
      .from('vc_availability')
      .insert(valid.map(w => ({ ...w, vc_profile_id: body.vc_profile_id })))
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: valid.length })
}
