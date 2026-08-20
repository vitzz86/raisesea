import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeDeck } from '@/lib/gemini'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
export const maxDuration = 120
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await isSuperAdmin(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { submission_id } = await req.json()
    if (typeof submission_id !== 'string' || !submission_id) {
      return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })
    }
    const { data: sub, error } = await supabase.from('submissions').select('*').eq('id', submission_id).single()
    if (error || !sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    const extraction = typeof sub.sector_profile === 'string' ? JSON.parse(sub.sector_profile) : sub.sector_profile
    if (!extraction) return NextResponse.json({ error: 'No extraction data' }, { status: 400 })
    const deck_analysis = await analyzeDeck(extraction)
    await supabase.from('submissions').update({ deck_analysis: JSON.stringify(deck_analysis) }).eq('id', submission_id)
    return NextResponse.json({ success: true, deck_analysis })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, { status: 500 })
  }
}
