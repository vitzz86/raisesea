import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/mock-pitch/sessions — list user's past sessions
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .select('id, submission_id, mode, duration_min, status, started_at, completed_at, debrief')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Lookup submission names for display
  const subIds = Array.from(new Set((data || []).map(s => s.submission_id).filter(Boolean) as string[]))
  let subNames: Record<string, { company_name: string; unique_slug: string }> = {}
  if (subIds.length > 0) {
    const { data: subs } = await supabaseAdmin
      .from('submissions')
      .select('id, company_name, unique_slug')
      .in('id', subIds)
    subNames = Object.fromEntries((subs || []).map(s => [s.id as string, { company_name: s.company_name, unique_slug: s.unique_slug }]))
  }

  return NextResponse.json({
    sessions: (data || []).map(s => ({
      ...s,
      submission: s.submission_id ? subNames[s.submission_id] || null : null,
    })),
  })
}
