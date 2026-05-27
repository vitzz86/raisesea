// lib/intelligence-db.ts
// RaiseSEA Pre-built Intelligence Database v1.0
// ─────────────────────────────────────────────
// All data sourced from named public research (2024-2026).
// Used as the baseline layer. Gemini validates and enriches
// each data point in real-time before displaying to founders.
// See: RaiseSEA_Intelligence_Database_v3_clean.xlsx for full sourcing.

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type Stage = 'Pre-seed' | 'Seed' | 'Pre-series A' | 'Series A' | 'Series B' | 'Series C+'

export interface RoundBenchmark {
  stage:              Stage
  sea_raise_low_usd:  number
  sea_raise_high_usd: number
  sea_raise_median_usd: number
  global_raise_ref_usd: number       // US/EU reference — not target
  sea_premoney_low_usd: number
  sea_premoney_high_usd: number
  sea_premoney_median_usd: number
  investor_types:     string[]
  min_traction:       string
  key_risk:           string
  data_date:          string
  source:             string
  confidence:         ConfidenceLevel
}

export interface ValuationBySector {
  sector:                     string
  stage:                      Stage
  sea_premoney_low_usd:       number
  sea_premoney_high_usd:      number
  sea_premoney_median_usd:    number
  global_premoney_ref_usd:    number  // US reference
  sector_multiplier:          number  // vs base SEA valuation
  key_valuation_driver:       string
  series_a_traction_bar:      string
  data_date:                  string
  source:                     string
  confidence:                 ConfidenceLevel
}

export interface RevenueMultiple {
  sector:               string
  stage:                string
  primary_method:       string
  ev_revenue_low:       number | null
  ev_revenue_high:      number | null
  ev_revenue_median:    number | null
  ev_ebitda_low:        number | null
  ev_ebitda_high:       number | null
  ev_ebitda_median:     number | null
  arr_multiple_low:     number | null
  arr_multiple_high:    number | null
  arr_multiple_median:  number | null
  key_driver:           string
  when_to_use:          string
  data_date:            string
  source:               string
  confidence:           ConfidenceLevel
}

export interface DilutionBenchmark {
  round:                string
  dilution_low_pct:     number
  dilution_high_pct:    number
  dilution_median_pct:  number
  danger_zone_pct:      number       // single-round threshold
  founder_pct_after:    string       // cumulative range
  notes:                string
  source:               string
  confidence:           ConfidenceLevel
}

export interface MarketSize {
  sector:               string
  sea_market_size:      string
  year_forecast:        string
  cagr_pct:            number | null
  tam_usd:              number
  sam_usd_sea:          number
  bottom_up_formula:    string       // starter formula for deck generation
  key_countries:        string[]
  growth_drivers:       string[]
  source:               string
  data_date:            string
  confidence:           ConfidenceLevel
}

export interface SectorMultiple {
  sector:       string
  low:          number
  mid:          number
  high:         number
}

// ═══════════════════════════════════════════════════════════════
// 1. SEA ROUND BENCHMARKS
// Source: Equidam H1 2025, Cento Ventures 2024, Dealroom Q2-Q3 2024,
//         Visible.vc Jan 2026, Y Consulting Oct 2024
// ═══════════════════════════════════════════════════════════════
export const ROUND_BENCHMARKS: RoundBenchmark[] = [
  {
    stage:                    'Pre-seed',
    sea_raise_low_usd:        50_000,
    sea_raise_high_usd:       500_000,
    sea_raise_median_usd:     175_000,
    global_raise_ref_usd:     1_000_000,
    sea_premoney_low_usd:     1_000_000,
    sea_premoney_high_usd:    4_000_000,
    sea_premoney_median_usd:  2_100_000,
    investor_types:           ['Angel', 'Micro-VC', 'Accelerator'],
    min_traction:             'Idea + team. MVP concept. No revenue required.',
    key_risk:                 'Raising >$500K at <$1M val = over-dilution. $0 = bootstrap trap.',
    data_date:                'Q1-Q2 2025',
    source:                   'Equidam H1 2025; Papermark Nov 2025',
    confidence:               'high',
  },
  {
    stage:                    'Seed',
    sea_raise_low_usd:        250_000,
    sea_raise_high_usd:       3_000_000,
    sea_raise_median_usd:     1_000_000,
    global_raise_ref_usd:     2_500_000,
    sea_premoney_low_usd:     3_000_000,
    sea_premoney_high_usd:    10_000_000,
    sea_premoney_median_usd:  6_000_000,
    investor_types:           ['Seed VC', 'Angel syndicate', 'Accelerator fund'],
    min_traction:             'MVP live. Early traction (users or revenue). Core team.',
    key_risk:                 'SEA seed funding dropped 72% YoY by 9M 2025 (Visible.vc). Very selective market.',
    data_date:                'Q3-Q4 2025',
    source:                   'Equidam Q4 2024; Visible.vc Jan 2026; Y Consulting Oct 2024',
    confidence:               'high',
  },
  {
    stage:                    'Pre-series A',
    sea_raise_low_usd:        1_000_000,
    sea_raise_high_usd:       5_000_000,
    sea_raise_median_usd:     2_500_000,
    global_raise_ref_usd:     4_000_000,
    sea_premoney_low_usd:     5_000_000,
    sea_premoney_high_usd:    15_000_000,
    sea_premoney_median_usd:  10_000_000,
    investor_types:           ['Regional VC', 'Follow-on from seed investor'],
    min_traction:             'PMF evidence. Revenue growth curve. MoM clarity.',
    key_risk:                 'Often SAFE/bridge. Pre-A median deal size doubled in 2024 as deal volume dwindled (Cento).',
    data_date:                '2024-2025',
    source:                   'Cento Ventures 2024; Equidam Q4 2024',
    confidence:               'medium',
  },
  {
    stage:                    'Series A',
    sea_raise_low_usd:        3_000_000,
    sea_raise_high_usd:       15_000_000,
    sea_raise_median_usd:     6_500_000,
    global_raise_ref_usd:     12_000_000,
    sea_premoney_low_usd:     15_000_000,
    sea_premoney_high_usd:    50_000_000,
    sea_premoney_median_usd:  25_000_000,
    investor_types:           ['Institutional VC', 'Multi-stage fund'],
    min_traction:             'PMF proven. $150K-500K MRR (SaaS) or equivalent. Consistent growth. 18-24mo runway.',
    key_risk:                 'Profitability commands 3.5x valuation premium at Series A in SEA (Obliqueasia 2025).',
    data_date:                'H2 2024 – H1 2025',
    source:                   'Cento Ventures 2024; Obliqueasia Oct 2025; Y Consulting Oct 2024',
    confidence:               'high',
  },
  {
    stage:                    'Series B',
    sea_raise_low_usd:        10_000_000,
    sea_raise_high_usd:       40_000_000,
    sea_raise_median_usd:     20_000_000,
    global_raise_ref_usd:     37_000_000,
    sea_premoney_low_usd:     40_000_000,
    sea_premoney_high_usd:    120_000_000,
    sea_premoney_median_usd:  75_000_000,
    investor_types:           ['Multi-stage VC', 'Growth equity fund'],
    min_traction:             '$2M+ MRR, profitable or near-profitable unit econ, clear market leadership path.',
    key_risk:                 'Only strongest companies accessing B in SEA 2024-2025. Driven by Healthtech and DFS.',
    data_date:                'H2 2024',
    source:                   'Cento Ventures 2024; StartupA.ge Mar 2026',
    confidence:               'high',
  },
  {
    stage:                    'Series C+',
    sea_raise_low_usd:        30_000_000,
    sea_raise_high_usd:       100_000_000,
    sea_raise_median_usd:     50_000_000,
    global_raise_ref_usd:     100_000_000,
    sea_premoney_low_usd:     100_000_000,
    sea_premoney_high_usd:    500_000_000,
    sea_premoney_median_usd:  200_000_000,
    investor_types:           ['Crossover fund', 'Late-stage VC', 'PE'],
    min_traction:             'Market leadership. Path to IPO or strategic exit. $10M+ MRR.',
    key_risk:                 'Rare in SEA 2024-2025. Singapore-concentrated. Unicorn territory.',
    data_date:                '2024-2025',
    source:                   'Visible.vc Jan 2026; Mean CEO Apr 2026',
    confidence:               'medium',
  },
]

// ═══════════════════════════════════════════════════════════════
// 2. VALUATION BENCHMARKS BY SECTOR
// Source: Equidam H1 2025, Flowjam 2025, Qubit Capital Mar 2026,
//         Finro Nov 2025, Windsor Drake Feb 2026, StartupA.ge Mar 2026
// ═══════════════════════════════════════════════════════════════
export const VALUATION_BY_SECTOR: ValuationBySector[] = [
  {
    sector: 'AI/ML',
    stage: 'Seed',
    sea_premoney_low_usd: 4_000_000, sea_premoney_high_usd: 8_000_000, sea_premoney_median_usd: 5_500_000,
    global_premoney_ref_usd: 12_000_000,
    sector_multiplier: 1.5,
    key_valuation_driver: 'Team quality + architecture + data moats. Pre-revenue OK with strong team. 42% higher seed val vs non-AI (Crunchbase 2026).',
    series_a_traction_bar: '$500K-$5M ARR OR strong enterprise pipeline. AI startups 70% higher Series A premium.',
    data_date: 'H1 2025', source: 'Qubit Capital Mar 2026; StartupA.ge Mar 2026; Equidam H1 2025', confidence: 'high',
  },
  {
    sector: 'Fintech',
    stage: 'Seed',
    sea_premoney_low_usd: 2_500_000, sea_premoney_high_usd: 5_000_000, sea_premoney_median_usd: 3_200_000,
    global_premoney_ref_usd: 8_000_000,
    sector_multiplier: 1.3,
    key_valuation_driver: 'Regulatory approval/license premium. Payments 4-6x EV/Rev. Lending compressed by rates.',
    series_a_traction_bar: '$3M-$10M ARR or $50M+ GMV. Geographic expansion story essential.',
    data_date: '2025', source: 'Finro Nov 2025; Windsor Drake Feb 2026; Flowjam 2025', confidence: 'high',
  },
  {
    sector: 'SaaS',
    stage: 'Seed',
    sea_premoney_low_usd: 2_000_000, sea_premoney_high_usd: 4_000_000, sea_premoney_median_usd: 2_800_000,
    global_premoney_ref_usd: 8_000_000,
    sector_multiplier: 1.2,
    key_valuation_driver: 'ARR multiple driven by NRR. NRR >120% = 11x ARR. NRR <100% = 2-4x discount.',
    series_a_traction_bar: '$150K-$500K MRR. Profitability commands 3.5x premium in SEA.',
    data_date: '2025-2026', source: 'Aventis May 2026; Windsor Drake Feb 2026; Obliqueasia Oct 2025', confidence: 'high',
  },
  {
    sector: 'Deep Tech',
    stage: 'Seed',
    sea_premoney_low_usd: 2_000_000, sea_premoney_high_usd: 5_000_000, sea_premoney_median_usd: 3_500_000,
    global_premoney_ref_usd: 9_000_000,
    sector_multiplier: 1.15,
    key_valuation_driver: 'Patent + IP + team basis. Hardware gets 0.8x vs pure software. Long dev cycles.',
    series_a_traction_bar: 'IP + 1-2 anchor enterprise pilots. Revenue less critical than technical feasibility proof.',
    data_date: '2025', source: 'Equidam H1 2025; Flowjam 2025', confidence: 'medium',
  },
  {
    sector: 'Healthtech',
    stage: 'Seed',
    sea_premoney_low_usd: 3_000_000, sea_premoney_high_usd: 7_000_000, sea_premoney_median_usd: 4_600_000,
    global_premoney_ref_usd: 10_000_000,
    sector_multiplier: 1.2,
    key_valuation_driver: 'Clinical vs consumer split. Clinical (regulated) commands highest multiples. 25% investment growth post-pandemic.',
    series_a_traction_bar: '$1M-$5M ARR or pilot with 3+ hospitals. Clinical evidence adds significant premium.',
    data_date: '2024-2025', source: 'Equidam H1 2025; Cento 2024', confidence: 'high',
  },
  {
    sector: 'E-commerce',
    stage: 'Seed',
    sea_premoney_low_usd: 1_500_000, sea_premoney_high_usd: 4_000_000, sea_premoney_median_usd: 2_100_000,
    global_premoney_ref_usd: 6_000_000,
    sector_multiplier: 0.9,
    key_valuation_driver: 'GMV x 1-3x take rate multiple. Or 2-4x take-rate revenue. Harder market 2025.',
    series_a_traction_bar: '$5M-$20M GMV with 25%+ growth. Take rate >5% preferred. Unit econ proof required.',
    data_date: '2025', source: 'Equidam H1 2025; Cento 2024', confidence: 'high',
  },
  {
    sector: 'Cleantech',
    stage: 'Seed',
    sea_premoney_low_usd: 2_000_000, sea_premoney_high_usd: 5_000_000, sea_premoney_median_usd: 3_500_000,
    global_premoney_ref_usd: 8_000_000,
    sector_multiplier: 1.3,
    key_valuation_driver: 'Capital intensive. Government co-investment available. Impact premium. Highest dilution sector (18.9% avg, Equidam).',
    series_a_traction_bar: 'Proof of scalable unit economics. Regulatory pathway clarity. Pre-revenue often OK.',
    data_date: 'H1 2025', source: 'Equidam H1 2025; Bain 2025', confidence: 'high',
  },
  {
    sector: 'Agritech',
    stage: 'Seed',
    sea_premoney_low_usd: 1_500_000, sea_premoney_high_usd: 3_500_000, sea_premoney_median_usd: 2_500_000,
    global_premoney_ref_usd: 5_000_000,
    sector_multiplier: 1.05,
    key_valuation_driver: 'Impact premium. Domain expertise highly valued. $1B+ SEA funding in 2024 (50% of APAC).',
    series_a_traction_bar: 'Farmer adoption proof + downstream buyer contracts. GMV or contract value basis.',
    data_date: '2024-2025', source: 'Bain 2025; Equidam H1 2025', confidence: 'medium',
  },
  {
    sector: 'Edtech',
    stage: 'Seed',
    sea_premoney_low_usd: 1_000_000, sea_premoney_high_usd: 3_000_000, sea_premoney_median_usd: 2_000_000,
    global_premoney_ref_usd: 5_000_000,
    sector_multiplier: 0.9,
    key_valuation_driver: 'Completion rates and retention metrics critical. $5B SEA market 2025. Govt grant leverage.',
    series_a_traction_bar: 'Strong cohort retention (>80%). B2B edtech (upskilling) preferred over B2C.',
    data_date: 'Q4 2025', source: 'Finro EdTech Q4 2025; HolonIQ 2024', confidence: 'medium',
  },
  {
    sector: 'Logistics',
    stage: 'Seed',
    sea_premoney_low_usd: 2_000_000, sea_premoney_high_usd: 5_000_000, sea_premoney_median_usd: 3_000_000,
    global_premoney_ref_usd: 7_000_000,
    sector_multiplier: 1.0,
    key_valuation_driver: 'Asset-light models preferred. Unit economics critical. Dense city network or proprietary route data = moat.',
    series_a_traction_bar: '$2M-$8M revenue with positive or near-positive unit econ. Coverage density proof.',
    data_date: '2025', source: 'Equidam H1 2025; Momentum Works 2024', confidence: 'medium',
  },
  {
    sector: 'Consumer',
    stage: 'Seed',
    sea_premoney_low_usd: 800_000, sea_premoney_high_usd: 2_500_000, sea_premoney_median_usd: 1_600_000,
    global_premoney_ref_usd: 4_000_000,
    sector_multiplier: 0.85,
    key_valuation_driver: 'User engagement + retention > revenue. Viral growth = lower dilution. Hard market in 2025.',
    series_a_traction_bar: 'Strong DAU/MAU (>30%), low CAC, high LTV. Proven monetization.',
    data_date: '2025', source: 'Equidam H1 2025', confidence: 'medium',
  },
  {
    sector: 'Cybersecurity',
    stage: 'Seed',
    sea_premoney_low_usd: 3_000_000, sea_premoney_high_usd: 8_000_000, sea_premoney_median_usd: 5_000_000,
    global_premoney_ref_usd: 12_000_000,
    sector_multiplier: 1.4,
    key_valuation_driver: 'Regulatory requirements driving demand. Enterprise contracts high switching cost. Clear ROI for clients.',
    series_a_traction_bar: 'Named enterprise clients. Demonstrated breach prevention ROI. SOC2 or equivalent.',
    data_date: '2025', source: 'General VC consensus; Equidam H1 2025', confidence: 'medium',
  },
]

// ═══════════════════════════════════════════════════════════════
// 3. EV/REVENUE MULTIPLES BY SECTOR & STAGE
// Source: Finro Jun 2025, QuantPillar Mar 2026, Windsor Drake Feb 2026,
//         Aventis May 2026, Qubit Capital Mar 2026, Finerva Q4 2025
// ═══════════════════════════════════════════════════════════════
export const REVENUE_MULTIPLES: RevenueMultiple[] = [
  // AI / ML
  {
    sector: 'AI/ML', stage: 'Seed',
    primary_method: 'EV/Revenue or ARR (team+IP basis if pre-revenue)',
    ev_revenue_low: 10, ev_revenue_high: 50, ev_revenue_median: 25,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: 15, arr_multiple_high: 40, arr_multiple_median: 25,
    key_driver: 'AI premium: 53% of global VC to AI in H1 2025. 42% higher seed val vs non-AI.',
    when_to_use: 'EV/Revenue or ARR if any revenue exists. Team/IP basis if pre-revenue.',
    data_date: 'H1 2025', source: 'Qubit Capital Mar 2026; StartupA.ge Mar 2026', confidence: 'high',
  },
  {
    sector: 'AI/ML', stage: 'Series A',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 15, ev_revenue_high: 35, ev_revenue_median: 23,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: 15, arr_multiple_high: 30, arr_multiple_median: 22,
    key_driver: 'AI startups 70% higher Series A valuation vs non-AI peers. Data moat and ARR quality critical.',
    when_to_use: 'EV/Revenue primary. ARR if subscription. EBITDA not yet applicable.',
    data_date: 'H1 2025', source: 'Qubit Capital Mar 2026; QuantPillar Mar 2026', confidence: 'high',
  },
  // SaaS
  {
    sector: 'SaaS', stage: 'Seed',
    primary_method: 'ARR Multiple',
    ev_revenue_low: 3, ev_revenue_high: 6, ev_revenue_median: 4.5,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: 3, arr_multiple_high: 6, arr_multiple_median: 4.5,
    key_driver: 'Early-stage private SaaS. Growth rate and NRR trajectory matter more than absolute revenue.',
    when_to_use: 'ARR multiple preferred. EV/Revenue if mixed model. Avoid EBITDA — pre-profit.',
    data_date: '2025-2026', source: 'Aventis May 2026; Windsor Drake Feb 2026', confidence: 'high',
  },
  {
    sector: 'SaaS', stage: 'Series A',
    primary_method: 'EV/Revenue or ARR',
    ev_revenue_low: 4, ev_revenue_high: 8, ev_revenue_median: 5.5,
    ev_ebitda_low: 10, ev_ebitda_high: 13, ev_ebitda_median: 11,
    arr_multiple_low: 5, arr_multiple_high: 8, arr_multiple_median: 6,
    key_driver: 'NRR benchmark 100-110%. Rule of 40 >40 = significant premium. Each +10pt = +1.1x multiple.',
    when_to_use: 'EV/Revenue primary. ARR for pure subscription. EV/EBITDA only if EBITDA-positive.',
    data_date: '2025', source: 'Windsor Drake Feb 2026; Livmo Apr 2026', confidence: 'high',
  },
  {
    sector: 'SaaS', stage: 'Series B',
    primary_method: 'EV/Revenue + EV/EBITDA',
    ev_revenue_low: 5, ev_revenue_high: 12, ev_revenue_median: 7.5,
    ev_ebitda_low: 12, ev_ebitda_high: 20, ev_ebitda_median: 15,
    arr_multiple_low: 5, arr_multiple_high: 9, arr_multiple_median: 7,
    key_driver: 'PE interest begins. Profitability increasingly expected. Rule of 40 >40 = 7-9x.',
    when_to_use: 'Both EV/Revenue and EV/EBITDA. EBITDA cross-check becoming standard at B and beyond.',
    data_date: '2025-2026', source: 'Aventis May 2026; QuantPillar Mar 2026', confidence: 'high',
  },
  // Fintech
  {
    sector: 'Fintech', stage: 'Seed',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 6, ev_revenue_high: 20, ev_revenue_median: 12.3,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: null, arr_multiple_high: null, arr_multiple_median: null,
    key_driver: 'Avg across 360 fintech companies (Finro 2025). Payments 4-6x. Infrastructure 8-18x.',
    when_to_use: 'EV/Revenue is go-to for early fintech. EV/Funding alternative for low-revenue cos.',
    data_date: 'Mid-2025', source: 'Finro Jun 2025 (360 company dataset)', confidence: 'high',
  },
  {
    sector: 'Fintech', stage: 'Series A',
    primary_method: 'EV/Revenue + EV/EBITDA',
    ev_revenue_low: 4, ev_revenue_high: 18, ev_revenue_median: 10,
    ev_ebitda_low: 8, ev_ebitda_high: 15, ev_ebitda_median: 12,
    arr_multiple_low: null, arr_multiple_high: null, arr_multiple_median: null,
    key_driver: 'Sub-sector critical: Payments 4-6x, RegTech 8-18x, Lending 2-5x. M&A avg 4.4x global.',
    when_to_use: 'EV/Revenue primary. EBITDA when positive and normalized. Sub-sector matters enormously.',
    data_date: '2025', source: 'Windsor Drake Feb 2026; Finro Jun 2025; IB Interview Questions Mar 2026', confidence: 'high',
  },
  // Healthtech
  {
    sector: 'Healthtech', stage: 'Seed',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 4, ev_revenue_high: 10, ev_revenue_median: 6.5,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: 5, arr_multiple_high: 12, arr_multiple_median: 7,
    key_driver: 'Engagement and retention metrics. CAC payback <18 months preferred.',
    when_to_use: 'EV/Revenue primary. ARR if subscription. EBITDA not yet meaningful.',
    data_date: '2025', source: 'Equidam H1 2025; Cento 2024', confidence: 'medium',
  },
  {
    sector: 'Healthtech', stage: 'Series A',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 8, ev_revenue_high: 20, ev_revenue_median: 13,
    ev_ebitda_low: 15, ev_ebitda_high: 30, ev_ebitda_median: 22,
    arr_multiple_low: null, arr_multiple_high: null, arr_multiple_median: null,
    key_driver: 'Regulatory approval = moat premium. Clinical evidence required. Healthcare PE median 13.5x EV/EBITDA (QuantPillar).',
    when_to_use: 'EV/Revenue for growth phase. EV/EBITDA when EBITDA-positive. High PE interest.',
    data_date: '2025', source: 'QuantPillar Mar 2026; Cento 2024', confidence: 'high',
  },
  // E-commerce
  {
    sector: 'E-commerce', stage: 'Seed',
    primary_method: 'GMV Multiple or EV/Revenue',
    ev_revenue_low: 0.5, ev_revenue_high: 3, ev_revenue_median: 1.5,
    ev_ebitda_low: 8, ev_ebitda_high: 12, ev_ebitda_median: 10,
    arr_multiple_low: null, arr_multiple_high: null, arr_multiple_median: null,
    key_driver: 'Take rate x volume drives val. Unit economics proof required. Harder market 2025.',
    when_to_use: 'GMV multiple primary for marketplace. EV/take-rate-revenue as cross-check.',
    data_date: '2025', source: 'Equidam H1 2025; Cento 2024', confidence: 'medium',
  },
  // Edtech
  {
    sector: 'Edtech', stage: 'Seed',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 5, ev_revenue_high: 25, ev_revenue_median: 11.9,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: 8, arr_multiple_high: 18, arr_multiple_median: 12,
    key_driver: 'Wide dispersion (0.2x-80x). Ambition-priced. Completion rates and retention key.',
    when_to_use: 'EV/Revenue at seed. ARR if subscription model.',
    data_date: 'Q4 2025', source: 'Finro EdTech Valuation Q4 2025', confidence: 'medium',
  },
  // Agritech
  {
    sector: 'Agritech', stage: 'Seed',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 2, ev_revenue_high: 8, ev_revenue_median: 4.5,
    ev_ebitda_low: 10, ev_ebitda_high: 15, ev_ebitda_median: 10.8,
    arr_multiple_low: null, arr_multiple_high: null, arr_multiple_median: null,
    key_driver: 'Finerva Q4 2025: AgTech median EV/EBITDA = 10.8x. Revenue multiples mostly <4x.',
    when_to_use: 'EV/Revenue primary. EV/EBITDA when profitable. GMV proxy for marketplace models.',
    data_date: 'Q4 2024-2025', source: 'Finerva May 2025; Equidam H1 2025', confidence: 'medium',
  },
  // Cleantech
  {
    sector: 'Cleantech', stage: 'Seed',
    primary_method: 'EV/Revenue',
    ev_revenue_low: 5, ev_revenue_high: 12, ev_revenue_median: 8,
    ev_ebitda_low: null, ev_ebitda_high: null, ev_ebitda_median: null,
    arr_multiple_low: null, arr_multiple_high: null, arr_multiple_median: null,
    key_driver: 'Capital intensive. Government co-investment de-risks. Impact premium.',
    when_to_use: 'EV/Revenue primary. EBITDA only when revenue-generating and profitable.',
    data_date: 'H1 2025', source: 'Equidam H1 2025; Finerva 2025', confidence: 'medium',
  },
]

// ═══════════════════════════════════════════════════════════════
// 4. DILUTION & FOUNDER OWNERSHIP BENCHMARKS
// Source: Carta 2025 (40K+ startups), Serebrisky Dec 2025,
//         CRV Apr 2026, Metal.so Jul 2025, SaaStr 2024
// ═══════════════════════════════════════════════════════════════
export const DILUTION_BENCHMARKS: DilutionBenchmark[] = [
  {
    round: 'Accelerator',
    dilution_low_pct: 5, dilution_high_pct: 10, dilution_median_pct: 7,
    danger_zone_pct: 15,
    founder_pct_after: '90-93%',
    notes: 'YC: 7%. Antler SEA: ~8%. Most SEA programs 5-10%. Minimal dilution vs access gained.',
    source: 'Antler; YC standard', confidence: 'high',
  },
  {
    round: 'Pre-seed',
    dilution_low_pct: 10, dilution_high_pct: 15, dilution_median_pct: 12,
    danger_zone_pct: 20,
    founder_pct_after: '78-85%',
    notes: 'Market standard 2025: 10-15%. $1-2.4M SAFE: median ~19-20% dilution (Carta 2025).',
    source: 'Metal.so Jul 2025; Carta State of Pre-seed 2025; Rebel Fund 2025', confidence: 'high',
  },
  {
    round: 'Seed',
    dilution_low_pct: 15, dilution_high_pct: 25, dilution_median_pct: 19.5,
    danger_zone_pct: 30,
    founder_pct_after: '55-65%',
    notes: 'Carta 2025 median: 19.5%. 28% of rounds sell 20-24% (most common band). 10% sell >30% (danger).',
    source: 'Carta Founder Ownership 2026; Serebrisky Dec 2025; Rebel Fund 2025', confidence: 'high',
  },
  {
    round: 'Series A',
    dilution_low_pct: 15, dilution_high_pct: 25, dilution_median_pct: 17.9,
    danger_zone_pct: 30,
    founder_pct_after: '36-50%',
    notes: 'Carta Q1 2025 median: 17.9% (down from 20.9% a year prior). Software/AI founders: 37.5%.',
    source: 'Carta Founder Ownership 2026 (Mar 2026); CRV Apr 2026', confidence: 'high',
  },
  {
    round: 'Series B',
    dilution_low_pct: 12, dilution_high_pct: 20, dilution_median_pct: 14,
    danger_zone_pct: 25,
    founder_pct_after: '23-35%',
    notes: 'At Series B: median AI founding team maintains 27.3% fully diluted. Physical sectors lower.',
    source: 'Carta Founder Ownership 2026; 99Startups Mar 2025', confidence: 'high',
  },
  {
    round: 'Series C',
    dilution_low_pct: 8, dilution_high_pct: 15, dilution_median_pct: 10,
    danger_zone_pct: 20,
    founder_pct_after: '15-25%',
    notes: 'Dilution decreases as company matures. Efficient capital use = leverage.',
    source: 'Serebrisky Dec 2025; EquityList Mar 2026', confidence: 'high',
  },
  {
    round: 'Series D+',
    dilution_low_pct: 5, dilution_high_pct: 10, dilution_median_pct: 7.5,
    danger_zone_pct: 15,
    founder_pct_after: '8-15% (CEO only)',
    notes: 'By Series D: median dilution 7.5% per Serebrisky 2025. Company commands strong terms.',
    source: 'Serebrisky Dec 2025', confidence: 'high',
  },
]

// ═══════════════════════════════════════════════════════════════
// 5. SEA MARKET SIZES BY SECTOR
// Source: Google/Temasek/Bain e-Conomy SEA 2025, DealStreetAsia 2025,
//         Bain 2025, HolonIQ 2024, Momentum Works 2024
// ═══════════════════════════════════════════════════════════════
export const MARKET_SIZES: MarketSize[] = [
  {
    sector: 'Fintech',
    sea_market_size: '$100B by 2025',
    year_forecast: '2025',
    cagr_pct: 14.5,
    tam_usd: 100_000_000_000,
    sam_usd_sea: 30_000_000_000,
    bottom_up_formula: '45M smartphone users with digital payment access × $240 avg annual digital spend = $10.8B core SAM',
    key_countries: ['SG', 'ID', 'MY', 'VN', 'PH'],
    growth_drivers: ['Digital payments adoption', 'Unbanked population', 'Regulatory push for financial inclusion', 'SME digitization'],
    source: 'Google/Temasek/Bain e-Conomy SEA 2025; DealStreetAsia 2025',
    data_date: 'Nov 2025', confidence: 'high',
  },
  {
    sector: 'AI/ML',
    sea_market_size: '$2.2B funded (SEA 2024)',
    year_forecast: '2024 actual',
    cagr_pct: null,
    tam_usd: 8_000_000_000,
    sam_usd_sea: 2_200_000_000,
    bottom_up_formula: '~700 AI startups in SEA × avg funding × enterprise AI spend per company',
    key_countries: ['SG', 'ID', 'MY', 'VN'],
    growth_drivers: ['Enterprise AI adoption', 'LLM API availability', 'Government AI mandates', 'Talent availability'],
    source: 'Bain e-Conomy SEA 2025; Tech Collective Aug 2025',
    data_date: 'Nov 2025', confidence: 'high',
  },
  {
    sector: 'E-commerce',
    sea_market_size: '$130B+ GMV by 2025',
    year_forecast: '2025',
    cagr_pct: 12,
    tam_usd: 130_000_000_000,
    sam_usd_sea: 130_000_000_000,
    bottom_up_formula: '430M internet users × avg $300 annual online spend = $129B GMV',
    key_countries: ['ID', 'TH', 'PH', 'VN', 'MY', 'SG'],
    growth_drivers: ['Smartphone penetration', 'Logistics infrastructure', 'Cross-border commerce', 'Social commerce'],
    source: 'Google/Temasek/Bain e-Conomy SEA 2025',
    data_date: 'Nov 2025', confidence: 'high',
  },
  {
    sector: 'Healthtech',
    sea_market_size: '25% investment growth post-pandemic',
    year_forecast: '2023-2025',
    cagr_pct: 25,
    tam_usd: 50_000_000_000,
    sam_usd_sea: 12_000_000_000,
    bottom_up_formula: '40M+ underserved urban patients × avg $300/yr digital health spend = $12B SAM',
    key_countries: ['SG', 'ID', 'PH', 'MY'],
    growth_drivers: ['Post-pandemic health awareness', 'Telehealth adoption', 'Aging population', 'Insurance expansion'],
    source: 'ADB; Bain 2025; Cento 2024',
    data_date: '2025', confidence: 'medium',
  },
  {
    sector: 'Logistics',
    sea_market_size: '$50B by 2026',
    year_forecast: '2026',
    cagr_pct: 10,
    tam_usd: 50_000_000_000,
    sam_usd_sea: 50_000_000_000,
    bottom_up_formula: '250M e-commerce deliveries/year × avg $4 logistics cost per delivery = $1B addressable tech layer',
    key_countries: ['ID', 'TH', 'VN', 'PH', 'MY'],
    growth_drivers: ['E-commerce growth', 'Last-mile density', 'Cold chain demand', 'B2B logistics digitization'],
    source: 'Momentum Works 2024',
    data_date: '2024', confidence: 'medium',
  },
  {
    sector: 'Edtech',
    sea_market_size: '$5B by 2025',
    year_forecast: '2025',
    cagr_pct: 8,
    tam_usd: 5_000_000_000,
    sam_usd_sea: 5_000_000_000,
    bottom_up_formula: '70M K-12 students + 50M working adults upskilling × avg $40/yr digital learning spend = $4.8B SAM',
    key_countries: ['ID', 'PH', 'VN', 'MY'],
    growth_drivers: ['Skills gap', 'Remote learning acceptance', 'Corporate upskilling budgets', 'Government curricula'],
    source: 'HolonIQ 2024',
    data_date: '2024', confidence: 'medium',
  },
  {
    sector: 'Agritech',
    sea_market_size: '$1B+ funding (2024)',
    year_forecast: '2024 actual',
    cagr_pct: null,
    tam_usd: 30_000_000_000,
    sam_usd_sea: 5_000_000_000,
    bottom_up_formula: '270M farmers in SEA × avg $5-10/yr tech spend = $1.35-2.7B SAM (low penetration today)',
    key_countries: ['ID', 'VN', 'TH', 'PH'],
    growth_drivers: ['Food security concerns', 'Climate adaptation', 'Supply chain digitization', 'Government subsidies'],
    source: 'Bain e-Conomy SEA 2025',
    data_date: 'Nov 2025', confidence: 'medium',
  },
  {
    sector: 'Cleantech',
    sea_market_size: 'Growing with government mandate',
    year_forecast: '2024-2026',
    cagr_pct: 20,
    tam_usd: 100_000_000_000,
    sam_usd_sea: 15_000_000_000,
    bottom_up_formula: 'Government renewable energy targets across SEA + carbon market + EV adoption',
    key_countries: ['ID', 'VN', 'TH', 'SG', 'MY'],
    growth_drivers: ['Paris Agreement commitments', 'ESG investor mandates', 'EV adoption', 'Renewable energy targets'],
    source: 'Bain 2025; IEA Southeast Asia Energy Outlook',
    data_date: '2025', confidence: 'medium',
  },
  {
    sector: 'Digital Payments',
    sea_market_size: 'CAGR 32.3% (2020-2025)',
    year_forecast: '2020-2025 period',
    cagr_pct: 32.3,
    tam_usd: 110_000_000_000,
    sam_usd_sea: 110_000_000_000,
    bottom_up_formula: '600M mobile wallet transactions/month × avg $18 transaction value = $130B annualized GMV',
    key_countries: ['ID', 'TH', 'SG', 'VN', 'MY', 'PH'],
    growth_drivers: ['Smartphone penetration', 'QR code adoption', 'Government push for cashless', 'Cross-border payments'],
    source: 'Mastercard via Numberanalytics; Bain 2025',
    data_date: '2025', confidence: 'high',
  },
]

// ═══════════════════════════════════════════════════════════════
// 6. SECTOR VALUATION MULTIPLES LOOKUP (for gemini.ts calculation)
// ═══════════════════════════════════════════════════════════════
export const SECTOR_MULTIPLES: Record<string, SectorMultiple> = {
  'AI/ML':          { sector: 'AI/ML',          low: 12, mid: 16,  high: 20  },
  'SaaS':           { sector: 'SaaS',            low: 5,  mid: 7.5, high: 10  },
  'Deep Tech':      { sector: 'Deep Tech',       low: 7,  mid: 10.5,high: 14  },
  'Cleantech':      { sector: 'Cleantech',       low: 5,  mid: 7.5, high: 10  },
  'Fintech':        { sector: 'Fintech',         low: 6,  mid: 10,  high: 15  },
  'Healthtech':     { sector: 'Healthtech',      low: 5,  mid: 8,   high: 12  },
  'E-commerce':     { sector: 'E-commerce',      low: 3,  mid: 5,   high: 8   },
  'Logistics':      { sector: 'Logistics',       low: 3,  mid: 4,   high: 6   },
  'Edtech':         { sector: 'Edtech',          low: 4,  mid: 7,   high: 12  },
  'Agritech':       { sector: 'Agritech',        low: 4,  mid: 6,   high: 10  },
  'Consumer':       { sector: 'Consumer',        low: 2,  mid: 3.5, high: 5   },
  'Cybersecurity':  { sector: 'Cybersecurity',   low: 8,  mid: 12,  high: 18  },
  'B2B':            { sector: 'B2B',             low: 5,  mid: 7,   high: 10  },
  'Marketplace':    { sector: 'Marketplace',     low: 4,  mid: 6,   high: 9   },
  'Crypto/Web3':    { sector: 'Crypto/Web3',     low: 5,  mid: 10,  high: 20  },
}

// ═══════════════════════════════════════════════════════════════
// 7. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/** Get round benchmark for a given stage */
export function getRoundBenchmark(stage: string): RoundBenchmark | null {
  return ROUND_BENCHMARKS.find(r => r.stage === stage) || null
}

/** Get valuation benchmarks for a sector at a given stage */
export function getValuationBySector(sector: string, stage: string): ValuationBySector | null {
  const normalized = normalizeSector(sector)
  return VALUATION_BY_SECTOR.find(v =>
    v.sector.toLowerCase() === normalized.toLowerCase() &&
    v.stage === stage
  ) || VALUATION_BY_SECTOR.find(v =>
    v.sector.toLowerCase() === normalized.toLowerCase()
  ) || null
}

/** Get revenue multiples for a sector at a given stage */
export function getRevenueMultiple(sector: string, stage: string): RevenueMultiple | null {
  const normalized = normalizeSector(sector)
  return REVENUE_MULTIPLES.find(m =>
    m.sector.toLowerCase() === normalized.toLowerCase() &&
    m.stage === stage
  ) || REVENUE_MULTIPLES.find(m =>
    m.sector.toLowerCase() === normalized.toLowerCase()
  ) || null
}

/** Get dilution benchmark for a round */
export function getDilutionBenchmark(round: string): DilutionBenchmark | null {
  return DILUTION_BENCHMARKS.find(d => d.round.toLowerCase() === round.toLowerCase()) || null
}

/** Get market size data for a sector */
export function getMarketSize(sector: string): MarketSize | null {
  const normalized = normalizeSector(sector)
  return MARKET_SIZES.find(m =>
    m.sector.toLowerCase() === normalized.toLowerCase()
  ) || null
}

/**
 * Calculate blended sector multiple from sector_weights
 * Used in market + valuation analysis
 */
export function calculateBlendedMultiple(
  sectorWeights: Record<string, number>
): { low: number; mid: number; high: number; breakdown: { sector: string; weight: number; multiple: SectorMultiple; contribution: number }[] } {
  let low = 0, mid = 0, high = 0
  const breakdown = []

  for (const [sector, weight] of Object.entries(sectorWeights)) {
    const m = SECTOR_MULTIPLES[sector] || SECTOR_MULTIPLES['B2B']
    low  += weight * m.low
    mid  += weight * m.mid
    high += weight * m.high
    breakdown.push({ sector, weight, multiple: m, contribution: weight * m.mid })
  }

  return { low, mid, high, breakdown }
}

/**
 * Get valuation range from revenue + sector weights
 */
export function getRevenueBasedValuation(
  annualRevenueUsd: number,
  sectorWeights: Record<string, number>
): { low: number; mid: number; high: number; multiple: { low: number; mid: number; high: number } } {
  const { low, mid, high } = calculateBlendedMultiple(sectorWeights)
  return {
    low:  annualRevenueUsd * low,
    mid:  annualRevenueUsd * mid,
    high: annualRevenueUsd * high,
    multiple: { low, mid, high },
  }
}

/**
 * Get expected dilution warning at a given raise size and premoney
 */
export function getDilutionAssessment(
  raiseUsd: number,
  premoneyUsd: number,
  stage: string
): { pct: number; assessment: 'healthy' | 'acceptable' | 'high' | 'danger'; message: string } {
  const pct     = (raiseUsd / (premoneyUsd + raiseUsd)) * 100
  const bench   = getDilutionBenchmark(stage)
  const danger  = bench?.danger_zone_pct || 30

  if (pct <= 20) return { pct, assessment: 'healthy', message: 'Within healthy range (15-20%). Good negotiating position.' }
  if (pct <= 25) return { pct, assessment: 'acceptable', message: 'Acceptable (20-25%). Industry standard for this stage.' }
  if (pct <= danger) return { pct, assessment: 'high', message: `High dilution (${pct.toFixed(1)}%). Consider raising at a higher valuation.` }
  return { pct, assessment: 'danger', message: `Danger zone (>${danger}%). This level of dilution makes future rounds mathematically difficult.` }
}

/**
 * Normalize sector name to match database keys
 */
export function normalizeSector(sector: string): string {
  const map: Record<string, string> = {
    'ai': 'AI/ML', 'ai/ml': 'AI/ML', 'machine learning': 'AI/ML',
    'artificial intelligence': 'AI/ML', 'computer vision': 'AI/ML',
    'saas': 'SaaS', 'b2b saas': 'SaaS', 'software': 'SaaS',
    'fintech': 'Fintech', 'financial technology': 'Fintech',
    'healthtech': 'Healthtech', 'health tech': 'Healthtech',
    'medtech': 'Healthtech', 'digital health': 'Healthtech',
    'deep tech': 'Deep Tech', 'deeptech': 'Deep Tech',
    'cleantech': 'Cleantech', 'climate tech': 'Cleantech',
    'green tech': 'Cleantech', 'sustainability': 'Cleantech',
    'e-commerce': 'E-commerce', 'ecommerce': 'E-commerce',
    'marketplace': 'Marketplace',
    'logistics': 'Logistics', 'supply chain': 'Logistics',
    'edtech': 'Edtech', 'education': 'Edtech',
    'agritech': 'Agritech', 'agriculture': 'Agritech',
    'consumer': 'Consumer', 'consumer app': 'Consumer',
    'cybersecurity': 'Cybersecurity', 'security': 'Cybersecurity',
    'crypto': 'Crypto/Web3', 'web3': 'Crypto/Web3', 'blockchain': 'Crypto/Web3',
    'b2b': 'B2B', 'enterprise': 'B2B',
  }
  return map[sector.toLowerCase()] || sector
}

/**
 * Build market analysis context string for Gemini prompt
 * Gives Gemini the database baseline to validate against
 */
export function buildMarketContext(
  sector: string,
  stage: string,
  sectorWeights: Record<string, number>,
  raiseTargetUsd: number,
  annualRevenueUsd: number
): string {
  const roundBench  = getRoundBenchmark(stage as Stage)
  const valBySector = getValuationBySector(sector, stage)
  const marketSize  = getMarketSize(sector)
  const { low, mid, high, breakdown } = calculateBlendedMultiple(sectorWeights)

  const revVal = annualRevenueUsd > 0
    ? getRevenueBasedValuation(annualRevenueUsd, sectorWeights)
    : null

  return `
PRE-BUILT DATABASE CONTEXT (validate these against live internet):

Round benchmarks for ${stage}:
- SEA raise range: $${(roundBench?.sea_raise_low_usd || 0)/1e6}M – $${(roundBench?.sea_raise_high_usd || 0)/1e6}M (median: $${(roundBench?.sea_raise_median_usd || 0)/1e6}M)
- SEA pre-money range: $${(roundBench?.sea_premoney_low_usd || 0)/1e6}M – $${(roundBench?.sea_premoney_high_usd || 0)/1e6}M (median: $${(roundBench?.sea_premoney_median_usd || 0)/1e6}M)
- Source: ${roundBench?.source || 'N/A'} (${roundBench?.data_date || 'N/A'})

Sector valuation (${sector} at ${stage}):
- SEA pre-money: $${(valBySector?.sea_premoney_low_usd || 0)/1e6}M – $${(valBySector?.sea_premoney_high_usd || 0)/1e6}M (median: $${(valBySector?.sea_premoney_median_usd || 0)/1e6}M)
- Sector multiplier: ${valBySector?.sector_multiplier || 1}x vs base SEA valuation

Sector-weighted multiple calculation:
${breakdown.map(b => `  ${b.sector} (${Math.round(b.weight*100)}%): ${b.multiple.low}x–${b.multiple.high}x → contributes ${b.contribution.toFixed(2)}x`).join('\n')}
  Blended multiple: ${low.toFixed(1)}x – ${high.toFixed(1)}x (mid: ${mid.toFixed(1)}x)

${revVal ? `Revenue-based valuation (using $${annualRevenueUsd/1e3}K annual revenue × ${mid.toFixed(1)}x):
  Range: $${(revVal.low/1e6).toFixed(1)}M – $${(revVal.high/1e6).toFixed(1)}M (mid: $${(revVal.mid/1e6).toFixed(1)}M)` : 'Revenue not disclosed — use traction/team/IP basis.'}

Implied dilution at $${raiseTargetUsd/1e6}M raise:
${[3,5,7,8,10].map(pm => {
  const pct = (raiseTargetUsd / (pm*1e6 + raiseTargetUsd) * 100).toFixed(1)
  return `  At $${pm}M pre-money: ${pct}% dilution`
}).join('\n')}

SEA market size for ${sector}:
  TAM: $${((marketSize?.tam_usd || 0)/1e9).toFixed(1)}B | SAM (SEA): $${((marketSize?.sam_usd_sea || 0)/1e9).toFixed(1)}B
  CAGR: ${marketSize?.cagr_pct || 'N/A'}% | Bottom-up formula: ${marketSize?.bottom_up_formula || 'N/A'}
  Source: ${marketSize?.source || 'N/A'}

IMPORTANT: Use these as your baseline. Search the web to validate and find any newer data.
Flag confidence as 'Updated from web [date]' if you find fresher figures.
`
}
