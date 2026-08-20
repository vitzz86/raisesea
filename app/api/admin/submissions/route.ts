import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'

export async function GET(_req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isSuperAdmin(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
