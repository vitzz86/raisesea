// components/results/InvestorsTab.tsx
'use client'
import { useState } from 'react'

interface Investor {
  id: string; name: string; type: string; hq_city: string; hq_country: string
  description?: string; invest_stages?: string[]; invest_sectors?: string[]
  invest_countries?: string[]
  ticket_min_usd?: number; ticket_max_usd?: number
  website?: string; linkedin?: string
  investment_thesis?: string
  investment_strategy?: string
  follow_on_investment?: string
  investment_instrument?: string
  ownership_preference?: string
  min_traction_stage?: string
  business_model_pref?: string
  founder_preference?: string
  value_add?: string
  notable_portfolio?: string
  co_investors?: string
  top_sectors_detail?: string
  invest_locations_detail?: string
  num_investments?: number
  leadership_name?: string
  leadership_title?: string
  leadership_linkedin?: string
  active_confidence?: string
}

interface Match {
  score: number
  reason: string
  investor: Investor
  // Breakdown keys match what scoreInvestor writes — see lib/matching.ts
  score_breakdown: { active: number; sector: number; stage: number; ticket: number; thesis: number; location: number; lead_bonus?: number }
}

// Maximum points per category (matches scoreInvestor in lib/matching.ts).
// Thesis was removed (signal was too noisy). Raw max is 88 → rescaled to 100 in matching.ts.
const MAX = { active: 20, sector: 22, stage: 20, ticket: 18, location: 8 } as const

type FounderContext = {
  company_name: string
  sector: string
  stage: string
  business_model: string
  annual_revenue_usd: number
  current_mrr_usd: number
  raise_target_usd: number
  country: string
}

type WarmIntroEntry = {
  investor: string
  via?: string                  // legacy single via — back-compat
  via_investors?: string[]      // full list of "via"s
  matched_id?: string | null
  matched_in_db?: boolean
  // Full investor payload when matched_in_db is true — enables click-to-open popup
  investor_data?: Investor
}

interface Props {
  matchResults: Record<string, unknown>[]
  warmIntros:   WarmIntroEntry[]
  submission:   Record<string, unknown>
}

export default function InvestorsTab({ matchResults, warmIntros, submission }: Props) {
  const matches = matchResults as unknown as Match[]
  const [selected, setSelected] = useState<Match | null>(null)

  // Build founder context for the "Tailored approach" suggestions in the modal
  const founderContext: FounderContext = {
    company_name:       (submission?.company_name as string) || '',
    sector:             (submission?.sector as string) || '',
    stage:              (submission?.stage as string) || '',
    business_model:     (submission?.business_model as string) || '',
    annual_revenue_usd: (submission?.annual_revenue_usd as number) || 0,
    current_mrr_usd:    (submission?.current_mrr_usd as number) || 0,
    raise_target_usd:   (submission?.raise_target_usd as number) || 0,
    country:            (submission?.country as string) || '',
  }

  const avgScore = matches.length
    ? Math.round(matches.slice(0, 10).reduce((s, m) => s + m.score, 0) / Math.min(matches.length, 10))
    : null

  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total matches"        value={matches.length} />
        <StatCard label="Top score"            value={matches[0]?.score ?? '—'} accent />
        <StatCard label="Avg score (top 10)"   value={avgScore ?? '—'} />
        <StatCard label="Warm intros available" value={warmIntros?.length || 0} />
      </div>

      {/* Warm intros */}
      {warmIntros?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Warm intro network <span className="text-xs text-gray-400 font-normal">— co-investors of your existing backers</span>
          </h3>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800 mb-3">
              These investors have co-invested with one or more of your current investors. A warm intro through a shared connection converts 3-5× better than cold outreach. <span className="font-medium">Click any chip with full details to see the profile.</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {warmIntros.map((intro: WarmIntroEntry, i) => {
                const vias = intro.via_investors && intro.via_investors.length > 0
                  ? intro.via_investors
                  : (intro.via ? [intro.via] : [])
                const clickable = intro.matched_in_db && intro.investor_data
                const ChipContent = (
                  <>
                    <span className="font-semibold text-gray-900">{intro.investor}</span>
                    {vias.length > 0 && (
                      <span className="text-gray-500"> via {vias.join(', ')}</span>
                    )}
                    {clickable && <span className="text-[#1a4d2e] ml-1.5 text-[10px]">↗</span>}
                    {intro.matched_in_db === false && (
                      <span className="text-gray-300 ml-1 text-[10px]">(not in DB)</span>
                    )}
                  </>
                )
                if (clickable) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        // Synthesize a Match shape so the same modal can render. No score/breakdown.
                        const synthetic: Match = {
                          score: 0,                       // 0 = signal to modal to hide score sections
                          reason: `Warm intro via ${vias.join(', ')}`,
                          investor: intro.investor_data!,
                          score_breakdown: { active: 0, sector: 0, stage: 0, ticket: 0, thesis: 0, location: 0 },
                        }
                        setSelected(synthetic)
                      }}
                      className="bg-white border border-amber-300 hover:border-[#1a4d2e] hover:shadow-sm rounded-lg px-3 py-2 text-xs transition-all cursor-pointer"
                    >
                      {ChipContent}
                    </button>
                  )
                }
                return (
                  <div key={i} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs">
                    {ChipContent}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Investor leaderboard</h3>
        <div className="space-y-2">
          {matches.map((m, i) => (
            <InvestorRow key={i} match={m} rank={i + 1} onClick={() => setSelected(m)} />
          ))}
        </div>
        {matches.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            No investor matches yet. If this persists after a fresh submission, check the terminal for the <code>[match]</code> log line — it shows how many investors made it through each filter stage.
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && <InvestorDetailModal match={selected} founderContext={founderContext} onClose={() => setSelected(null)} />}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-[#1a4d2e]' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function InvestorRow({ match, rank, onClick }: { match: Match; rank: number; onClick: () => void }) {
  const inv = match.investor
  const medals = ['🥇', '🥈', '🥉']
  const medal = rank <= 3 ? medals[rank - 1] : null
  const sb = match.score_breakdown || {} as Match['score_breakdown']

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1a4d2e]/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-4">
        {/* Rank + score */}
        <div className="text-center flex-shrink-0 w-12">
          {medal ? (
            <div className="text-xl leading-none mb-1">{medal}</div>
          ) : (
            <div className="text-xs text-gray-400 mb-1">#{rank}</div>
          )}
          <div className={`text-2xl font-semibold leading-none ${rank <= 3 ? 'text-[#1a4d2e]' : 'text-gray-700'}`}>
            {match.score}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 group-hover:text-[#1a4d2e]">{inv.name}</span>
            {inv.type && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{inv.type}</span>}
            {(inv.hq_city || inv.hq_country) && (
              <span className="text-xs text-gray-400">{[inv.hq_city, inv.hq_country].filter(Boolean).join(', ')}</span>
            )}
          </div>
          {match.reason && <p className="text-xs text-gray-500 mt-1">{match.reason}</p>}
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            {(inv.invest_stages || []).slice(0, 3).map(s => (
              <span key={s} className="text-xs bg-green-50 text-green-800 px-1.5 py-0.5 rounded">{s}</span>
            ))}
            {(inv.ticket_min_usd || inv.ticket_max_usd) && (
              <span className="text-xs text-gray-400">{fmtTicket(inv.ticket_min_usd, inv.ticket_max_usd)}</span>
            )}
            {inv.investment_strategy && (
              <span className="text-xs text-gray-500">· {inv.investment_strategy}</span>
            )}
          </div>
        </div>

        {/* Score breakdown — visible on desktop */}
        <div className="flex-shrink-0 hidden lg:flex gap-3 items-start">
          {(['active','sector','stage','ticket','location'] as const).map(k => {
            const v = sb[k] ?? 0
            const m = MAX[k]
            const pct = (v / m) * 100
            const color = pct >= 70 ? 'text-[#1a4d2e]' : pct >= 40 ? 'text-yellow-700' : 'text-gray-400'
            return (
              <div key={k} className="text-center min-w-[44px]">
                <div className={`text-sm font-semibold ${color}`}>{v}<span className="text-gray-300 font-normal">/{m}</span></div>
                <div className="text-[10px] text-gray-300 capitalize mt-0.5">{k}</div>
              </div>
            )
          })}
        </div>

        {/* Expand cue */}
        <div className="text-xs text-gray-300 group-hover:text-[#1a4d2e] flex-shrink-0 self-center">View →</div>
      </div>
    </button>
  )
}

function InvestorDetailModal({ match, founderContext, onClose }: { match: Match; founderContext: FounderContext; onClose: () => void }) {
  const inv = match.investor
  const sb  = match.score_breakdown || {} as Match['score_breakdown']
  const confColor = inv.active_confidence === 'High' ? 'bg-green-100 text-green-800' :
                    inv.active_confidence === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    inv.active_confidence === 'Low' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-600'

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl p-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {match.score > 0 ? (
                <div className="text-3xl font-semibold text-[#1a4d2e] leading-none flex-shrink-0">{match.score}</div>
              ) : (
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded leading-tight flex-shrink-0">Warm<br />intro</div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{inv.name}</div>
                <div className="text-xs text-gray-500">
                  {[inv.type, inv.hq_city].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-700 text-xl leading-none flex-shrink-0">✕</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inv.active_confidence && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confColor}`}>
                ● {inv.active_confidence} confidence
              </span>
            )}
            {(inv.invest_stages || []).map(s => (
              <span key={s} className="text-xs bg-green-50 text-green-800 px-2 py-0.5 rounded-full">{s}</span>
            ))}
            {(inv.invest_countries || []).slice(0, 4).map(c => (
              <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Score breakdown — hidden for warm-intro popups (score === 0) since they're not scored matches */}
          {match.score > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Score breakdown</p>
              <div className="grid grid-cols-3 gap-2">
                {(['active','sector','stage','ticket','location'] as const).map(k => {
                  const v = sb[k] ?? 0
                  const m = MAX[k]
                  const pct = (v / m) * 100
                  return (
                    <div key={k} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{k}</div>
                      <div className="text-base font-semibold text-gray-800">
                        {v}<span className="text-gray-300 font-normal">/{m}</span>
                      </div>
                      <div className="h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-1 bg-[#1a4d2e]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {match.reason && (
                <div className="mt-3 bg-[#1a4d2e]/5 rounded-lg p-3 text-sm text-[#1a4d2e]">
                  {match.reason}
                </div>
              )}
            </div>
          ) : (
            // Warm intro context banner
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
              <span className="font-semibold">Warm intro candidate</span> — {match.reason}. They co-invest with your existing backer(s). Not scored against your profile, but a shared-connection intro typically converts 3–5× better than cold outreach.
            </div>
          )}

          {/* Tailored approach — only for scored matches */}
          {match.score > 0 && (() => {
            const suggestions = generateApproachSuggestions(match, founderContext)
            if (suggestions.length === 0) return null
            return (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Tailored approach
                  <span className="text-gray-300 font-normal normal-case ml-1">— how to pitch them</span>
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="text-green-600 flex-shrink-0 font-bold leading-relaxed">{s.emoji}</span>
                      <div className="min-w-0">
                        <span className="font-medium text-green-900">{s.headline}</span>
                        {s.detail && <span className="text-green-800"> — {s.detail}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Investment thesis */}
          {inv.investment_thesis && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Investment thesis</p>
              <p className="text-sm text-gray-700 leading-relaxed border-l-2 border-[#1a4d2e]/40 pl-3 italic">
                &ldquo;{inv.investment_thesis}&rdquo;
              </p>
            </div>
          )}

          {/* Key details grid */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Key details</p>
            <div className="grid grid-cols-2 gap-2">
              <KV label="Ticket size"   val={fmtTicket(inv.ticket_min_usd, inv.ticket_max_usd)} />
              <KV label="Strategy"      val={inv.investment_strategy} />
              <KV label="Min traction"  val={inv.min_traction_stage} />
              <KV label="Follow-on"     val={inv.follow_on_investment} />
              <KV label="Instrument"    val={inv.investment_instrument} />
              <KV label="Ownership"     val={inv.ownership_preference} />
              <KV label="Business model" val={inv.business_model_pref} />
              <KV label="Founder pref"  val={inv.founder_preference} />
            </div>
          </div>

          {/* Actual portfolio composition — pie charts for sector + geography */}
          {(inv.top_sectors_detail || inv.invest_locations_detail) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inv.top_sectors_detail && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sector composition</p>
                  <CompositionPie data={parseComposition(inv.top_sectors_detail)} palette={SECTOR_PALETTE} />
                </div>
              )}
              {inv.invest_locations_detail && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Geography composition</p>
                  <CompositionPie data={parseComposition(inv.invest_locations_detail)} palette={GEO_PALETTE} />
                </div>
              )}
            </div>
          )}

          {/* Notable portfolio */}
          {inv.notable_portfolio && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notable portfolio</p>
              <div className="flex flex-wrap gap-1.5">
                {inv.notable_portfolio.split(',').map(p => p.trim()).filter(Boolean).map(p => (
                  <span key={p} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Co-investors */}
          {inv.co_investors && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Frequent co-investors</p>
              <div className="flex flex-wrap gap-1.5">
                {inv.co_investors.split(',').map(p => p.trim()).filter(Boolean).slice(0, 12).map(p => (
                  <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Value add */}
          {inv.value_add && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Value add</p>
              <div className="flex flex-wrap gap-1.5">
                {inv.value_add.split(',').map(v => v.trim()).filter(Boolean).map(v => (
                  <span key={v} className="text-xs bg-green-50 text-green-800 px-2 py-1 rounded">{v}</span>
                ))}
              </div>
            </div>
          )}

          {/* Lead partner */}
          {inv.leadership_name && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Lead partner</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center text-[#1a4d2e] font-medium text-sm flex-shrink-0">
                  {inv.leadership_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{inv.leadership_name}</div>
                  {inv.leadership_title && <div className="text-xs text-gray-400 truncate">{inv.leadership_title}</div>}
                </div>
                {inv.leadership_linkedin && (
                  <a href={inv.leadership_linkedin} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#1a4d2e] hover:underline flex-shrink-0">LinkedIn →</a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 p-4 flex gap-2">
          {inv.website && /^https?:\/\//.test(inv.website) && (
            <a href={inv.website} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm font-medium text-center bg-[#1a4d2e] hover:bg-[#143d24] text-white py-2.5 rounded-lg transition-colors">
              Visit website →
            </a>
          )}
          {inv.linkedin && /^https?:\/\//.test(inv.linkedin) && (
            <a href={inv.linkedin} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium px-4 border border-gray-300 hover:border-[#1a4d2e] text-gray-700 hover:text-[#1a4d2e] py-2.5 rounded-lg transition-colors">
              LinkedIn
            </a>
          )}
          <button onClick={onClose}
            className="text-sm font-medium px-4 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2.5 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function KV({ label, val }: { label: string; val?: string | null }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 truncate">{val || '—'}</div>
    </div>
  )
}

function fmtTicket(min?: number, max?: number): string {
  if (!min && !max) return '—'
  const fmt = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${(n/1e3).toFixed(0)}K`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `up to ${fmt(max!)}`
}

// ────────────────────────────────────────────────────────────────────
// Tailored approach suggestions — rule-based using data we already have.
// We deliberately avoid an extra Gemini call here (would be N matches ×
// per-investor cost). The signals below are concrete enough to be useful
// without one. Returns 3-6 short bullets in priority order.
// ────────────────────────────────────────────────────────────────────
type Suggestion = { emoji: string; headline: string; detail?: string }

function generateApproachSuggestions(match: Match, ctx: FounderContext): Suggestion[] {
  const inv = match.investor
  const sb  = match.score_breakdown || {} as Match['score_breakdown']
  const out: Suggestion[] = []

  // ── 1. Lead-in angle based on strongest scoring dimension ──
  const dims = [
    { k: 'sector',   v: sb.sector   ?? 0, m: 22, label: `${ctx.sector} sector fit` },
    { k: 'location', v: sb.location ?? 0, m: 8,  label: `${ctx.country}/SEA focus` },
    { k: 'stage',    v: sb.stage    ?? 0, m: 20, label: `${ctx.stage} stage` },
    { k: 'ticket',   v: sb.ticket   ?? 0, m: 18, label: 'ticket size fit' },
  ].sort((a, b) => (b.v / b.m) - (a.v / a.m))
  const top = dims[0]
  if (top.v / top.m >= 0.7) {
    if (top.k === 'sector') {
      const sectorDetail = (inv.top_sectors_detail || '').match(new RegExp(`${ctx.sector}\\s*\\((\\d+)%\\)`, 'i'))
      out.push({
        emoji: '🎯',
        headline: `Lead with your sector positioning`,
        detail: sectorDetail
          ? `${ctx.sector} is ~${sectorDetail[1]}% of their portfolio — they have direct pattern recognition for what works here`
          : `${ctx.sector} is one of their stated focus sectors — frame your wedge in their language`,
      })
    } else if (top.k === 'location') {
      out.push({
        emoji: '📍',
        headline: `Lead with your ${ctx.country || 'local'} market traction`,
        detail: `This is their primary geography — local customer logos, regulatory wins, and on-the-ground team will resonate more than global ambition`,
      })
    } else if (top.k === 'stage') {
      out.push({
        emoji: '🪜',
        headline: `Frame your raise as a textbook ${ctx.stage} round`,
        detail: `They specialize at this stage — your $${(ctx.raise_target_usd/1e6).toFixed(1)}M ask should fit their standard process. Don't over-explain stage rationale.`,
      })
    } else if (top.k === 'ticket') {
      out.push({
        emoji: '💵',
        headline: `Your raise size sits squarely in their sweet spot`,
        detail: `Ticket ${fmtTicket(inv.ticket_min_usd, inv.ticket_max_usd)} matches your ${(ctx.raise_target_usd/1e6).toFixed(1)}M ask — lead with the round structure, not the size`,
      })
    }
  }

  // ── 2. Investment strategy ── what role to ask them for
  const strat = (inv.investment_strategy || '').toLowerCase()
  if (strat === 'lead') {
    out.push({
      emoji: '👑',
      headline: `Pitch them for the lead position`,
      detail: `They typically lead rounds — be ready with a term sheet ask and let them set price`,
    })
  } else if (strat === 'co-lead') {
    out.push({
      emoji: '🤝',
      headline: `Approach with a soft-circled lead`,
      detail: `They prefer to co-lead — having even an informal lead commitment first signals you understand their preferred role`,
    })
  } else if (strat === 'follow' || strat === 'agnostic') {
    out.push({
      emoji: '🪞',
      headline: `Best to approach after lead is committed`,
      detail: `They're typically a follow investor — names of who's already in will move the meeting faster than your pitch deck`,
    })
  }

  // ── 3. Traction story ── how to talk about metrics
  const hasRevenue = (ctx.annual_revenue_usd > 0) || (ctx.current_mrr_usd > 0)
  if (hasRevenue) {
    if (ctx.business_model.toLowerCase().includes('saas') || ctx.business_model.toLowerCase().includes('subscription')) {
      out.push({
        emoji: '📈',
        headline: `Lead with MRR/ARR and retention`,
        detail: ctx.current_mrr_usd > 0
          ? `Show MRR trajectory, gross retention, net retention. Avoid lifetime-bookings vanity metrics.`
          : `Frame ARR + cohort retention as your headline metrics`,
      })
    } else {
      out.push({
        emoji: '📈',
        headline: `Lead with contract value and pipeline`,
        detail: `For ${ctx.business_model || 'contract'} businesses: total contract value, named pipeline, average sales cycle. Investors at this stage care about deal velocity.`,
      })
    }
  } else {
    out.push({
      emoji: '👥',
      headline: `Lead with team and design partners`,
      detail: `You're pre-revenue — focus their attention on team credibility, named LOIs/design partners, and the wedge insight. Don't try to fake traction.`,
    })
  }

  // ── 4. Portfolio name-drop opportunity ──
  if (inv.notable_portfolio) {
    const portfolio = inv.notable_portfolio.split(',').map(s => s.trim()).filter(Boolean)
    if (portfolio.length > 0) {
      out.push({
        emoji: '🔗',
        headline: `Reference their portfolio in your outreach`,
        detail: `Mention you've studied ${portfolio.slice(0, 2).join(' and ')}${portfolio.length > 2 ? ' (among others)' : ''}. Show what you learned from their bet patterns.`,
      })
    }
  }

  // ── 5. Value-add hook ── ask about specifically what they offer
  if (inv.value_add) {
    const vAdds = inv.value_add.split(',').map(s => s.trim()).filter(Boolean)
    if (vAdds.length > 0) {
      out.push({
        emoji: '🎁',
        headline: `Ask about their ${vAdds[0].toLowerCase()} support`,
        detail: `That's their stated value-add${vAdds.length > 1 ? ` (along with ${vAdds.slice(1, 3).map(v => v.toLowerCase()).join(', ')})` : ''} — showing you'd actively use their network is a stronger signal than asking about money`,
      })
    }
  }

  // ── 6. Warnings ──
  if ((inv.follow_on_investment || '').toLowerCase() === 'no') {
    out.push({
      emoji: '⚠️',
      headline: `Don't bank on follow-on capital from them`,
      detail: `They typically don't reinvest — plan your next round's lead independently`,
    })
  }
  if (inv.active_confidence === 'Low') {
    out.push({
      emoji: '🔍',
      headline: `Verify they're actively deploying`,
      detail: `Low confidence signal on recent activity — check their last 6 months of announcements before committing time to a pitch`,
    })
  }

  // ── 7. Lead partner direct ──
  if (inv.leadership_name) {
    const firstName = inv.leadership_name.split(' ')[0]
    out.push({
      emoji: '✉️',
      headline: `Reach out to ${firstName} directly`,
      detail: inv.leadership_title
        ? `${inv.leadership_name} (${inv.leadership_title}) is listed as the lead partner${inv.leadership_linkedin ? ' — LinkedIn link in this card' : ''}`
        : `${inv.leadership_name} is the listed lead partner`,
    })
  }

  // Return top 5 to keep the section scannable
  return out.slice(0, 5)
}

// ────────────────────────────────────────────────────────────────────
// Composition pie chart — parses strings like
//   "SaaS (40%), AI/ML (25%), Logistics (15%), Fintech (10%), Deep Tech (10%)"
// into segments and renders as an SVG donut chart with legend on the side.
// ────────────────────────────────────────────────────────────────────
type PieSegment = { label: string; pct: number }

function parseComposition(text: string): PieSegment[] {
  if (!text) return []
  // Match "Label (NN%)" or "Label NN%" patterns
  const matches = Array.from(text.matchAll(/([A-Za-z][A-Za-z0-9 &\/.+-]*?)\s*\((\d+(?:\.\d+)?)%\)/g))
  const segments = matches.map(m => ({
    label: m[1].trim().replace(/\s*,\s*$/, ''),
    pct: parseFloat(m[2]),
  })).filter(s => s.label && s.pct > 0)
  // Sort largest first for visual clarity
  segments.sort((a, b) => b.pct - a.pct)
  // If percentages don't sum to ≥95%, append an "Other" slice
  const total = segments.reduce((s, x) => s + x.pct, 0)
  if (total > 0 && total < 95) {
    segments.push({ label: 'Other', pct: Math.round(100 - total) })
  }
  return segments
}

// Distinct color palettes for sectors vs geography so charts are visually different
const SECTOR_PALETTE = ['#1a4d2e', '#3b82f6', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#be185d']
const GEO_PALETTE    = ['#0c4a6e', '#15803d', '#a16207', '#7e22ce', '#b91c1c', '#0f766e', '#4338ca', '#9f1239']

function CompositionPie({ data, palette }: { data: PieSegment[]; palette: string[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">No composition data</p>
  }

  // Donut chart geometry
  const size = 130
  const cx = size / 2
  const cy = size / 2
  const rOuter = 58
  const rInner = 34

  // Build slice path commands.
  // Each slice covers (pct/100) * 2π radians, starting from the top (12 o'clock).
  let cumulative = 0
  const slices = data.map((seg, i) => {
    const startAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2
    cumulative += seg.pct
    const endAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2

    const x1Outer = cx + rOuter * Math.cos(startAngle)
    const y1Outer = cy + rOuter * Math.sin(startAngle)
    const x2Outer = cx + rOuter * Math.cos(endAngle)
    const y2Outer = cy + rOuter * Math.sin(endAngle)
    const x1Inner = cx + rInner * Math.cos(endAngle)
    const y1Inner = cy + rInner * Math.sin(endAngle)
    const x2Inner = cx + rInner * Math.cos(startAngle)
    const y2Inner = cy + rInner * Math.sin(startAngle)
    const largeArc = seg.pct > 50 ? 1 : 0

    const d = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
      'Z',
    ].join(' ')

    return { d, color: palette[i % palette.length], ...seg }
  })

  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="1.5">
            <title>{s.label}: {s.pct}%</title>
          </path>
        ))}
      </svg>
      <ul className="flex-1 min-w-0 space-y-1 text-xs">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700 truncate flex-1 min-w-0">{s.label}</span>
            <span className="text-gray-500 font-medium flex-shrink-0">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
