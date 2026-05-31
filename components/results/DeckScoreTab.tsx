// components/results/DeckScoreTab.tsx
'use client'
import { useState } from 'react'
import type { DeckAnalysis } from '@/lib/gemini'
import { TermTooltip } from '@/components/ui'

interface Props { analysis: Record<string, unknown> | null }

const DIM_LABELS: Record<string, string> = {
  traction: 'Traction', problem: 'Problem & opportunity', solution: 'Solution & product',
  team: 'Team', market_size: 'Market size', business_model: 'Business model',
  financials: 'Financials & ask', narrative: 'Narrative & design',
}

export default function DeckScoreTab({ analysis }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!analysis) return <EmptyState />

  const a         = analysis as unknown as DeckAnalysis
  const dims      = a.dimensions || {}
  const fixes     = a.priority_fixes || []
  const missing   = a.missing_slides || []
  const generated = a.generated_content

  const critFixes   = fixes.filter(f => f.priority === 'critical')
  const highFixes   = fixes.filter(f => f.priority === 'high')
  const polishFixes = fixes.filter(f => f.priority === 'polish')

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-5xl font-semibold ${scoreColor(a.overall_score)}`}>
              {a.overall_score}
            </div>
            <div className="text-sm text-text-disabled mt-1">out of 100</div>
          </div>
          <div className="flex-1">
            <div className={`text-lg font-semibold mb-1 ${scoreColor(a.overall_score)}`}>
              {a.investor_readiness}
            </div>
            <div className="text-sm text-text-tertiary mb-2">
              Weights adapted for <span className="font-medium">{a.stage}</span> stage &nbsp;·&nbsp;
              Revenue type: <span className="font-medium capitalize">{(a.revenue_metric_type || 'unknown').replace(/_/g,' ')}</span>
            </div>
            {/* Mini spider */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(dims).map(([key, dim]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-text-tertiary truncate">{DIM_LABELS[key]}</span>
                    <span className="font-medium ml-1">{dim.score}/{dim.max_score}</span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(dim.score / dim.max_score) * 100}%`,
                        background: barColor(dim.score / dim.max_score),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stage readiness — honest gap analysis between deck content and stated stage */}
      {a.stage_readiness && (() => {
        const sr = a.stage_readiness
        const tone = sr.verdict === 'ready'
          ? { bg: 'bg-success-bg',  border: 'border-success-border',  text: 'text-success-text',  badge: 'bg-green-600 text-white',  label: 'Ready to raise' }
          : sr.verdict === 'borderline'
          ? { bg: 'bg-warning-bg',  border: 'border-warning-border',  text: 'text-warning-text',  badge: 'bg-amber-600 text-white',  label: 'Borderline' }
          : { bg: 'bg-danger-bg',    border: 'border-danger-border',    text: 'text-danger-text',    badge: 'bg-red-600 text-white',    label: 'Early for this stage' }
        return (
          <div className={`${tone.bg} ${tone.border} border rounded-xl p-5`}>
            {/* Header row */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className={`${tone.badge} text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide`}>{tone.label}</span>
              <span className="text-sm text-text-tertiary">
                Targeting <span className="font-semibold text-text-primary">{sr.stage_target}</span>
                {sr.actual_signals_stage && sr.actual_signals_stage !== sr.stage_target && (
                  <> &nbsp;·&nbsp; Deck signals read as <span className="font-semibold text-text-primary">{sr.actual_signals_stage}</span></>
                )}
              </span>
            </div>
            {/* Gap summary */}
            {sr.gap_summary && (
              <p className={`text-sm leading-relaxed ${tone.text} mb-4`}>{sr.gap_summary}</p>
            )}
            {/* Two-column: expectations + bridge actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sr.typical_expectations_at_target && sr.typical_expectations_at_target.length > 0 && (
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                    What investors expect at {sr.stage_target}
                  </p>
                  <ul className="space-y-1.5">
                    {sr.typical_expectations_at_target.map((item, i) => (
                      <li key={i} className="text-xs text-text-secondary leading-relaxed flex gap-2">
                        <span className="text-text-disabled mt-0.5">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sr.bridge_actions && sr.bridge_actions.length > 0 && (
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                    How to credibly raise at this stage
                  </p>
                  <ul className="space-y-1.5">
                    {sr.bridge_actions.map((item, i) => (
                      <li key={i} className="text-xs text-text-secondary leading-relaxed flex gap-2">
                        <span className="text-brand mt-0.5 font-bold">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Revenue metric note */}
      {a.revenue_metric_type === 'contract_acv' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <span className="font-semibold">Note on traction metrics:</span> This is a project/contract-based business. 
          Traction is evaluated on contract value, enterprise client quality, pipeline depth, and renewal evidence — 
          not <TermTooltip term="ARR">ARR</TermTooltip> or <TermTooltip term="MRR">MRR</TermTooltip> which are SaaS-specific metrics.
        </div>
      )}

      {/* Missing slides */}
      {missing.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            Missing slides ({missing.length} of 10 Sequoia-standard slides absent)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {missing.map((s, i) => (
              <div key={i} className="bg-danger-bg border border-danger-border rounded-lg p-3">
                <p className="text-sm font-medium text-danger-text">{s.slide}</p>
                <p className="text-xs text-danger-text mt-0.5">{s.why_critical}</p>
                <p className="text-xs text-red-400 mt-1">{s.stage_requirement}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dimension cards */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Dimension breakdown</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(dims).map(([key, dim]) => {
            const pct = dim.score / dim.max_score
            const isOpen = expanded === key
            return (
              <div
                key={key}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">{DIM_LABELS[key]}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-disabled">{dim.weight_pct}% weight</span>
                      <span className={`text-sm font-semibold ${pct >= 0.7 ? 'text-success-text' : pct >= 0.4 ? 'text-yellow-600' : 'text-danger-text'}`}>
                        {dim.score}/{dim.max_score}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-muted rounded-full">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${pct * 100}%`, background: barColor(pct) }}
                    />
                  </div>
                  <div className="flex gap-3 mt-2">
                    {(dim.found || []).slice(0,2).map((f, i) => (
                      <span key={i} className="text-xs text-success-text">✓ {f}</span>
                    ))}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                    {(dim.found || []).map((f, i) => (
                      <p key={i} className="text-xs text-success-text">✓ {f}</p>
                    ))}
                    {(dim.missing || []).map((m, i) => (
                      <p key={i} className="text-xs text-danger-text">✗ {m}</p>
                    ))}
                    {dim.best_practice && (
                      <div className="bg-surface-muted rounded-lg p-3 mt-2">
                        <p className="text-xs font-medium text-text-secondary mb-1">Best practice</p>
                        <p className="text-xs text-text-tertiary leading-relaxed">{dim.best_practice}</p>
                      </div>
                    )}
                    <div className="flex gap-3 text-xs text-text-disabled mt-1">
                      <span>Effort: {dim.fix_effort}</span>
                      <span className="font-medium text-success-text">{dim.score_impact}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Priority fixes */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Priority action plan</h3>
        <div className="space-y-2">
          {critFixes.map((fix, i) => <FixCard key={i} fix={fix} />)}
          {highFixes.map((fix, i) => <FixCard key={i} fix={fix} />)}
          {polishFixes.map((fix, i) => <FixCard key={i} fix={fix} />)}
        </div>
      </div>
    </div>
  )
}

function FixCard({ fix }: { fix: { priority: string; title: string; description: string; score_impact: string; effort: string } }) {
  const colors: Record<string, string> = {
    critical: 'border-red-400 bg-danger-bg',
    high:     'border-yellow-400 bg-yellow-50',
    polish:   'border-gray-300 bg-surface-muted',
  }
  const labels: Record<string, string> = {
    critical: 'Critical', high: 'High impact', polish: 'Polish'
  }
  return (
    <div className={`border-l-4 border rounded-xl p-4 ${colors[fix.priority]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              fix.priority === 'critical' ? 'bg-red-100 text-danger-text' :
              fix.priority === 'high'     ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-surface-muted text-text-tertiary'
            }`}>
              {labels[fix.priority]}
            </span>
          </div>
          <p className="text-sm font-medium text-text-primary">{fix.title}</p>
          <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{fix.description}</p>
          <p className="text-xs text-text-disabled mt-1.5">Effort: {fix.effort}</p>
        </div>
        <span className="text-xs font-semibold text-success-text bg-white px-2 py-1 rounded-md border border-success-border flex-shrink-0">
          {fix.score_impact}
        </span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
      <p className="text-text-disabled text-sm">Deck analysis is processing…</p>
      <p className="text-gray-300 text-xs mt-1">This can take up to 60 seconds</p>
    </div>
  )
}

const scoreColor = (s: number) => s >= 80 ? 'text-success-text' : s >= 60 ? 'text-yellow-600' : s >= 40 ? 'text-orange-500' : 'text-danger-text'
const barColor   = (pct: number) => pct >= 0.7 ? '#16a34a' : pct >= 0.4 ? '#d97706' : '#dc2626'
