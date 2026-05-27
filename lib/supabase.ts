import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc  = process.env.SUPABASE_SERVICE_KEY!

export const supabase      = createClient(url, anon)
export const supabaseAdmin = createClient(url, svc)

export type Investor = {
  id: string; name: string; type: string; hq_country: string; hq_city: string
  hq_in_sea: boolean; invest_countries: string[]; invest_sectors: string[]
  invest_stages: string[]; ticket_min_usd: number; ticket_max_usd: number
  ticket_notes: string; description: string; investment_thesis: string
  website: string; linkedin: string; email: string; num_investments: number
  num_exits: number; avg_rating: number; total_reviews: number
  leadership_name: string; leadership_title: string; leadership_linkedin: string
  leadership_email: string; notable_portfolio: string; co_investors: string
  top_sectors_detail: string; invest_locations_detail: string; logo_url: string
  is_active: string; active_confidence: string; active_evidence: string
  investment_strategy: string; follow_on_investment: string
  investment_instrument: string; business_model_pref: string
  min_traction_stage: string; founder_preference: string
  ownership_preference: string; value_add: string; is_visible: boolean
}

export type Submission = {
  id: string; company_name: string; country: string; stage: string
  raise_target_usd: number; sector: string; sector_profile: any
  business_model: string; annual_revenue_usd: number; current_mrr_usd: number
  one_liner: string; problem: string; founder_name: string; founder_email: string
  founder_linkedin: string; founder_profile: string; deck_url: string
  ai_description: string; ai_traction: string; ai_market_size: string
  ai_team_summary: string; current_investors: string; match_results: MatchResult[]
  warm_intros: WarmIntro[]; top_match_name: string; top_match_score: number
  status: string; is_public: boolean; unique_slug: string
  created_at: string; matched_at: string
}

export type MatchResult = {
  investor_id: string; investor: Investor; score: number; reason: string
  score_breakdown: {
    active: number; sector: number; stage: number
    ticket: number; thesis: number; location: number
  }
}

export type WarmIntro = {
  target_investor_name: string; target_investor_id: string
  via_investor_name: string; relationship: string
}
