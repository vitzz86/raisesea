// components/results/OverviewTab.tsx
import type { Dispatch, SetStateAction } from 'react'

interface Props {
  submission:           Record<string, unknown>
  deckAnalysis:         Record<string, unknown> | null
  marketAnalysis:       Record<string, unknown> | null
  competitiveAnalysis:  Record<string, unknown> | null
  matchResults:         Record<string, unknown>[]
  onTabChange:          Dispatch<SetStateAction<string>>
}

export default function OverviewTab({
  submission, deckAnalysis, marketAnalysis, competitiveAnalysis, matchResults, onTabChange
}: Props) {
  const score    = deckAnalysis?.overall_score as number | null
  const readiness = deckAnalysis?.investor_readiness as string | null
  const dims     = deckAnalysis?.dimensions as Record<string, { score: number; max_score: number }> | null
  const fixes    = (deckAnalysis?.priority_fixes as { priority: string; title: string; description: string; score_impact: string }[]) || []
  const topFixes = fixes.filter(f => f.priority === 'critical').slice(0, 3)
  const tam      = marketAnalysis?.tam_usd as number | null
  const recPre   = marketAnalysis?.recommended_premoney as { low: number; high: number; rationale: string } | null
  const moat     = competitiveAnalysis?.moat_scores as { overall: number } | null
  const top3     = matchResults.slice(0, 3)

  const scoreColor = !score ? 'text-gray-400'
    : score >= 80 ? 'text-green-700'
    : score >= 60 ? 'text-yellow-600'
    : score >= 40 ? 'text-orange-500'
    : 'text-red-600'

  return (
    <div className="space-y-6">

      {/* 4 metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Deck score"
          value={score != null ? `${score}/100` : '—'}
          sub={readiness || 'Pending analysis'}
          accent={score != null ? scoreColor : 'text-gray-400'}
          onClick={() => onTabChange('deck')}
        />
        <MetricCard
          label="Valuation (recommended)"
          value={recPre ? `$${(recPre.low/1e6).toFixed(1)}M–$${(recPre.high/1e6).toFixed(1)}M` : '—'}
          sub="Pre-money, SEA benchmark"
          onClick={() => onTabChange('market')}
        />
        <MetricCard
          label="Moat score"
          value={moat ? `${moat.overall}/10` : '—'}
          sub={moat ? (moat.overall >= 7 ? 'Strong' : moat.overall >= 5 ? 'Moderate' : 'Vulnerable') : 'Pending'}
          onClick={() => onTabChange('competitors')}
        />
        <MetricCard
          label="Investor matches"
          value={String(matchResults.length)}
          sub={`Top: ${top3[0] ? (top3[0].investor as { name: string }).name : '—'}`}
          onClick={() => onTabChange('investors')}
        />
      </div>

      {/* Top 3 matches */}
      {top3.length > 0 && (
        <div>
          <SectionTitle title="Top investor matches" action="See all →" onAction={() => onTabChange('investors')} />
          <div className="grid grid-cols-3 gap-4">
            {top3.map((m, i) => {
              const inv = m.investor as Record<string, string | number | string[]>
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-900">{inv.name}</span>
                    <span className="text-xs font-semibold text-[#1a4d2e] bg-green-50 px-2 py-0.5 rounded-full">
                      {m.score as number}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{inv.type} · {inv.hq_city}, {inv.hq_country}</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{m.reason as string}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {((inv.invest_stages || []) as string[]).slice(0,2).map((s, j) => (
                      <span key={j} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Priority fixes */}
      {topFixes.length > 0 && (
        <div>
          <SectionTitle title="Fix these before you pitch" action="Full deck analysis →" onAction={() => onTabChange('deck')} />
          <div className="space-y-2">
            {topFixes.map((fix, i) => (
              <div key={i} className="bg-white border-l-4 border-red-400 border border-gray-200 rounded-xl p-4 flex gap-4">
                <div className="w-6 h-6 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-500 text-xs font-bold">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{fix.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{fix.description}</p>
                </div>
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md flex-shrink-0 self-start">
                  {fix.score_impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market snapshot */}
      {marketAnalysis && (
        <div>
          <SectionTitle title="Market snapshot" action="Full analysis →" onAction={() => onTabChange('market')} />
          <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">TAM</p>
              <p className="text-lg font-semibold text-gray-900">${fmtM(tam)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{marketAnalysis.tam_source as string}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">SAM (SEA)</p>
              <p className="text-lg font-semibold text-gray-900">${fmtM(marketAnalysis.sam_usd as number)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">CAGR</p>
              <p className="text-lg font-semibold text-gray-900">{marketAnalysis.growth_rate_cagr as number}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Methodology</p>
              <p className={`text-sm font-semibold capitalize ${
                marketAnalysis.methodology_grade === 'bottom-up' ? 'text-green-700' :
                marketAnalysis.methodology_grade === 'missing' ? 'text-red-500' : 'text-yellow-600'
              }`}>
                {marketAnalysis.methodology_grade as string}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Competitor summary */}
      {competitiveAnalysis && competitiveAnalysis.moat_scores && (
        <div>
          <SectionTitle title="Competitive position" action="Full analysis →" onAction={() => onTabChange('competitors')} />
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex gap-4 mb-4">
              {Object.entries((competitiveAnalysis.moat_scores as Record<string, number>) || {})
                .filter(([k]) => !['overall','actions'].includes(k))
                .map(([key, val]) => (
                  <div key={key} className="flex-1 text-center">
                    <div className="text-lg font-semibold" style={{ color: moatColor(val as number) }}>{val}</div>
                    <div className="text-xs text-gray-400 capitalize mt-0.5">{key.replace(/_/g,' ')}</div>
                  </div>
                ))
              }
            </div>
            {(competitiveAnalysis.key_differentiators as string[] || []).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Key differentiators</p>
                <div className="flex flex-wrap gap-1.5">
                  {(competitiveAnalysis.key_differentiators as string[]).map((d, i) => (
                    <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, accent, onClick }: {
  label: string; value: string; sub: string; accent?: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-[#1a4d2e] hover:shadow-sm transition-all group"
    >
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      <p className={`text-2xl font-semibold ${accent || 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </button>
  )
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs text-[#1a4d2e] hover:underline">{action}</button>
      )}
    </div>
  )
}

function fmtM(n: number | null): string {
  if (!n) return '—'
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  return `${(n/1e3).toFixed(0)}K`
}

function moatColor(score: number): string {
  if (score >= 7) return '#16a34a'
  if (score >= 5) return '#d97706'
  return '#dc2626'
}
