import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeCompetitors } from '@/lib/gemini'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { enforceApiRateLimit } from '@/lib/rate-limit'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
export const maxDuration = 120
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await isSuperAdmin(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const rateLimitResponse = await enforceApiRateLimit(user.id, 'admin_analyze_competitors', 20, 3600)
    if (rateLimitResponse) return rateLimitResponse

    const { submission_id } = await req.json()
    if (typeof submission_id !== 'string' || !submission_id) {
      return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })
    }
    const { data: sub } = await supabase.from('submissions').select('*').eq('id', submission_id).single()
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const extraction = typeof sub.sector_profile === 'string' ? JSON.parse(sub.sector_profile) : sub.sector_profile
    const matchResults = typeof sub.match_results === 'string' ? JSON.parse(sub.match_results) : (sub.match_results || [])
    const topInvestorNames = matchResults.slice(0, 5).map((m: { investor: { name: string } }) => m.investor.name)
    const competitive_analysis = await analyzeCompetitors(extraction, topInvestorNames)
    await supabase.from('submissions').update({ competitive_analysis: JSON.stringify(competitive_analysis) }).eq('id', submission_id)
    return NextResponse.json({ success: true, competitive_analysis })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, { status: 500 })
  }
}
