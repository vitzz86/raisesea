import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_TYPES = ['vc','cvc','corporate','angel','advisor','domain_expert']

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Validate
  const profileTypes = Array.isArray(body.profile_types)
    ? (body.profile_types as string[]).filter(t => VALID_TYPES.includes(t)).slice(0, 6)
    : []
  if (profileTypes.length === 0) return NextResponse.json({ error: 'Pick at least one profile type' }, { status: 400 })

  const displayName  = typeof body.display_name === 'string'  ? body.display_name.trim().slice(0, 100)  : ''
  const bio          = typeof body.bio === 'string'           ? body.bio.trim().slice(0, 2000)          : ''
  const whatIOffer   = typeof body.what_i_offer === 'string'  ? body.what_i_offer.trim().slice(0, 2000) : ''
  const linkedinUrl  = typeof body.linkedin_url === 'string'  ? body.linkedin_url.trim().slice(0, 500)  : ''

  if (!displayName)                 return NextResponse.json({ error: 'Display name required' }, { status: 400 })
  if (bio.length < 50)              return NextResponse.json({ error: 'Bio must be 50+ chars' }, { status: 400 })
  if (whatIOffer.length < 30)       return NextResponse.json({ error: 'What you offer must be 30+ chars' }, { status: 400 })
  if (!linkedinUrl.includes('linkedin.com')) return NextResponse.json({ error: 'Valid LinkedIn URL required' }, { status: 400 })

  const expertiseAreas = Array.isArray(body.expertise_areas)
    ? (body.expertise_areas as string[]).filter(s => typeof s === 'string' && s.length > 0 && s.length < 80).slice(0, 30)
    : []
  if (expertiseAreas.length === 0) return NextResponse.json({ error: 'Pick at least one expertise area' }, { status: 400 })

  // Build the row — only include fields we trust
  const row: Record<string, unknown> = {
    user_id:           user.id,
    profile_types:     profileTypes,
    profile_type:      profileTypes[0],  // legacy field — pick the first as default
    display_name:      displayName,
    fund_or_firm:      typeof body.fund_or_firm === 'string' ? body.fund_or_firm.trim().slice(0, 100) : null,
    title:             typeof body.title === 'string'        ? body.title.trim().slice(0, 100)        : null,
    bio,
    what_i_offer:      whatIOffer,
    linkedin_url:      linkedinUrl,
    website:           typeof body.website === 'string' ? body.website.trim().slice(0, 500) : null,
    company_website:      typeof body.company_website === 'string'      ? body.company_website.trim().slice(0, 500) : null,
    company_linkedin_url: typeof body.company_linkedin_url === 'string' ? body.company_linkedin_url.trim().slice(0, 500) : null,
    avatar_url:           typeof body.avatar_url === 'string' && body.avatar_url.startsWith('http') ? body.avatar_url.slice(0, 1000) : null,
    hq_country:        typeof body.hq_country === 'string' ? body.hq_country.trim().slice(0, 50) : null,
    hq_city:           typeof body.hq_city === 'string'    ? body.hq_city.trim().slice(0, 100)   : null,
    years_experience:  typeof body.years_experience === 'number' && body.years_experience >= 0 && body.years_experience <= 80 ? body.years_experience : null,
    languages:         Array.isArray(body.languages) ? (body.languages as string[]).filter(l => typeof l === 'string').slice(0, 15) : [],
    expertise_areas:   expertiseAreas,
    invest_stages:     Array.isArray(body.invest_stages)  ? (body.invest_stages as string[]).filter(s => typeof s === 'string').slice(0, 10)  : [],
    invest_sectors:    Array.isArray(body.invest_sectors) ? (body.invest_sectors as string[]).filter(s => typeof s === 'string').slice(0, 20) : [],
    ticket_min_usd:    typeof body.ticket_min_usd === 'number' && body.ticket_min_usd >= 0 ? body.ticket_min_usd : null,
    ticket_max_usd:    typeof body.ticket_max_usd === 'number' && body.ticket_max_usd >= 0 ? body.ticket_max_usd : null,
    investment_thesis: typeof body.investment_thesis === 'string' ? body.investment_thesis.trim().slice(0, 2000) : null,
    application_status: 'pending',
    is_listed:         false,  // becomes true once approved
    is_active:         true,
  }

  // Upsert — if user previously had a rejected application, allow resubmission
  const { error } = await supabaseAdmin
    .from('vc_profiles')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error('[/api/experts/apply] insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
