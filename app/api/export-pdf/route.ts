import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

// ─────── helpers ───────
const fmtM = (n: number | null | undefined): string => {
  if (n == null) return '—'
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`
  return `$${n}`
}
const esc = (s: unknown): string => {
  if (s == null) return ''
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function safeJSON<T = unknown>(val: unknown): T | null {
  if (val == null) return null
  if (typeof val === 'object') return val as T
  try { return JSON.parse(val as string) as T } catch { return null }
}

// ───────────────── Route ─────────────────
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'No slug' }, { status: 400 })

  const { data: sub, error } = await supabaseAdmin
    .from('submissions').select('*').eq('unique_slug', slug).single()
  if (error || !sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const matches = safeJSON<Array<Record<string, unknown>>>(sub.match_results) || []
  const network = safeJSON<Array<Record<string, unknown>>>(sub.warm_intros)  || []
  const deck    = safeJSON<Record<string, unknown>>(sub.deck_analysis)
  const market  = safeJSON<Record<string, unknown>>(sub.market_analysis)
  const comp    = safeJSON<Record<string, unknown>>(sub.competitive_analysis)
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://raisesea.co'

  const safeName = (sub.company_name as string || 'startup').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
  const filename = `${safeName}_${slug}`

  // Build all sections
  const headerHtml         = buildHeader(sub, slug, appUrl, deck)
  const companyHtml        = buildCompany(sub, deck)
  const overviewHtml       = buildOverview(sub, deck, market, comp, matches)
  const deckScoreHtml      = deck   ? buildDeckScore(deck)               : ''
  const marketHtml         = market ? buildMarket(market, sub)           : ''
  const competitorsHtml    = comp   ? buildCompetitors(comp)             : ''
  const investorsHtml      = matches.length > 0 ? buildInvestors(matches, network) : ''
  const footerHtml         = buildFooter(sub, slug, appUrl)

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${esc(filename)}</title>
<style>${STYLES}</style>
<script>
document.title = "${esc(filename)}";
window.onload = function() { setTimeout(function() { window.print(); }, 800); }
</script>
</head><body>
${headerHtml}
${companyHtml}
${overviewHtml}
${deckScoreHtml}
${marketHtml}
${competitorsHtml}
${investorsHtml}
${footerHtml}
</body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}.html"`,
    }
  })
}

// ════════════════════════════════════════════════════════════
//   SECTION BUILDERS — one per tab
// ════════════════════════════════════════════════════════════

function buildHeader(sub: Record<string, unknown>, slug: string, appUrl: string, deck: Record<string, unknown> | null): string {
  const score = (deck?.overall_score as number) ?? null
  const readiness = (deck?.investor_readiness as string) ?? ''
  return `
<div class="hdr">
  <div class="hdr-left">
    <div class="brand">← RaiseSEA</div>
    <div class="company-name">${esc(sub.company_name)}</div>
    <div class="company-sub">${esc(sub.stage)} · Raising ${fmtM(sub.raise_target_usd as number)} · ${esc(sub.country)}</div>
  </div>
  ${score !== null ? `
  <div class="hdr-right">
    <div class="score-big">${score}<span class="score-denom">/100</span></div>
    <div class="score-readiness ${readinessClass(readiness)}">${esc(readiness)}</div>
  </div>` : ''}
</div>`
}

function readinessClass(r: string): string {
  const x = (r || '').toLowerCase()
  if (x.includes('excellent') || x.includes('investment')) return 'r-green'
  if (x.includes('good')) return 'r-yellow'
  if (x.includes('weak') || x.includes('need')) return 'r-orange'
  return 'r-gray'
}

function buildCompany(sub: Record<string, unknown>, deck: Record<string, unknown> | null): string {
  const desc = sub.ai_description as string || ''
  const traction = sub.ai_traction as string || ''
  const oneLiner = (deck?.dimensions as Record<string, { found?: string[] }>)?.['solution']?.found?.[0] || ''
  return `
<section class="company-section">
  ${oneLiner ? `<p class="one-liner">${esc(oneLiner)}</p>` : ''}
  ${desc ? `<div class="ai-box"><div class="ai-label">Company overview</div><div class="ai-text">${esc(desc)}</div></div>` : ''}
  ${traction ? `<div class="ai-box"><div class="ai-label">📈 Traction highlights</div><div class="ai-text">${esc(traction)}</div></div>` : ''}
</section>`
}

function buildOverview(
  sub: Record<string, unknown>,
  deck: Record<string, unknown> | null,
  market: Record<string, unknown> | null,
  comp: Record<string, unknown> | null,
  matches: Array<Record<string, unknown>>
): string {
  const overall = (deck?.overall_score as number) ?? null
  const readiness = (deck?.investor_readiness as string) ?? ''
  const recPre = market?.recommended_premoney as { low: number; high: number } | undefined
  const moat = comp?.moat_scores as Record<string, number> | undefined
  const overallMoat = moat?.overall ?? null
  const topMatch = matches[0]
  const topInv   = (topMatch?.investor as Record<string, unknown>) || {}
  const moatLabel = overallMoat == null ? '' : overallMoat >= 7 ? 'Strong' : overallMoat >= 5 ? 'Moderate' : 'Weak'

  return `
<section class="tab-section">
  <h2 class="tab-title">Overview</h2>
  <div class="overview-grid">
    ${overall !== null ? `
    <div class="ov-card">
      <div class="ov-label">Deck score</div>
      <div class="ov-value">${overall}<span class="ov-denom">/100</span></div>
      <div class="ov-sub ${readinessClass(readiness)}">${esc(readiness)}</div>
    </div>` : ''}
    ${recPre ? `
    <div class="ov-card">
      <div class="ov-label">Valuation (recommended)</div>
      <div class="ov-value">${fmtM(recPre.low)}–${fmtM(recPre.high)}</div>
      <div class="ov-sub">Pre-money, SEA benchmark</div>
    </div>` : ''}
    ${overallMoat !== null ? `
    <div class="ov-card">
      <div class="ov-label">Moat score</div>
      <div class="ov-value">${overallMoat}<span class="ov-denom">/10</span></div>
      <div class="ov-sub">${moatLabel}</div>
    </div>` : ''}
    <div class="ov-card">
      <div class="ov-label">Investor matches</div>
      <div class="ov-value">${matches.length}</div>
      <div class="ov-sub">Top: ${esc(topInv.name || '—')}</div>
    </div>
  </div>

  ${matches.length > 0 ? `
  <h3 class="subtitle">Top investor matches</h3>
  <div class="top-matches-grid">
    ${matches.slice(0, 3).map(m => {
      const inv = (m.investor as Record<string, unknown>) || {}
      const stages = (inv.invest_stages as string[] || []).slice(0,3).join(' · ')
      return `
      <div class="top-match">
        <div class="top-match-head">
          <span class="top-match-name">${esc(inv.name)}</span>
          <span class="top-match-score">${esc(m.score)}</span>
        </div>
        <div class="top-match-sub">${esc(inv.type || '')} · ${esc(inv.hq_city || '')}, ${esc(inv.hq_country || '')}</div>
        <div class="top-match-reason">${esc(m.reason || '')}</div>
        <div class="top-match-stages">${esc(stages)}</div>
      </div>`
    }).join('')}
  </div>` : ''}
</section>`
}

function buildDeckScore(deck: Record<string, unknown>): string {
  const overall = deck.overall_score as number || 0
  const readiness = deck.investor_readiness as string || ''
  const stage = deck.stage as string || ''
  const revenueType = deck.revenue_type as string || ''
  const dimensions = (deck.dimensions as Record<string, DimDetail>) || {}
  const missingSlides = (deck.missing_slides as Array<MissingSlide>) || []
  const actions = (deck.priority_actions as Array<ActionItem>) || []

  return `
<section class="tab-section">
  <h2 class="tab-title">Deck score</h2>

  <div class="ds-header">
    <div class="ds-score">
      <div class="ds-score-big">${overall}<span class="ds-score-denom">/100</span></div>
      <div class="ds-readiness ${readinessClass(readiness)}">${esc(readiness)}</div>
    </div>
    <div class="ds-meta">
      Weights adapted for <strong>${esc(stage)}</strong> stage · Revenue type: <strong>${esc(revenueType.replace(/_/g,' '))}</strong>
    </div>
  </div>

  ${Object.keys(dimensions).length > 0 ? `
  <div class="dim-summary-grid">
    ${Object.entries(dimensions).map(([key, d]) => `
      <div class="dim-summary">
        <span class="dim-key">${esc(key.replace(/_/g,' '))}</span>
        <span class="dim-val">${esc(d?.score ?? 0)}/${esc(d?.max_score ?? 0)}</span>
      </div>`).join('')}
  </div>` : ''}

  ${(() => {
    const sr = deck.stage_readiness as StageReadiness | undefined
    if (!sr) return ''
    const cls = sr.verdict === 'ready' ? 'sr-ready' : sr.verdict === 'borderline' ? 'sr-borderline' : 'sr-early'
    const label = sr.verdict === 'ready' ? 'Ready to raise' : sr.verdict === 'borderline' ? 'Borderline' : 'Early for this stage'
    return `
    <div class="readiness-box ${cls}">
      <div class="readiness-head">
        <span class="readiness-badge">${label}</span>
        <span class="readiness-sub">
          Targeting <strong>${esc(sr.stage_target)}</strong>
          ${sr.actual_signals_stage && sr.actual_signals_stage !== sr.stage_target
            ? ' · Deck signals read as <strong>' + esc(sr.actual_signals_stage) + '</strong>'
            : ''}
        </span>
      </div>
      ${sr.gap_summary ? `<p class="readiness-summary">${esc(sr.gap_summary)}</p>` : ''}
      <div class="readiness-cols">
        ${(sr.typical_expectations_at_target?.length ?? 0) > 0 ? `
        <div class="readiness-col">
          <p class="readiness-col-label">What investors expect at ${esc(sr.stage_target)}</p>
          <ul class="readiness-list">
            ${(sr.typical_expectations_at_target || []).map(x => `<li>· ${esc(x)}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${(sr.bridge_actions?.length ?? 0) > 0 ? `
        <div class="readiness-col">
          <p class="readiness-col-label">How to credibly raise at this stage</p>
          <ul class="readiness-list readiness-actions">
            ${(sr.bridge_actions || []).map(x => `<li>→ ${esc(x)}</li>`).join('')}
          </ul>
        </div>` : ''}
      </div>
    </div>`
  })()}

  ${missingSlides.length > 0 ? `
  <h3 class="subtitle">Missing slides (${missingSlides.length} of 10 Sequoia-standard slides absent)</h3>
  <div class="missing-grid">
    ${missingSlides.map(s => `
      <div class="missing-card">
        <div class="missing-name">${esc(s.slide_name)}</div>
        <div class="missing-why">${esc(s.why_critical)}</div>
        <div class="missing-req">Required at ${esc(s.required_at_stage || '')}</div>
      </div>`).join('')}
  </div>` : ''}

  ${Object.keys(dimensions).length > 0 ? `
  <h3 class="subtitle">Dimension breakdown</h3>
  <div class="dim-detail-grid">
    ${Object.entries(dimensions).map(([key, d]) => `
      <div class="dim-detail">
        <div class="dim-detail-head">
          <span class="dim-detail-name">${esc(key.replace(/_/g,' '))}</span>
          <span class="dim-detail-weight">${esc(d?.weight_pct ?? 0)}% weight</span>
          <span class="dim-detail-score">${esc(d?.score ?? 0)}/${esc(d?.max_score ?? 0)}</span>
        </div>
        ${(d?.found || []).length > 0 ? `
        <ul class="dim-found">
          ${(d.found || []).slice(0, 8).map(f => `<li>✓ ${esc(f)}</li>`).join('')}
        </ul>` : ''}
        ${(d?.missing || []).length > 0 ? `
        <ul class="dim-missing">
          ${(d.missing || []).slice(0, 8).map(f => `<li>✗ ${esc(f)}</li>`).join('')}
        </ul>` : ''}
        ${d?.best_practice ? `<div class="dim-best"><strong>Best practice:</strong> ${esc(d.best_practice)}</div>` : ''}
        ${d?.fix_effort || d?.score_impact ? `
        <div class="dim-effort">
          ${d.fix_effort ? `<span>Effort: ${esc(d.fix_effort)}</span>` : ''}
          ${d.score_impact ? `<span class="dim-impact">${esc(d.score_impact)}</span>` : ''}
        </div>` : ''}
      </div>`).join('')}
  </div>` : ''}

  ${actions.length > 0 ? `
  <h3 class="subtitle">Priority action plan</h3>
  <div class="action-list">
    ${actions.slice(0, 8).map(a => `
      <div class="action-item action-${esc((a.priority || 'high').toLowerCase()).replace(/[^a-z]/g, '_')}">
        <div class="action-head">
          <span class="action-priority">${esc(a.priority || 'High')}</span>
          <span class="action-title">${esc(a.title)}</span>
          <span class="action-impact">${esc(a.score_impact || '')}</span>
        </div>
        <div class="action-body">${esc(a.description)}</div>
        ${a.effort ? `<div class="action-meta">Effort: ${esc(a.effort)}</div>` : ''}
      </div>`).join('')}
  </div>` : ''}
</section>`
}

function buildMarket(market: Record<string, unknown>, sub: Record<string, unknown>): string {
  const tam = market.tam_usd as number
  const sam = market.sam_usd as number
  const som = market.som_usd as number
  const topdown = market.sam_methodology_topdown as string || (market.methodology_grade === 'top-down' ? market.sam_methodology as string : '')
  const bottomup = market.sam_methodology_bottomup as string || (market.methodology_grade === 'bottom-up' ? market.sam_methodology as string : '')
  const cagr = market.growth_rate_cagr as number
  const drivers = market.growth_drivers as string[] || []
  const keyMarkets = market.key_markets as string[] || []
  const scenarios = market.valuation_scenarios as Array<ValuationScenario> || []
  const recPre = market.recommended_premoney as { low: number; high: number; rationale: string } | undefined
  const dilution = market.dilution_at_recommended as Array<DilutionRow> || []
  const seaComp = market.sea_vs_us_vs_global as Record<string, { low: number; high: number; median: number; note: string }> | undefined
  const appetite = market.investor_appetite as string || ''
  const comparables = market.comparable_deals as Array<ComparableDeal> || []
  const raiseTarget = sub.raise_target_usd as number

  return `
<section class="tab-section">
  <h2 class="tab-title">Market</h2>

  ${(tam && sam && som) ? `
  <h3 class="subtitle">Market sizing</h3>
  <div class="market-layout">
    <div class="market-circles">${tamSamSomSvg(tam, sam, som)}</div>
    <div class="market-cards">
      <div class="m-card m-card-tam">
        <div class="m-card-label">TAM · Total Addressable Market (global)</div>
        <div class="m-card-value">${fmtM(tam)}</div>
        ${market.tam_source ? `<div class="m-card-src">${esc(market.tam_source)}</div>` : ''}
      </div>
      <div class="m-card m-card-sam">
        <div class="m-card-label">SAM · Serviceable Addressable Market (SEA)</div>
        <div class="m-card-value">${fmtM(sam)}</div>
        ${topdown ? `<div class="m-card-src">${esc(topdown)}</div>` : ''}
      </div>
      <div class="m-card m-card-som">
        <div class="m-card-label">SOM · Serviceable Obtainable Market (Year 3)</div>
        <div class="m-card-value">${fmtM(som)}</div>
        ${market.som_rationale ? `<div class="m-card-src">${esc(market.som_rationale)}</div>` : ''}
      </div>
    </div>
  </div>` : ''}

  ${(topdown || bottomup) ? `
  <div class="methodology-grid">
    ${topdown ? `<div class="meth-card meth-topdown"><div class="meth-label">Top-down methodology</div><div class="meth-text">${esc(topdown)}</div></div>` : ''}
    ${bottomup ? `<div class="meth-card meth-bottomup"><div class="meth-label">Bottom-up methodology</div><div class="meth-text">${esc(bottomup)}</div></div>` : ''}
  </div>` : ''}

  ${(cagr || drivers.length > 0 || keyMarkets.length > 0) ? `
  <div class="growth-row">
    ${cagr ? `<div class="cagr-box"><div class="cagr-label">CAGR</div><div class="cagr-value">${cagr}%</div></div>` : ''}
    ${drivers.length > 0 ? `
    <div class="drivers-box">
      <div class="drivers-label">Growth drivers</div>
      <ul class="drivers-list">${drivers.slice(0, 6).map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>` : ''}
    ${keyMarkets.length > 0 ? `
    <div class="markets-box">
      <div class="markets-label">Key markets</div>
      <div class="markets-pills">${keyMarkets.slice(0, 8).map(m => `<span class="market-pill">${esc(m)}</span>`).join('')}</div>
    </div>` : ''}
  </div>` : ''}

  ${(market.sector_weighted_breakdown as Array<SectorBreakdown>)?.length > 0 ? `
  <h3 class="subtitle">Sector-weighted valuation multiple</h3>
  <table class="data-table">
    <thead><tr><th>Sector</th><th>Weight</th><th>EV/Rev range (SEA)</th><th class="num">Contribution</th></tr></thead>
    <tbody>
      ${(market.sector_weighted_breakdown as Array<SectorBreakdown>).map(b => `
        <tr>
          <td>${esc(b.sector)}</td>
          <td>${esc(b.weight_pct)}%</td>
          <td>${esc(b.multiple_low)}x – ${esc(b.multiple_high)}x</td>
          <td class="num"><strong>${esc(b.contribution)}x</strong></td>
        </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${scenarios.length > 0 ? `
  <h3 class="subtitle">Valuation football field</h3>
  <div class="football-field">
    ${scenarios.map(s => `
      <div class="ff-row">
        <div class="ff-label">
          <span class="ff-name">${esc(s.label)}</span>
          <span class="ff-conf">${esc(s.confidence || '')}</span>
        </div>
        <div class="ff-range">${fmtM(s.premoney_low_usd)} – ${fmtM(s.premoney_high_usd)}</div>
        <div class="ff-notes">${esc(s.notes || '')}</div>
      </div>`).join('')}
  </div>` : ''}

  ${recPre ? `
  <div class="rec-pre-box">
    <div class="rec-pre-label">Recommended pre-money</div>
    <div class="rec-pre-value">${fmtM(recPre.low)} – ${fmtM(recPre.high)}</div>
    <div class="rec-pre-rationale">${esc(recPre.rationale)}</div>
  </div>` : ''}

  ${dilution.length > 0 ? `
  <h3 class="subtitle">Dilution impact at ${fmtM(raiseTarget)} raise</h3>
  <table class="data-table">
    <thead><tr><th>Pre-money</th><th>Post-money</th><th>Dilution</th><th>Assessment</th></tr></thead>
    <tbody>
      ${dilution.map(d => `
        <tr class="${d.in_recommended_range ? 'row-highlight' : ''}">
          <td>${fmtM(d.premoney_usd)}${d.in_recommended_range ? ' ✓' : ''}</td>
          <td>${fmtM(d.postmoney_usd)}</td>
          <td>${d.dilution_pct?.toFixed(1)}%</td>
          <td>${esc(d.assessment)}</td>
        </tr>`).join('')}
    </tbody>
  </table>
  <p class="caption">Industry standard: 15-25% dilution per round is healthy. Above 30% makes future rounds difficult. Rows marked ✓ fall in recommended pre-money range.</p>` : ''}

  ${seaComp ? `
  <h3 class="subtitle">Market comparison: SEA vs Global vs US</h3>
  <div class="comparison-grid">
    <div class="comp-card comp-sea"><div class="comp-label">SEA (applicable)</div><div class="comp-value">${fmtM(seaComp.sea?.low)} – ${fmtM(seaComp.sea?.high)}</div><div class="comp-median">Median: ${fmtM(seaComp.sea?.median)}</div><div class="comp-note">${esc(seaComp.sea?.note || '')}</div></div>
    <div class="comp-card comp-global"><div class="comp-label">Global benchmark</div><div class="comp-value">${fmtM(seaComp.global?.low)} – ${fmtM(seaComp.global?.high)}</div><div class="comp-median">Median: ${fmtM(seaComp.global?.median)}</div><div class="comp-note">${esc(seaComp.global?.note || '')}</div></div>
    <div class="comp-card comp-us"><div class="comp-label">US equivalent (reference)</div><div class="comp-value">${fmtM(seaComp.us_reference?.low)} – ${fmtM(seaComp.us_reference?.high)}</div><div class="comp-median">Median: ${fmtM(seaComp.us_reference?.median)}</div><div class="comp-note">${esc(seaComp.us_reference?.note || '')}</div></div>
  </div>` : ''}

  ${appetite ? `
  <h3 class="subtitle">Investor appetite (SEA, 2025)</h3>
  <p class="appetite-text">${esc(appetite)}</p>` : ''}

  ${comparables.length > 0 ? `
  <h3 class="subtitle">Comparable deals</h3>
  <div class="comp-deals">
    ${comparables.slice(0, 6).map(c => `
      <div class="comp-deal">
        <div class="comp-deal-desc">${esc(c.description)}</div>
        <div class="comp-deal-meta">${c.premoney_usd ? fmtM(c.premoney_usd) + ' pre-money · ' : ''}Raised ${fmtM(c.raise_usd)} · ${esc(c.year)}</div>
      </div>`).join('')}
  </div>` : ''}
</section>`
}

function buildCompetitors(comp: Record<string, unknown>): string {
  const moat = comp.moat_scores as Record<string, number | string[]> | undefined
  const overall = moat?.overall as number ?? 0
  const moatLabel = overall >= 7 ? 'Strong' : overall >= 5 ? 'Moderate' : 'Weak'
  const moatActions = comp.moat_improvement_actions as string[] || []
  // Real field names from analyzeCompetitors output (verified against components/results/CompetitorsTab.tsx)
  const seaComps    = (comp.sea_competitors as Array<CompetitorCard>) || []
  const globalComps = (comp.global_benchmarks as Array<CompetitorCard>) || []
  const positioning = comp.positioning as PositioningData | undefined
  const differentiators = comp.key_differentiators as string[] || []
  const whiteSpace = comp.white_space_opportunity as string || ''

  return `
<section class="tab-section section-competitors">
  <h2 class="tab-title">Competitors</h2>

  ${moat ? `
  <h3 class="subtitle">Moat score ${overall}/10 — ${moatLabel}</h3>
  <div class="moat-grid">
    ${['data_advantage','switching_costs','tech_ip','regulatory','network_effects','brand_trust'].map(k => `
      <div class="moat-pill">
        <div class="moat-key">${k.replace(/_/g,' ')}</div>
        <div class="moat-val">${esc(moat[k] || 0)}<span class="moat-denom">/10</span></div>
      </div>`).join('')}
  </div>` : ''}

  ${moatActions.length > 0 ? `
  <h3 class="subtitle">Actions to improve moat</h3>
  <ol class="num-list">
    ${moatActions.slice(0, 6).map(a => `<li>${esc(a)}</li>`).join('')}
  </ol>` : ''}

  ${positioning ? buildPositioningChart(positioning) : ''}

  ${seaComps.length > 0 ? `
  <h3 class="subtitle">SEA direct competitors (${seaComps.length})</h3>
  ${seaComps.map(c => buildCompetitorCard(c, false)).join('')}` : ''}

  ${globalComps.length > 0 ? `
  <h3 class="subtitle">Global benchmarks — what this space can become</h3>
  ${globalComps.map(c => buildCompetitorCard(c, true)).join('')}` : ''}

  ${differentiators.length > 0 ? `
  <h3 class="subtitle">Your key differentiators — state these explicitly in your pitch</h3>
  <ol class="num-list">
    ${differentiators.slice(0, 8).map(d => `<li>${esc(d)}</li>`).join('')}
  </ol>` : ''}

  ${whiteSpace ? `
  <h3 class="subtitle">White space opportunity</h3>
  <p class="whitespace-text">${esc(whiteSpace)}</p>` : ''}
</section>`
}

function buildCompetitorCard(c: CompetitorCard, isGlobal: boolean): string {
  const investors = (c.investors || []).slice(0, 4).join(' · ')
  return `
<div class="competitor-card">
  <div class="comp-card-head">
    <div class="comp-card-name">${esc(c.name)}${isGlobal ? ' <span class="comp-tag">Global benchmark</span>' : ''}</div>
    <div class="comp-card-overlap">${esc(c.similarity_pct || 0)}% overlap</div>
  </div>
  <div class="comp-card-meta">${esc(c.hq || '')}${c.stage ? ' · ' + esc(c.stage) : ''}${c.founded_year ? ' · Founded ' + esc(c.founded_year) : ''}</div>
  ${c.one_liner ? `<div class="comp-card-desc">${esc(c.one_liner)}</div>` : ''}
  ${c.total_raised_usd ? `<div class="comp-card-funding">${fmtM(c.total_raised_usd)} raised</div>` : ''}
  <div class="comp-card-sw">
    ${c.key_strength ? `<div class="comp-strength"><strong>Their strength:</strong> ${esc(c.key_strength)}</div>` : ''}
    ${c.key_weakness ? `<div class="comp-weakness"><strong>Their weakness (your opportunity):</strong> ${esc(c.key_weakness)}</div>` : ''}
  </div>
  ${investors ? `<div class="comp-card-inv">Investors: ${esc(investors)}</div>` : ''}
</div>`
}

// ── Competitive positioning 2x2 chart (SVG) ──
// Maps the same data the on-screen CompetitorsTab shows: founder dot + numbered competitor dots
// with axes labels at top/bottom/left/right and a legend mapping numbers → names below.
function buildPositioningChart(p: PositioningData): string {
  const positions = (p.positions || []).slice(0, 9)
  const competitors = positions.filter(pos => !pos.is_founder)
  const founder = positions.find(pos => pos.is_founder)

  // SVG geometry — leave generous padding for axis labels
  const W = 540, H = 280
  const padTop = 28, padBottom = 28, padLeft = 90, padRight = 90
  const plotW = W - padLeft - padRight
  const plotH = H - padTop - padBottom
  const cx0 = padLeft, cy0 = padTop  // plot top-left

  // pos.x and pos.y are 0-100 (% of plot area). y is flipped (0 = bottom, 100 = top).
  const xPx = (x: number) => cx0 + (Math.min(95, Math.max(5, x)) / 100) * plotW
  const yPx = (y: number) => cy0 + (1 - Math.min(95, Math.max(5, y)) / 100) * plotH

  return `
<h3 class="subtitle">Competitive positioning</h3>
<div class="positioning-block">
  <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;height:auto" xmlns="http://www.w3.org/2000/svg">
    <!-- Plot area background -->
    <rect x="${cx0}" y="${cy0}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#e5e7eb" stroke-width="1"/>
    <!-- Crosshair dashed lines at center -->
    <line x1="${cx0 + plotW/2}" y1="${cy0}" x2="${cx0 + plotW/2}" y2="${cy0 + plotH}" stroke="#d1d5db" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="${cx0}" y1="${cy0 + plotH/2}" x2="${cx0 + plotW}" y2="${cy0 + plotH/2}" stroke="#d1d5db" stroke-width="1" stroke-dasharray="3,3"/>

    <!-- Y+ label (top) -->
    <text x="${cx0 + plotW/2}" y="${cy0 - 12}" text-anchor="middle" font-size="11" font-weight="500" fill="#444">↑ ${esc(truncate(p.y_axis_label, 60))}</text>
    <!-- Y- label (bottom) -->
    <text x="${cx0 + plotW/2}" y="${cy0 + plotH + 18}" text-anchor="middle" font-size="11" font-weight="500" fill="#888">↓ ${esc(truncate(p.y_axis_label_low || ('Less ' + p.y_axis_label), 60))}</text>
    <!-- X- label (left side) -->
    <text x="${cx0 - 8}" y="${cy0 + plotH/2 - 4}" text-anchor="end" font-size="10" font-weight="500" fill="#888">${esc(truncate(p.x_axis_label_low || ('Less ' + p.x_axis_label), 26))}</text>
    <text x="${cx0 - 8}" y="${cy0 + plotH/2 + 10}" text-anchor="end" font-size="10" fill="#888">←</text>
    <!-- X+ label (right side) -->
    <text x="${cx0 + plotW + 8}" y="${cy0 + plotH/2 - 4}" text-anchor="start" font-size="10" font-weight="500" fill="#444">${esc(truncate(p.x_axis_label, 26))}</text>
    <text x="${cx0 + plotW + 8}" y="${cy0 + plotH/2 + 10}" text-anchor="start" font-size="10" fill="#444">→</text>

    <!-- Competitor dots (numbered) -->
    ${competitors.map((c, i) => {
      const x = xPx(c.x), y = yPx(c.y)
      return `
      <g>
        <circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="#9ca3af" stroke-width="1.5"/>
        <text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="10" font-weight="600" fill="#4b5563">${i + 1}</text>
      </g>`
    }).join('')}

    <!-- Founder dot (filled green) -->
    ${founder ? `
    <g>
      <circle cx="${xPx(founder.x)}" cy="${yPx(founder.y)}" r="8" fill="#1a4d2e" stroke="#fff" stroke-width="2"/>
      <text x="${xPx(founder.x)}" y="${yPx(founder.y) - 12}" text-anchor="middle" font-size="10" font-weight="700" fill="#1a4d2e">${esc(founder.name)}</text>
    </g>` : ''}
  </svg>

  <!-- Legend mapping numbers → competitor names -->
  <div class="positioning-legend">
    <div class="legend-item"><div class="legend-dot legend-dot-founder"></div><span class="legend-label">You${founder ? ' (' + esc(founder.name) + ')' : ''}</span></div>
    ${competitors.map((c, i) => `
      <div class="legend-item">
        <div class="legend-dot">${i + 1}</div>
        <span class="legend-label">${esc(c.name)}</span>
      </div>`).join('')}
  </div>
</div>`
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1).trim() + '…' : s
}

function buildInvestors(matches: Array<Record<string, unknown>>, network: Array<Record<string, unknown>>): string {
  const avgScore = Math.round(matches.slice(0, 10).reduce((s, m) => s + (m.score as number), 0) / Math.min(matches.length, 10))
  return `
<section class="tab-section">
  <h2 class="tab-title">Investors</h2>

  <div class="inv-stats-grid">
    <div class="stat-card"><div class="stat-label">Total matches</div><div class="stat-value">${matches.length}</div></div>
    <div class="stat-card"><div class="stat-label">Top score</div><div class="stat-value">${matches[0]?.score ?? '—'}</div></div>
    <div class="stat-card"><div class="stat-label">Avg score (top 10)</div><div class="stat-value">${avgScore}</div></div>
    <div class="stat-card"><div class="stat-label">Warm intros</div><div class="stat-value">${network.length}</div></div>
  </div>

  ${network.length > 0 ? `
  <h3 class="subtitle">Warm intro network</h3>
  <p class="caption">Co-investors of your existing backers. A warm intro through a shared connection converts 3-5× better than cold outreach.</p>
  <div class="warm-grid">
    ${network.slice(0, 18).map(n => {
      const vias = (n.via_investors as string[] | undefined) || (n.via ? [n.via as string] : [])
      return `
      <div class="warm-card">
        <div class="warm-name">${esc(n.investor)}</div>
        <div class="warm-via">via ${esc(vias.join(', '))}</div>
      </div>`}).join('')}
  </div>` : ''}

  <h3 class="subtitle">Investor leaderboard</h3>
  ${matches.map((m, i) => {
    const inv  = (m.investor as Record<string, unknown>) || {}
    const tMin = inv.ticket_min_usd as number | undefined
    const tMax = inv.ticket_max_usd as number | undefined
    const ticket = (tMin && tMax) ? `${fmtM(tMin)} – ${fmtM(tMax)}` : 'Varies'
    const stages = (inv.invest_stages as string[] || []).slice(0,3).join(' · ')
    const medal = i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`
    const coInv = (inv.co_investors as string || '').split(',').map(s => s.trim()).filter(Boolean).slice(0,3).join(', ')
    return `
<div class="match-item">
  <div class="match-rank">
    <div class="match-medal">${medal}</div>
    <div class="match-info">
      <div class="match-name">${esc(inv.name)} <span class="match-type">${esc(inv.type || '')}</span></div>
      <div class="match-meta">${esc(inv.hq_city || '')}, ${esc(inv.hq_country || '')}</div>
      <div class="match-reason">${esc(m.reason || '')}</div>
    </div>
    <div class="match-score-block">
      <div class="match-score">${esc(m.score)}</div>
    </div>
  </div>
  <div class="match-details">
    <span class="match-pill">${esc(stages)}</span>
    <span class="match-pill match-pill-ticket">${esc(ticket)} · ${esc(inv.investment_strategy || 'Agnostic')}</span>
  </div>
  ${inv.investment_thesis ? `<div class="thesis">"${esc(inv.investment_thesis)}"</div>` : ''}
  <div class="inv-details">
    ${inv.website ? `<div class="detail"><div class="detail-label">Website</div><div class="detail-val">${esc(inv.website)}</div></div>` : ''}
    ${coInv ? `<div class="detail"><div class="detail-label">Co-investors</div><div class="detail-val">${esc(coInv)}</div></div>` : ''}
    ${inv.value_add ? `<div class="detail"><div class="detail-label">Value add</div><div class="detail-val">${esc(inv.value_add)}</div></div>` : ''}
    ${inv.leadership_name ? `<div class="detail"><div class="detail-label">Lead partner</div><div class="detail-val">${esc(inv.leadership_name)}${inv.leadership_title ? ' (' + esc(inv.leadership_title) + ')' : ''}</div></div>` : ''}
  </div>
</div>`}).join('')}
</section>`
}

function buildFooter(sub: Record<string, unknown>, slug: string, appUrl: string): string {
  return `
<div class="footer">
  RaiseSEA — Connecting SEA founders with the right capital<br>
  ${esc(appUrl)} · Match link: ${esc(appUrl)}/match/${esc(slug)}<br>
  Confidential — generated ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })} for ${esc(sub.founder_name)} · ${esc(sub.company_name)}
</div>`
}

// ── TAM/SAM/SOM SVG (concentric, labels on right) ──
function tamSamSomSvg(tam: number, sam: number, som: number): string {
  const cx = 110, cy = 110, tamR = 100
  const samRatio = tam > 0 ? Math.max(0.50, Math.min(0.82, Math.sqrt(sam / tam))) : 0.65
  const somRatio = sam > 0 ? Math.max(0.18, Math.min(0.55, Math.sqrt(som / sam) * samRatio)) : 0.25
  const samR = tamR * samRatio
  const somR = tamR * somRatio
  return `
<svg viewBox="0 0 220 220" width="220" height="220" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="${tamR}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${samR}" fill="#86efac" stroke="#15803d" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${somR}" fill="#a5b4fc" stroke="#1d4ed8" stroke-width="2"/>
  <text x="${cx}" y="${cy - (tamR + samR)/2 + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1e3a8a">TAM</text>
  <text x="${cx}" y="${cy - (samR + somR)/2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#14532d">SAM</text>
  <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${somR < 25 ? 9 : 10}" font-weight="700" fill="#1e3a8a">SOM</text>
</svg>`
}

// ═══════════════════════════ types ═══════════════════════════
type DimDetail = { score?: number; max_score?: number; weight_pct?: number; found?: string[]; missing?: string[]; best_practice?: string; fix_effort?: string; score_impact?: string }
type StageReadiness = {
  verdict: 'ready' | 'borderline' | 'early'
  actual_signals_stage: string
  stage_target: string
  gap_summary: string
  typical_expectations_at_target: string[]
  bridge_actions: string[]
}
type MissingSlide = { slide_name: string; why_critical: string; required_at_stage?: string }
type ActionItem = { priority?: string; title: string; description: string; effort?: string; score_impact?: string }
type ValuationScenario = { label: string; premoney_low_usd: number; premoney_high_usd: number; confidence?: string; notes?: string }
type DilutionRow = { premoney_usd: number; postmoney_usd: number; dilution_pct: number; assessment: string; in_recommended_range?: boolean }
type ComparableDeal = { description: string; premoney_usd?: number; raise_usd?: number; year?: number }
type SectorBreakdown = { sector: string; weight_pct: number; multiple_low: number; multiple_high: number; contribution: number }
// Matches the real shape from analyzeCompetitors (see lib/gemini.ts JSON template)
type CompetitorCard = {
  name: string; hq?: string; stage?: string; founded_year?: number;
  total_raised_usd?: number; similarity_pct?: number; one_liner?: string;
  key_strength?: string; key_weakness?: string; investors?: string[];
  website?: string; linkedin?: string
}
type PositioningData = {
  x_axis_label: string; x_axis_label_low?: string;
  y_axis_label: string; y_axis_label_low?: string;
  positions: Array<{ name: string; x: number; y: number; is_founder?: boolean }>
}

// ═══════════════════════════ styles ═══════════════════════════
const STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: #fff; padding: 32px 36px; font-size: 12px; line-height: 1.5; }
.hdr { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 18px; border-bottom: 2px solid #1a7a3c; margin-bottom: 22px; }
.brand { color: #1a7a3c; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.company-name { font-size: 26px; font-weight: 700; color: #1a1a1a; }
.company-sub { font-size: 12px; color: #888; margin-top: 2px; }
.hdr-right { text-align: right; }
.score-big { font-size: 36px; font-weight: 700; color: #1a7a3c; line-height: 1; }
.score-denom { font-size: 18px; color: #aaa; font-weight: 500; }
.score-readiness { font-size: 12px; font-weight: 600; margin-top: 4px; }
.r-green { color: #16a34a; } .r-yellow { color: #ca8a04; } .r-orange { color: #ea580c; } .r-gray { color: #6b7280; }
.company-section { margin-bottom: 22px; }
.one-liner { font-size: 14px; color: #555; font-style: italic; margin-bottom: 12px; }
.ai-box { background: #f0faf4; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.ai-label { font-size: 10px; font-weight: 600; color: #1a7a3c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.ai-text { font-size: 12px; color: #444; line-height: 1.55; }
.tab-section { margin-top: 30px; }
.tab-title { font-size: 18px; font-weight: 700; color: #1a4d2e; padding-bottom: 6px; border-bottom: 1px solid #1a4d2e; margin-bottom: 16px; }
.subtitle { font-size: 12px; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 0.05em; margin: 18px 0 8px; }
.overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.ov-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
.ov-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
.ov-value { font-size: 22px; font-weight: 700; color: #1a7a3c; margin: 4px 0 2px; }
.ov-denom { font-size: 13px; color: #aaa; font-weight: 500; }
.ov-sub { font-size: 10px; color: #888; }
.top-matches-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.top-match { border: 1px solid #e5e7eb; border-radius: 8px; padding: 11px; page-break-inside: avoid; }
.top-match-head { display: flex; justify-content: space-between; align-items: baseline; }
.top-match-name { font-weight: 700; font-size: 12px; }
.top-match-score { color: #1a7a3c; font-weight: 700; font-size: 16px; }
.top-match-sub { font-size: 10px; color: #888; margin: 2px 0 4px; }
.top-match-reason { font-size: 10px; color: #555; }
.top-match-stages { font-size: 10px; color: #1a7a3c; margin-top: 4px; }
.ds-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #fafaf8; border-radius: 8px; margin-bottom: 12px; }
.ds-score-big { font-size: 32px; font-weight: 700; color: #1a7a3c; }
.ds-score-denom { font-size: 14px; color: #aaa; font-weight: 500; }
.ds-readiness { font-size: 12px; font-weight: 600; }
.ds-meta { font-size: 11px; color: #666; }
.dim-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; }
.dim-summary { background: #fafaf8; padding: 6px 9px; border-radius: 5px; display: flex; justify-content: space-between; font-size: 10px; text-transform: capitalize; }
.dim-key { color: #666; } .dim-val { color: #1a4d2e; font-weight: 700; }

/* Stage readiness banner */
.readiness-box { border-radius: 8px; padding: 14px 16px; margin: 14px 0; page-break-inside: avoid; border-width: 1px; border-style: solid; }
.sr-ready      { background: #f0faf4; border-color: #86efac; }
.sr-borderline { background: #fef9e7; border-color: #fde68a; }
.sr-early      { background: #fef2f2; border-color: #fecaca; }
.readiness-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.readiness-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; color: #fff; }
.sr-ready .readiness-badge      { background: #15803d; }
.sr-borderline .readiness-badge { background: #d97706; }
.sr-early .readiness-badge      { background: #b91c1c; }
.readiness-sub { font-size: 11px; color: #555; }
.readiness-summary { font-size: 11px; line-height: 1.55; color: #333; margin-bottom: 10px; }
.readiness-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.readiness-col { background: rgba(255,255,255,0.75); border-radius: 6px; padding: 9px 11px; }
.readiness-col-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #444; margin-bottom: 5px; }
.readiness-list { list-style: none; font-size: 10px; line-height: 1.55; color: #333; }
.readiness-list li { margin-bottom: 4px; }
.readiness-actions li { color: #15803d; }
.missing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.missing-card { border: 1px solid #fecaca; border-radius: 6px; padding: 9px; page-break-inside: avoid; }
.missing-name { font-weight: 700; color: #b91c1c; font-size: 11px; margin-bottom: 3px; }
.missing-why { font-size: 10px; color: #555; line-height: 1.45; margin-bottom: 4px; }
.missing-req { font-size: 9px; color: #b91c1c; }
.dim-detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.dim-detail { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; page-break-inside: avoid; }
.dim-detail-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 5px; }
.dim-detail-name { font-weight: 700; text-transform: capitalize; font-size: 12px; }
.dim-detail-weight { font-size: 10px; color: #888; }
.dim-detail-score { margin-left: auto; color: #1a7a3c; font-weight: 700; font-size: 12px; }
.dim-found, .dim-missing { list-style: none; font-size: 10px; line-height: 1.5; margin-top: 3px; }
.dim-found li { color: #15803d; }
.dim-missing li { color: #b91c1c; }
.dim-best { font-size: 10px; color: #555; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb; }
.dim-effort { font-size: 9px; color: #888; margin-top: 4px; display: flex; gap: 8px; }
.dim-impact { color: #1a7a3c; font-weight: 600; }
.action-list { display: grid; grid-template-columns: 1fr; gap: 6px; }
.action-item { border-left: 3px solid #ccc; padding: 9px 12px; background: #fafaf8; border-radius: 4px; page-break-inside: avoid; }
.action-critical { border-color: #dc2626; }
.action-high_impact { border-color: #ea580c; }
.action-polish { border-color: #06b6d4; }
.action-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.action-priority { font-size: 9px; text-transform: uppercase; color: #666; font-weight: 700; padding: 1px 6px; background: #fff; border-radius: 3px; border: 1px solid #ccc; }
.action-title { font-weight: 700; font-size: 12px; flex: 1; }
.action-impact { font-size: 10px; color: #1a7a3c; font-weight: 600; padding: 2px 6px; background: #f0faf4; border-radius: 3px; }
.action-body { font-size: 11px; color: #555; line-height: 1.5; }
.action-meta { font-size: 10px; color: #888; margin-top: 3px; }
.market-layout { display: grid; grid-template-columns: 220px 1fr; gap: 16px; align-items: center; margin-bottom: 12px; }
.market-cards { display: grid; gap: 6px; }
.m-card { padding: 9px 12px; border-radius: 6px; border-left: 4px solid #ccc; background: #fafaf8; }
.m-card-tam { border-color: #3b82f6; }
.m-card-sam { border-color: #15803d; }
.m-card-som { border-color: #1d4ed8; }
.m-card-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; font-weight: 600; }
.m-card-value { font-size: 22px; font-weight: 700; color: #1a1a1a; line-height: 1.1; }
.m-card-src { font-size: 10px; color: #666; margin-top: 3px; line-height: 1.4; }
.methodology-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.meth-card { padding: 9px 12px; border-radius: 6px; }
.meth-topdown { background: #eff6ff; border: 1px solid #bfdbfe; }
.meth-bottomup { background: #f0fdf4; border: 1px solid #bbf7d0; }
.meth-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
.meth-topdown .meth-label { color: #1d4ed8; }
.meth-bottomup .meth-label { color: #15803d; }
.meth-text { font-size: 11px; color: #444; line-height: 1.5; }
.growth-row { display: grid; grid-template-columns: 100px 1fr 130px; gap: 10px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 8px; }
.cagr-label, .drivers-label, .markets-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
.cagr-value { font-size: 26px; font-weight: 700; color: #1a1a1a; }
.drivers-list { list-style: none; font-size: 11px; color: #1a7a3c; line-height: 1.5; }
.markets-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.market-pill { font-size: 10px; color: #555; padding: 1px 7px; background: #f0f0f0; border-radius: 10px; font-weight: 500; }
.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
.data-table th { text-align: left; color: #888; font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; border-bottom: 1px solid #ddd; }
.data-table th.num { text-align: right; }
.data-table td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
.data-table td.num { text-align: right; }
.row-highlight { background: #f0faf4; }
.football-field { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
.ff-row { display: grid; grid-template-columns: 160px 90px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; align-items: baseline; page-break-inside: avoid; }
.ff-row:last-child { border: none; }
.ff-name { font-weight: 700; font-size: 11px; }
.ff-conf { font-size: 9px; color: #888; margin-left: 4px; text-transform: lowercase; }
.ff-range { font-weight: 700; font-size: 12px; color: #1a7a3c; }
.ff-notes { font-size: 10px; color: #666; line-height: 1.45; }
.rec-pre-box { background: #f0faf4; border: 2px solid #86efac; border-radius: 8px; padding: 12px 14px; margin-top: 12px; page-break-inside: avoid; }
.rec-pre-label { font-size: 10px; color: #15803d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
.rec-pre-value { font-size: 22px; font-weight: 700; color: #15803d; margin-bottom: 5px; }
.rec-pre-rationale { font-size: 11px; color: #444; line-height: 1.55; }
.caption { font-size: 10px; color: #888; margin-top: 4px; line-height: 1.4; }
.comparison-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.comp-card { padding: 10px; border-radius: 6px; text-align: center; }
.comp-sea { background: #f0faf4; border: 1px solid #86efac; }
.comp-global { background: #eff6ff; border: 1px solid #bfdbfe; }
.comp-us { background: #fafaf8; border: 1px solid #ddd; }
.comp-label { font-size: 10px; color: #666; font-weight: 600; margin-bottom: 2px; }
.comp-value { font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 2px 0; }
.comp-median { font-size: 11px; color: #555; }
.comp-note { font-size: 9px; color: #888; margin-top: 3px; line-height: 1.4; }
.appetite-text { font-size: 11px; color: #444; line-height: 1.55; padding: 10px 12px; background: #fafaf8; border-radius: 6px; }
.comp-deals { display: grid; grid-template-columns: 1fr; gap: 6px; }
.comp-deal { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 5px; page-break-inside: avoid; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.comp-deal-desc { font-size: 11px; color: #1a1a1a; flex: 1; }
.comp-deal-meta { font-size: 10px; color: #1a7a3c; font-weight: 600; white-space: nowrap; }
.moat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.moat-pill { background: #fafaf8; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
.moat-key { font-size: 9px; color: #888; text-transform: capitalize; margin-bottom: 2px; }
.moat-val { font-size: 14px; font-weight: 700; color: #1a4d2e; }
.moat-denom { font-size: 10px; color: #aaa; font-weight: 500; }
.num-list { padding-left: 18px; font-size: 11px; color: #444; line-height: 1.65; }
.num-list li { margin-bottom: 4px; }
.competitor-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; }
.comp-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.comp-card-name { font-weight: 700; font-size: 12px; }
.comp-tag { font-size: 9px; color: #1d4ed8; background: #dbeafe; padding: 1px 5px; border-radius: 3px; font-weight: 600; }
.comp-card-overlap { font-size: 10px; color: #ea580c; font-weight: 700; flex-shrink: 0; }
.comp-card-meta { font-size: 10px; color: #888; margin-bottom: 4px; }
.comp-card-desc { font-size: 11px; color: #444; line-height: 1.5; margin-bottom: 5px; }
.comp-card-funding { font-size: 10px; color: #1a7a3c; font-weight: 600; margin-bottom: 5px; }
.comp-card-sw { display: grid; gap: 4px; margin-top: 4px; }
.comp-strength, .comp-weakness { font-size: 10px; line-height: 1.5; padding: 6px 8px; border-radius: 4px; }
.comp-strength { background: #f0faf4; color: #14532d; }
.comp-weakness { background: #fef3c7; color: #92400e; }
.comp-card-inv { font-size: 10px; color: #666; margin-top: 4px; }
.whitespace-text { font-size: 11px; color: #444; line-height: 1.55; padding: 10px 12px; background: #f0faf4; border-radius: 6px; border-left: 3px solid #1a7a3c; }
.inv-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.stat-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center; }
.stat-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 22px; font-weight: 700; color: #1a7a3c; margin-top: 2px; }
.warm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
.warm-card { padding: 7px 9px; border: 1px solid #fcd34d; border-radius: 5px; background: #fef9e7; page-break-inside: avoid; }
.warm-name { font-size: 11px; font-weight: 700; color: #1a1a1a; }
.warm-via { font-size: 9px; color: #92400e; margin-top: 1px; }
.match-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 8px; page-break-inside: avoid; }
.match-rank { display: flex; align-items: flex-start; gap: 10px; }
.match-medal { font-size: 16px; flex-shrink: 0; min-width: 28px; color: #666; font-weight: 700; }
.match-info { flex: 1; min-width: 0; }
.match-name { font-size: 13px; font-weight: 700; }
.match-type { font-size: 10px; color: #888; font-weight: 500; }
.match-meta { font-size: 10px; color: #888; margin: 1px 0 4px; }
.match-reason { font-size: 11px; color: #1a7a3c; line-height: 1.5; }
.match-score-block { text-align: right; }
.match-score { font-size: 22px; font-weight: 700; color: #1a7a3c; line-height: 1; }
.match-details { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.match-pill { font-size: 10px; padding: 2px 8px; background: #f0faf4; color: #1a7a3c; border-radius: 10px; font-weight: 500; }
.match-pill-ticket { background: #f0f0f0; color: #555; }
.thesis { font-size: 11px; color: #444; padding: 6px 9px; border-left: 3px solid #ccc; background: #fafaf8; margin: 6px 0; font-style: italic; line-height: 1.45; }
.inv-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
.detail-label { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
.detail-val { font-size: 11px; color: #1a1a1a; }
.footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #aaa; line-height: 1.8; }
.positioning-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin-top: 6px; }
.positioning-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 14px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #f0f0f0; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #444; min-width: 0; }
.legend-dot { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #9ca3af; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; color: #4b5563; }
.legend-dot-founder { background: #1a4d2e; border-color: #1a4d2e; }
.legend-label { color: #444; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Print rules: let content flow naturally between sections. Only avoid splitting individual cards. */
@media print {
  body { padding: 16px 20px; }
  .tab-section { page-break-inside: auto; }
  .tab-title { page-break-after: avoid; }
  h3.subtitle { page-break-after: avoid; }
  .ov-card, .top-match, .missing-card, .dim-detail, .action-item, .ff-row, .competitor-card, .match-item, .comp-deal, .warm-card { page-break-inside: avoid; }
  .rec-pre-box, .positioning-block, .market-layout, .comparison-grid { page-break-inside: avoid; }
}`
