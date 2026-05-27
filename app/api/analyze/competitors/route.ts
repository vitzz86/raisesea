import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeCompetitors } from '@/lib/gemini'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
export const maxDuration = 120
export async function POST(req: NextRequest) {
  try {
    const { submission_id } = await req.json()
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
