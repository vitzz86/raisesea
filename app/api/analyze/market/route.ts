import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeMarket } from '@/lib/gemini'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
export const maxDuration = 120
export async function POST(req: NextRequest) {
  try {
    const { submission_id } = await req.json()
    const { data: sub } = await supabase.from('submissions').select('*').eq('id', submission_id).single()
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const extraction = typeof sub.sector_profile === 'string' ? JSON.parse(sub.sector_profile) : sub.sector_profile
    const market_analysis = await analyzeMarket(extraction, sub.raise_target_usd || 0)
    await supabase.from('submissions').update({ market_analysis: JSON.stringify(market_analysis) }).eq('id', submission_id)
    return NextResponse.json({ success: true, market_analysis })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, { status: 500 })
  }
}
