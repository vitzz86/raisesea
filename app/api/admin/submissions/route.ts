import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('admin_auth')
  if (cookie?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select(`
      id, company_name, country, stage, raise_target_usd,
      annual_revenue_usd, sector, business_model,
      founder_name, founder_email, founder_linkedin, founder_profile,
      current_investors, one_liner, ai_description, ai_traction,
      deck_url, match_results, top_match_name, top_match_score,
      status, is_public, unique_slug, created_at
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submissions: data || [] })
}
