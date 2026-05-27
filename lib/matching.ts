import { Investor, MatchResult } from './supabase'

export type SectorProfile = {
  primary_sector: string
  secondary_sectors: string[]
  sector_weights: Record<string, number>
  sub_categories: string[]
}

export type FounderProfile = {
  country: string
  stage: string
  raise_target_usd: number
  sector: string
  sector_profile?: SectorProfile
  business_model: string
  annual_revenue_usd: number
  current_mrr_usd: number
  founder_profile: string
  one_liner?: string
  problem?: string
  ai_description?: string
  ai_traction?: string
  excluded_investor_ids?: string[]
}

export type WarmIntro = {
  target_investor_name: string
  target_investor_id: string
  via_investor_name: string
  relationship: string
}

const STAGE_LEVEL: Record<string, number> = {
  'Pre-seed': 1, 'Seed': 2, 'Pre-series A': 3,
  'Series A': 4, 'Series B': 5, 'Series C+': 6,
  'Bridge': 2.5, 'Venture Debt': 4, 'Grant': 1,
}

const TRACTION_ANNUAL: Record<string, number> = {
  'Pre-idea': 0, 'Pre-revenue': 0, 'Early revenue': 12000,
  '$10K+ MRR': 120000, '$50K+ MRR': 600000,
  'EBITDA Positive': 1200000, 'Profitable': 2400000,
}

const COUNTRY_NAMES: Record<string, string[]> = {
  'ID': ['indonesia','indonesian'], 'SG': ['singapore','singaporean'],
  'VN': ['vietnam','vietnamese'],  'PH': ['philippines','philippine','filipino'],
  'MY': ['malaysia','malaysian'],  'TH': ['thailand','thai'],
  'MM': ['myanmar','burmese'],     'KH': ['cambodia','cambodian'],
  'LA': ['laos','laotian'],        'BN': ['brunei','bruneian'],
  'TL': ['timor-leste','east timor','timorese'],
}

// Map common form values (full country names) back to ISO codes for matching.
// The form sends "Singapore" but invest_countries stores ["SG", ...].
const NAME_TO_ISO: Record<string, string> = Object.entries(COUNTRY_NAMES)
  .reduce((acc, [iso, names]) => {
    names.forEach(n => { acc[n] = iso })
    return acc
  }, {} as Record<string, string>)

export function normalizeCountry(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()
  // Already an ISO code?
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed
  return NAME_TO_ISO[trimmed.toLowerCase()] || trimmed
}

const SEA_ISO = ['ID','SG','VN','PH','MY','TH','MM','KH','LA','BN','TL']

// Related sectors for cross-matching
const RELATED_SECTORS: Record<string, string[]> = {
  'Agritech':    ['Foodtech','Cleantech','Logistics','AI/ML','Deep Tech'],
  'Foodtech':    ['Agritech','Cleantech','Consumer','E-commerce','Logistics'],
  'Cleantech':   ['Agritech','Foodtech','Deep Tech','AI/ML','Real Estate'],
  'AI/ML':       ['SaaS','Deep Tech','Developer Tools','Healthtech','Fintech'],
  'SaaS':        ['AI/ML','Developer Tools','E-commerce','Fintech','Healthtech'],
  'Fintech':     ['E-commerce','SaaS','Crypto/Web3','Consumer','Logistics'],
  'Healthtech':  ['Deep Tech','AI/ML','Biotech','Consumer','SaaS'],
  'E-commerce':  ['Fintech','Logistics','Consumer','Foodtech','SaaS'],
  'Logistics':   ['E-commerce','Mobility','SaaS','Agritech','Fintech'],
  'Deep Tech':   ['AI/ML','Cleantech','Biotech','Developer Tools','SaaS'],
  'Edtech':      ['Consumer','SaaS','AI/ML','Healthtech','Media'],
  'Crypto/Web3': ['Fintech','Developer Tools','Gaming','Media','Deep Tech'],
  'Mobility':    ['Logistics','Cleantech','Deep Tech','Consumer','SaaS'],
}

// ============================================================
// HARD FILTER
// ============================================================
export function hardFilter(investors: Investor[], founder: FounderProfile): Investor[] {
  const excluded = new Set(founder.excluded_investor_ids || [])
  const annualRevenue = founder.annual_revenue_usd || (founder.current_mrr_usd * 12)

  return investors.filter(inv => {
    // Exclude existing investors
    if (excluded.has(inv.id)) return false

    // Must be active OR unknown (don't filter out unknown — many investors have no signal)
    if (inv.is_active === 'No') return false

    // Must invest in founder's country
    const countries = inv.invest_countries || []
    if (!countries.includes(founder.country)) return false

    // Stage filter — allow 1 level adjacency
    const stages     = inv.invest_stages || []
    const founderLvl = STAGE_LEVEL[founder.stage] || 2
    const stageLvls  = stages.map(s => STAGE_LEVEL[s] || 0).filter(Boolean)
    if (stageLvls.length === 0) return false
    if (founderLvl < Math.min(...stageLvls) - 1 || founderLvl > Math.max(...stageLvls) + 1) return false

    // Ticket size
    const raise = founder.raise_target_usd
    if (inv.ticket_max_usd && inv.ticket_max_usd < raise * 0.3) return false
    if (inv.ticket_min_usd && inv.ticket_min_usd > raise * 1.5) return false

    // Traction — only enforce when we actually know the founder's revenue.
    // If extraction returned 0 for both fields, treat it as "unknown" not "zero".
    const revenueKnown = annualRevenue > 0 || (founder.current_mrr_usd > 0)
    const minT = inv.min_traction_stage
    if (revenueKnown && minT && TRACTION_ANNUAL[minT] !== undefined) {
      if (annualRevenue < TRACTION_ANNUAL[minT]) return false
    }

    return true
  })
}

// ============================================================
// SCORING
// ============================================================
export function scoreInvestor(inv: Investor, founder: FounderProfile): {
  score: number; reason: string; breakdown: Record<string, number>
} {
  const breakdown: Record<string, number> = {}
  const annualRevenue = founder.annual_revenue_usd || (founder.current_mrr_usd * 12)

  // 1. ACTIVE STATUS (20pts) — give credit even when confidence is unknown
  const activeScore =
    inv.is_active === 'Yes' && inv.active_confidence === 'High'   ? 20 :
    inv.is_active === 'Yes' && inv.active_confidence === 'Medium' ? 14 :
    inv.is_active === 'Yes' && inv.active_confidence === 'Low'    ?  8 :
    inv.is_active === 'Yes'                                        ? 12 :  // active=Yes, confidence not set
    inv.is_active === 'Unknown'                                    ?  6 : 0
  breakdown.active = activeScore

  // 2. SECTOR DEPTH (22pts) — weighted multi-sector
  let sectorScore = 0
  const secDetail = inv.top_sectors_detail || ''
  const sectorWeights = founder.sector_profile?.sector_weights || { [founder.sector]: 1.0 }
  const subCategories = founder.sector_profile?.sub_categories || []

  // Score each sector the founder operates in
  let weightedSectorScore = 0
  Object.entries(sectorWeights).forEach(([sector, weight]) => {
    const regex = new RegExp(escapeRegex(sector) + '\\s*\\((\\d+)%\\)', 'i')
    const match = secDetail.match(regex)
    if (match) {
      const pct = parseInt(match[1])
      weightedSectorScore += (pct / 50) * 22 * weight
    } else {
      const sectors = inv.invest_sectors || []
      if (sectors.includes(sector)) weightedSectorScore += 10 * weight
      else {
        const related = RELATED_SECTORS[sector] || []
        if (sectors.some(s => related.includes(s))) weightedSectorScore += 5 * weight
      }
    }
  })
  sectorScore = Math.round(Math.min(22, weightedSectorScore))

  // Sub-category bonus (+3 max)
  const invThesisLower = ((inv.investment_thesis || '') + ' ' + (inv.description || '')).toLowerCase()
  const subBonus = subCategories.some(sub => invThesisLower.includes(sub.toLowerCase())) ? 3 : 0
  sectorScore = Math.min(22, sectorScore + subBonus)
  breakdown.sector = sectorScore

  // 3. STAGE FIT (20pts)
  const stages     = inv.invest_stages || []
  const founderLvl = STAGE_LEVEL[founder.stage] || 2
  let stageScore   = 0
  if (stages.includes(founder.stage)) {
    stageScore = 20
  } else {
    const lvls = stages.map(s => STAGE_LEVEL[s] || 0).filter(Boolean)
    if (lvls.length > 0) {
      const diff = Math.min(Math.abs(founderLvl - Math.min(...lvls)), Math.abs(founderLvl - Math.max(...lvls)))
      stageScore = diff <= 1 ? 10 : 0
    }
  }
  breakdown.stage = stageScore

  // 4. TICKET SIZE FIT (18pts)
  let ticketScore  = 0
  const raise      = founder.raise_target_usd
  const tMin       = inv.ticket_min_usd || 0
  const tMax       = inv.ticket_max_usd || Infinity
  const leadTicket = raise * 0.5

  if (tMin === 0 && tMax === Infinity)                               ticketScore = 9
  else if (leadTicket >= tMin && leadTicket <= tMax)                 ticketScore = 18
  else if (raise >= tMin && raise <= tMax)                           ticketScore = 14
  else if (leadTicket < tMin && leadTicket >= tMin * 0.5)            ticketScore = 8
  else if (leadTicket > tMax && leadTicket <= tMax * 1.5)            ticketScore = 8
  else                                                                ticketScore = 2
  breakdown.ticket = ticketScore

  // THESIS scoring removed — produced too-low signal because investor.investment_thesis
  // often doesn't contain the founder's exact keywords. The signal it provided was
  // mostly redundant with sector + location matching anyway.
  breakdown.thesis = 0

  // 6. LOCATION FOCUS (8pts)
  let locationScore  = 0
  const seaCountries = (inv.invest_countries || []).filter(c => SEA_ISO.includes(c))
  const inCountry    = (inv.invest_countries || []).includes(founder.country)

  if (inv.hq_in_sea && inCountry)                locationScore = 8
  else if (inv.hq_in_sea)                         locationScore = 5
  else if (seaCountries.length >= 3 && inCountry) locationScore = 5
  else if (seaCountries.length >= 2 && inCountry) locationScore = 3
  else if (seaCountries.length === 1)              locationScore = 1

  // Boost if meaningful portfolio in country
  const locDetail = inv.invest_locations_detail || ''
  const cNames    = COUNTRY_NAMES[founder.country] || []
  const locMatch  = locDetail.match(new RegExp('(' + cNames.join('|') + ')\\s*\\((\\d+)%\\)', 'i'))
  if (locMatch && (inv.num_investments || 0) >= 10) {
    if (parseInt(locMatch[2]) >= 30) locationScore = Math.min(8, locationScore + 2)
  }
  breakdown.location = locationScore

  // Lead bonus — raw score is now out of 88 (was 100). Rescale to 100-point scale.
  let rawTotal = activeScore + sectorScore + stageScore + ticketScore + locationScore
  if (inv.investment_strategy === 'Lead' || inv.investment_strategy === 'Co-lead') {
    rawTotal = Math.min(88, rawTotal + 2)
    breakdown.lead_bonus = 2
  }
  const total = Math.min(100, (rawTotal / 88) * 100)

  const finalScore = Math.round(Math.min(100, total))
  return { score: finalScore, reason: generateReason(inv, founder, breakdown), breakdown }
}

// ============================================================
// WARM INTROS
// ============================================================
export function findWarmIntros(
  topMatches: MatchResult[],
  currentInvestors: Array<{ id: string; name: string; co_investors: string }>,
  allInvestors: Investor[]
): WarmIntro[] {
  const intros: WarmIntro[] = []
  const topMatchIds = new Set(topMatches.map(m => m.investor_id))
  const topMatchNames = new Set(topMatches.map(m => m.investor?.name?.toLowerCase()))

  currentInvestors.forEach(current => {
    if (!current.co_investors) return
    const coInvestorNames = current.co_investors.split(',').map(s => s.trim().toLowerCase())

    coInvestorNames.forEach(coName => {
      // Find this co-investor in our database
      const found = allInvestors.find(inv =>
        inv.name.toLowerCase().includes(coName) || coName.includes(inv.name.toLowerCase().substring(0, 8))
      )
      if (!found) return
      // Check if it's in top matches but NOT already a current investor
      if (topMatchIds.has(found.id) || topMatchNames.has(found.name.toLowerCase())) {
        const alreadyAdded = intros.find(i => i.target_investor_id === found.id)
        if (!alreadyAdded) {
          intros.push({
            target_investor_name: found.name,
            target_investor_id:   found.id,
            via_investor_name:    current.name,
            relationship:         `${current.name} has co-invested with ${found.name} before`,
          })
        }
      }
    })
  })

  return intros.slice(0, 5)
}

// ============================================================
// MAIN
// ============================================================
export function runMatching(investors: Investor[], founder: FounderProfile): MatchResult[] {
  const candidates = hardFilter(investors, founder)
  const scored = candidates.map(inv => {
    const { score, reason, breakdown } = scoreInvestor(inv, founder)
    return {
      investor_id: inv.id, investor: inv, score, reason,
      score_breakdown: {
        active: breakdown.active || 0, sector: breakdown.sector || 0,
        stage: breakdown.stage || 0,   ticket: breakdown.ticket || 0,
        thesis: breakdown.thesis || 0, location: breakdown.location || 0,
      }
    } as MatchResult
  })
  return scored.sort((a, b) => b.score - a.score).slice(0, 10)
}

// ── Helpers ──────────────────────────────────────────────────
function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function extractKeyTerms(text: string): string[] {
  const stopWords = new Set(['the','and','for','with','our','that','this','from','are','were','have','they','their','into','also'])
  return text.split(/\s+/)
    .filter(w => w.length > 5 && !stopWords.has(w))
    .slice(0, 20)
}

function getSectorKeywords(sector: string): string[] {
  const map: Record<string, string[]> = {
    'Agritech':    ['agritech','agriculture','farming','aquaculture','fisheries','shrimp','crop'],
    'AI/ML':       ['artificial intelligence','machine learning',' ai ','deep learning','nlp'],
    'SaaS':        ['saas','software as a service','enterprise software','subscription'],
    'Fintech':     ['fintech','financial technology','payments','lending','banking'],
    'Healthtech':  ['health','healthcare','medtech','medical','clinical'],
    'E-commerce':  ['ecommerce','e-commerce','retail','marketplace','commerce'],
    'Logistics':   ['logistics','supply chain','shipping','delivery','warehousing'],
    'Cleantech':   ['clean energy','renewable','sustainability','climate','carbon'],
    'Foodtech':    ['foodtech','food tech','food processing','restaurant'],
    'Deep Tech':   ['deep tech','hardware','robotics','semiconductor','iot'],
    'Edtech':      ['edtech','education','learning','training'],
    'Crypto/Web3': ['crypto','blockchain','web3','defi'],
    'Consumer':    ['consumer','lifestyle','social','gaming'],
    'Mobility':    ['mobility','transportation','automotive','electric'],
  }
  return map[sector] || [sector.toLowerCase()]
}

function getStageKeywords(stage: string): string[] {
  const map: Record<string, string[]> = {
    'Pre-seed': ['pre-seed','very early'], 'Seed': ['seed','early stage'],
    'Pre-series A': ['pre-series a','pre-a'], 'Series A': ['series a'],
    'Series B': ['series b','growth'], 'Series C+': ['series c','late stage'],
  }
  return map[stage] || [stage.toLowerCase()]
}

function generateReason(inv: Investor, founder: FounderProfile, b: Record<string, number>): string {
  const parts: string[] = []
  if (b.active >= 20)       parts.push('actively deploying 2024-2025')
  else if (b.active >= 14)  parts.push('actively investing')
  if (b.sector >= 16)       parts.push(`strong ${founder.sector} portfolio`)
  else if (b.sector >= 10)  parts.push(`backs ${founder.sector} startups`)
  if (b.ticket >= 18)       parts.push('ticket fits raise perfectly')
  else if (b.ticket >= 14)  parts.push('ticket size compatible')
  if (b.location >= 8)      parts.push(`${founder.country}-focused fund`)
  else if (b.location >= 5) parts.push('active in SEA')
  if (b.stage >= 20)        parts.push(`specialist at ${founder.stage}`)
  if (b.lead_bonus)         parts.push('leads rounds')
  return parts.slice(0, 3).join(' · ') || 'Matches your stage and sector'
}
