// components/results/MarketTab.tsx
'use client'
import { useState } from 'react'
import { TermTooltip } from '@/components/ui'
import type { MarketAnalysis } from '@/lib/gemini'

interface Props {
  analysis:      Record<string, unknown> | null
  raiseTarget:   number
  sectorProfile: Record<string, unknown> | null
  deckAnalysis?: Record<string, unknown> | null
}

export default function MarketTab({ analysis, raiseTarget, sectorProfile, deckAnalysis }: Props) {
  if (!analysis) return <EmptyState />
  const a = analysis as unknown as MarketAnalysis

  const recPre = a.recommended_premoney
  const seaComp = a.sea_vs_us_vs_global

  // Prefer dual methodology when available, fall back to legacy single field
  const topdown  = a.sam_methodology_topdown  || (a.methodology_grade === 'top-down' ? a.sam_methodology : '')
  const bottomup = a.sam_methodology_bottomup || (a.methodology_grade === 'bottom-up' ? a.sam_methodology : '')

  // Clean up the methodology_note: drop the literal placeholder text if it leaked through
  const cleanMethodologyNote = (a.methodology_note && !a.methodology_note.toLowerCase().includes('assessment of their market slide quality + recommendation'))
    ? a.methodology_note
    : (a.methodology_grade === 'missing'
        ? 'No market slide in the deck — use our TAM/SAM/SOM above as a starting point and add to your pitch.'
        : 'Market slide present. Consider adding the alternate methodology (top-down or bottom-up) for stronger investor signal.')

  // Build drop-in slide content FROM market analysis data (single source of truth).
  // We render it as structured HTML for the screen, but also keep a markdown
  // version for the Copy-to-clipboard button so it pastes cleanly into Notion / docs.
  type SlideRow =
    | { kind: 'heading'; text: string }
    | { kind: 'item'; label: string; value: string; sub?: string[] }
  const slideRows: SlideRow[] = []
  if (a.tam_usd && a.sam_usd && a.som_usd) {
    slideRows.push({ kind: 'heading', text: 'Market Opportunity' })
    slideRows.push({
      kind: 'item',
      label: 'TAM (Total Addressable Market)',
      value: `${fmtMarketSize(a.tam_usd)} — ${a.tam_source || 'industry sources'}`,
    })
    slideRows.push({
      kind: 'item',
      label: 'SAM (Serviceable Addressable Market)',
      value: fmtMarketSize(a.sam_usd),
      sub: [
        topdown  ? `Top-down: ${topdown}`  : '',
        bottomup ? `Bottom-up: ${bottomup}` : '',
      ].filter(Boolean),
    })
    slideRows.push({
      kind: 'item',
      label: 'SOM (Year 3, Serviceable Obtainable Market)',
      value: `${fmtMarketSize(a.som_usd)} — ${a.som_rationale || 'projected capture rate'}`,
    })
    if (a.growth_rate_cagr) {
      slideRows.push({ kind: 'item', label: 'CAGR', value: `${a.growth_rate_cagr}% across SEA` })
    }
  }
  // Markdown version for clipboard copy
  const slideMarkdown = slideRows.length === 0 ? '' : slideRows.map(r => {
    if (r.kind === 'heading') return `## ${r.text}\n`
    const lines = [`**${r.label}:** ${r.value}`]
    if (r.sub) r.sub.forEach(s => lines.push(`  · ${s}`))
    return lines.join('\n')
  }).join('\n\n')

  const showDropIn = slideRows.length > 0 && a.methodology_grade === 'missing'

  return (
    <div className="space-y-6">

      {/* Market size cards */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Market sizing</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {/* Circles + label pills */}
          <div className="flex flex-col md:flex-row items-center gap-6 mb-5">
            <div className="flex-shrink-0">
              <TamSamSomCircles tam={a.tam_usd} sam={a.sam_usd} som={a.som_usd} />
            </div>
            {/* Stacked label cards — one per ring, always separated */}
            <div className="flex-1 grid grid-cols-1 gap-2 w-full min-w-0">
              <RingLabel
                level="TAM"
                tagline="Total Addressable Market (global)"
                value={a.tam_usd}
                source={a.tam_source}
                accentBg="bg-blue-50"
                accentBorder="border-blue-300"
                accentText="text-blue-900"
                dotColor="#3b82f6"
              />
              <RingLabel
                level="SAM"
                tagline="Serviceable Addressable Market (SEA)"
                value={a.sam_usd}
                source={topdown || a.sam_methodology || ''}
                accentBg="bg-success-bg"
                accentBorder="border-green-300"
                accentText="text-green-900"
                dotColor="#15803d"
              />
              <RingLabel
                level="SOM"
                tagline="Serviceable Obtainable Market (Year 3)"
                value={a.som_usd}
                source={a.som_rationale}
                accentBg="bg-indigo-50"
                accentBorder="border-indigo-300"
                accentText="text-indigo-900"
                dotColor="#1d4ed8"
              />
            </div>
          </div>
        </div>

        {/* Dual methodology breakdown */}
        {(topdown || bottomup) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {topdown && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">Top-down methodology</p>
                <p className="text-xs text-blue-900 leading-relaxed">{topdown}</p>
              </div>
            )}
            {bottomup && (
              <div className="bg-success-bg border border-success-border rounded-xl p-3">
                <p className="text-xs font-semibold text-success-text mb-1">Bottom-up methodology</p>
                <p className="text-xs text-green-900 leading-relaxed">{bottomup}</p>
              </div>
            )}
          </div>
        )}

        {/* Methodology grade banner */}
        <div className={`mt-3 p-3 rounded-xl border text-sm ${
          a.methodology_grade === 'bottom-up' ? 'bg-success-bg border-success-border text-success-text' :
          a.methodology_grade === 'mixed'     ? 'bg-success-bg border-success-border text-success-text' :
          a.methodology_grade === 'missing'   ? 'bg-danger-bg border-danger-border text-danger-text' :
                                                'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <span className="font-semibold capitalize">
            {a.methodology_grade === 'missing' ? 'Market slide missing' : `Methodology: ${a.methodology_grade}`}
          </span>
          {' — '}{cleanMethodologyNote}
        </div>

        {/* Drop-in market slide — uses the SAME numbers as the cards above (single source of truth) */}
        {showDropIn && (
          <div className="mt-3 bg-white border-2 border-dashed border-brand/40 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">AI-generated</span>
                <p className="text-sm font-semibold text-text-primary">Drop-in market slide content</p>
              </div>
              <CopyButton text={slideMarkdown} />
            </div>
            <p className="text-xs text-text-tertiary mb-3">Same numbers as above — clean format for your deck. Click <span className="font-medium">Copy</span> for a markdown version. Validate the sources before using.</p>
            <div className="bg-surface-muted rounded p-4 space-y-3">
              {slideRows.map((row, i) => {
                if (row.kind === 'heading') {
                  return <h4 key={i} className="text-base font-bold text-text-primary mb-1">{row.text}</h4>
                }
                return (
                  <div key={i}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{row.label}:</span>
                      <span className="text-sm text-text-secondary">{row.value}</span>
                    </div>
                    {row.sub && row.sub.length > 0 && (
                      <ul className="mt-1 space-y-0.5 ml-3">
                        {row.sub.map((s, j) => (
                          <li key={j} className="text-xs text-text-tertiary leading-relaxed">· {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Growth */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
        {/* Top row: CAGR + Key markets — compact, side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-border-muted">
          <div className="min-w-0">
            <p className="text-xs text-text-disabled mb-1"><TermTooltip term="CAGR">CAGR</TermTooltip></p>
            <p className="text-2xl sm:text-3xl font-semibold text-brand truncate">{a.growth_rate_cagr}%</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">across SEA</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-disabled mb-1.5">Key markets</p>
            <div className="flex gap-1 flex-wrap">
              {(a.key_countries || []).map((c, i) => (
                <span key={i} className="text-[11px] sm:text-xs bg-surface-muted text-text-tertiary px-2 py-1 rounded-md font-mono">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Growth drivers as proper cards — stack on mobile, 2-col on desktop */}
        <div>
          <p className="text-xs text-text-tertiary font-medium mb-2.5">Growth drivers</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(a.growth_drivers || []).map((d, i) => (
              <div key={i} className="text-xs bg-success-bg/60 text-success-text px-3 py-2 rounded-md leading-relaxed flex gap-2 items-start">
                <span className="text-success-solid font-semibold shrink-0 mt-0.5">{i + 1}.</span>
                <span className="min-w-0">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sector-weighted multiple calculation */}
      {a.sector_multiples && a.blended_multiple && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Sector-weighted valuation multiple</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="bg-brand text-white">
                    <th className="text-left p-3 text-xs font-medium">Sector</th>
                    <th className="text-center p-3 text-xs font-medium">Weight</th>
                  <th className="text-center p-3 text-xs font-medium"><TermTooltip term="EV/Revenue">EV/Rev range (SEA)</TermTooltip></th>
                  <th className="text-right p-3 text-xs font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {a.sector_multiples.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-surface-muted' : 'bg-white'}>
                    <td className="p-3 text-xs font-medium text-text-primary">{row.sector}</td>
                    <td className="p-3 text-xs text-center text-text-tertiary">{Math.round(row.weight * 100)}%</td>
                    <td className="p-3 text-xs text-center text-text-tertiary">{row.ev_revenue_low}x – {row.ev_revenue_high}x</td>
                    <td className="p-3 text-xs text-right font-semibold text-brand">{row.contribution.toFixed(2)}x</td>
                  </tr>
                ))}
                <tr className="bg-brand/5 font-semibold">
                  <td className="p-3 text-sm text-text-primary">Blended multiple</td>
                  <td className="p-3 text-sm text-center text-text-tertiary">100%</td>
                  <td className="p-3 text-sm text-center text-text-tertiary">
                    {a.blended_multiple.low.toFixed(1)}x – {a.blended_multiple.high.toFixed(1)}x
                  </td>
                  <td className="p-3 text-sm text-right text-brand">{a.blended_multiple.mid.toFixed(1)}x mid</td>
                </tr>
              </tbody>
            </table>
            </div>
            {a.revenue_base_usd > 0 && (
              <div className="p-3 bg-success-bg border-t border-success-border text-xs text-success-text">
                Revenue-based range: ${fmtM(a.revenue_base_usd * a.blended_multiple.low)} – ${fmtM(a.revenue_base_usd * a.blended_multiple.high)} <TermTooltip term="pre-money valuation">pre-money</TermTooltip>
                &nbsp;·&nbsp; Applied to ${fmtM(a.revenue_base_usd)} annual revenue × {a.blended_multiple.mid.toFixed(1)}x
              </div>
            )}
          </div>
        </div>
      )}

      {/* Football field valuation chart */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Valuation football field</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {(() => {
            const scenarios = (a.valuation_scenarios || []).filter(s => s.premoney_high_usd > 0)
            // Dynamic scale: fit the highest scenario + recommended range
            const maxFromScenarios = Math.max(
              ...scenarios.map(s => s.premoney_high_usd),
              recPre?.high || 0,
            )
            const maxVal = Math.max(20e6, Math.ceil(maxFromScenarios * 1.15 / 1e6) * 1e6) // round up to nearest $1M, min $20M
            const recLoPct = recPre ? Math.min((recPre.low  / maxVal) * 100, 100) : 0
            const recHiPct = recPre ? Math.min((recPre.high / maxVal) * 100, 100) : 0

            return (
              <>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs">
                  {scenarios.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: SCENARIO_COLORS[i] || '#1a4d2e' }} />
                      <span className="text-text-tertiary">{s.label}</span>
                    </div>
                  ))}
                  {recPre && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                      <span className="text-text-tertiary">Recommended range</span>
                    </div>
                  )}
                </div>

                {/* Bars */}
                {scenarios.map((scenario, i) => {
                  const lowPct  = Math.min((scenario.premoney_low_usd  / maxVal) * 100, 100)
                  const highPct = Math.min((scenario.premoney_high_usd / maxVal) * 100, 100)
                  const midPct  = Math.min((scenario.premoney_mid_usd  / maxVal) * 100, 100)
                  const confTag = scenario.confidence === 'high' ? 'High confidence'
                                : scenario.confidence === 'medium' ? 'Medium confidence'
                                : 'Low confidence'

                  return (
                    <div key={i} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-text-secondary truncate">{scenario.label}</span>
                          <span className="text-[10px] text-text-disabled flex-shrink-0">· {confTag}</span>
                        </div>
                        <span className="text-xs font-semibold text-text-secondary flex-shrink-0 ml-2">
                          ${fmtM(scenario.premoney_low_usd)} – ${fmtM(scenario.premoney_high_usd)}
                        </span>
                      </div>
                      <div className="relative h-6 bg-surface-muted rounded-full overflow-hidden">
                        {/* Recommended zone overlay */}
                        {recPre && (
                          <div
                            className="absolute top-0 bottom-0 bg-green-100/70"
                            style={{ left: `${recLoPct}%`, width: `${Math.max(recHiPct - recLoPct, 0.5)}%` }}
                          />
                        )}
                        {/* Bar */}
                        <div
                          className="absolute top-1 bottom-1 rounded-full"
                          style={{
                            left: `${lowPct}%`,
                            width: `${Math.max(highPct - lowPct, 2)}%`,
                            background: SCENARIO_COLORS[i] || '#1a4d2e',
                            opacity: scenario.confidence === 'low' ? 0.55 : 1,
                          }}
                        />
                        {/* Mid marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white/90"
                          style={{ left: `${midPct}%` }}
                        />
                      </div>
                      <p className="text-xs text-text-tertiary mt-1">{scenario.notes}</p>
                    </div>
                  )
                })}

                {/* X-axis */}
                <div className="flex justify-between text-xs text-gray-300 mt-3">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const val = (maxVal / 5) * i
                    const label = val >= 1e6 ? `$${(val/1e6).toFixed(0)}M` : '$0'
                    return <span key={i}>{label}{i === 5 ? '+' : ''}</span>
                  })}
                </div>

                {scenarios.length === 0 && (
                  <p className="text-sm text-text-disabled text-center py-4">No valuation scenarios were generated for this submission.</p>
                )}

                {/* Recommended range highlight */}
                {recPre && (
                  <div className="mt-4 p-3 bg-success-bg border border-success-border rounded-lg">
                    <p className="text-xs font-semibold text-success-text mb-0.5">
                      Recommended <TermTooltip term="pre-money valuation">pre-money</TermTooltip>: ${fmtM(recPre.low)} – ${fmtM(recPre.high)}
                    </p>
                    <p className="text-xs text-success-text">{recPre.rationale}</p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Dilution table */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Dilution impact at ${fmtM(raiseTarget)} raise</h3>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="bg-surface-muted">
                  <th className="text-left p-3 text-xs font-medium text-text-tertiary"><TermTooltip term="Pre-money valuation">Pre-money valuation</TermTooltip></th>
                  <th className="text-center p-3 text-xs font-medium text-text-tertiary"><TermTooltip term="Post-money valuation">Post-money</TermTooltip></th>
                  <th className="text-center p-3 text-xs font-medium text-text-tertiary"><TermTooltip term="dilution">Dilution</TermTooltip></th>
                  <th className="text-right p-3 text-xs font-medium text-text-tertiary">Assessment</th>
                </tr>
              </thead>
            <tbody>
              {(() => {
                // Build a dilution table anchored to the recommended pre-money range.
                // 8 rows spanning roughly -40% to +50% of the recommended mid.
                const recMid = recPre ? (recPre.low + recPre.high) / 2 : raiseTarget * 3
                const recLow = recPre?.low ?? recMid * 0.7
                const recHigh = recPre?.high ?? recMid * 1.3
                const span = Math.max(recMid * 0.9, recHigh - recLow + recMid * 0.3)
                const start = Math.max(raiseTarget, recMid - span * 0.55)
                const step = span / 7
                const rows = Array.from({ length: 8 }, (_, i) => {
                  const preUsd = start + step * i
                  // Round to a clean number depending on scale
                  const round = preUsd >= 10e6 ? 1e6 : 0.5e6
                  return Math.round(preUsd / round) * round
                })
                // Dedupe and sort just in case rounding collapsed values
                const uniqueRows = Array.from(new Set(rows)).sort((a, b) => a - b)
                return uniqueRows.map((preUsd, i) => {
                  const postUsd = preUsd + raiseTarget
                  const dilPct  = (raiseTarget / postUsd) * 100
                  const isRec   = recPre && preUsd >= recPre.low && preUsd <= recPre.high
                  return (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-surface-muted'} ${isRec ? 'ring-1 ring-inset ring-green-300' : ''}`}>
                      <td className="p-3 text-xs font-medium text-text-primary">
                        ${fmtM(preUsd)} {isRec ? <span className="text-success-text">✓</span> : ''}
                      </td>
                      <td className="p-3 text-xs text-center text-text-tertiary">${fmtM(postUsd)}</td>
                      <td className="p-3 text-xs text-center">
                        <span className={`font-semibold ${dilPct <= 20 ? 'text-success-text' : dilPct <= 25 ? 'text-yellow-600' : 'text-danger-text'}`}>
                          {dilPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-xs text-right text-text-disabled">
                        {dilPct <= 20 ? 'Healthy' : dilPct <= 25 ? 'Acceptable' : dilPct <= 30 ? 'High' : 'Too high'}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
          </div>
        </div>
        <p className="text-xs text-text-disabled mt-2">Industry standard: 15-25% dilution per round is considered healthy. Above 30% makes future rounds difficult. Rows marked ✓ fall in your recommended pre-money range.</p>
      </div>

      {/* SEA vs Global vs US */}
      {seaComp && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Market comparison: SEA vs Global vs US</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <GeoCard label="SEA (applicable)" data={seaComp.sea} color="green" />
            <GeoCard label="Global benchmark" data={seaComp.global} color="blue" />
            <GeoCard label="US equivalent (reference)" data={seaComp.us_reference} color="gray" dimmed />
          </div>
        </div>
      )}

      {/* Investor appetite */}
      {a.investor_appetite && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-text-tertiary mb-1.5">Investor appetite (SEA, 2025)</p>
          <p className="text-sm text-text-secondary leading-relaxed">{a.investor_appetite}</p>
        </div>
      )}

      {/* Comparable deals */}
      {(a.comparable_deals || []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Comparable deals</h3>
          <div className="space-y-2">
            {a.comparable_deals.map((deal, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-center">
                <div className="flex-1 text-sm text-text-secondary">{deal.description}</div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-brand">${fmtM(deal.premoney_usd)} <TermTooltip term="pre-money valuation">pre-money</TermTooltip></p>
                  <p className="text-xs text-text-disabled">Raised ${fmtM(deal.raise_usd)} · {deal.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SCENARIO_COLORS = ['#1a4d2e', '#1E40AF', '#7C3AED', '#D97706', '#6B7280']

function MarketCard({ label, value, source, color }: { label: string; value: number | null; source: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-text-disabled mb-1.5">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>${fmtM(value)}</p>
      <p className="text-xs text-text-disabled mt-1.5 leading-relaxed">{source}</p>
    </div>
  )
}

function GeoCard({ label, data, color, dimmed }: {
  label: string
  data: { low: number; high: number; median: number; note: string }
  color: 'green' | 'blue' | 'gray'
  dimmed?: boolean
}) {
  const bgMap = { green: 'bg-success-bg border-success-border', blue: 'bg-blue-50 border-blue-200', gray: 'bg-surface-muted border-gray-200' }
  const textMap = { green: 'text-green-900', blue: 'text-blue-900', gray: 'text-text-secondary' }
  return (
    <div className={`rounded-xl border p-4 text-center ${bgMap[color]} ${dimmed ? 'opacity-60' : ''}`}>
      <p className={`text-xs font-medium mb-2 ${textMap[color]}`}>{label}</p>
      <p className={`text-lg font-semibold ${textMap[color]}`}>${fmtM(data.low)} – ${fmtM(data.high)}</p>
      <p className={`text-xs mt-1 ${textMap[color]} opacity-80`}>Median: ${fmtM(data.median)}</p>
      <p className={`text-xs mt-2 leading-relaxed ${textMap[color]} opacity-70`}>{data.note}</p>
    </div>
  )
}

// Tiny copy-to-clipboard button used by the drop-in market slide
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Fallback: prompt
          window.prompt('Copy this text:', text)
        }
      }}
      className="text-xs font-medium px-2.5 py-1 rounded-md border border-gray-300 text-text-secondary hover:border-brand hover:text-brand transition-colors whitespace-nowrap"
      title="Copy markdown version"
    >
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  )
}

function fmtM(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  return `${(n/1e3).toFixed(0)}K`
}

function fmtMarketSize(n: number): string {
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`
  return `$${(n/1e3).toFixed(0)}K`
}

// TAM ⊃ SAM ⊃ SOM concentric circles. No external labels — the label cards
// next to it carry the dollar amounts. Each ring gets its 3-letter level
// label inside it, positioned at top of the visible band.
function TamSamSomCircles({ tam, sam, som }: { tam: number; sam: number; som: number }) {
  // SVG: square 240×240, centered circle, clear bands
  const cx = 120
  const cy = 120
  const tamR = 110
  // Clamp ratios so each ring is always visually distinct
  const samRatio = tam > 0 ? Math.max(0.50, Math.min(0.82, Math.sqrt(sam / tam))) : 0.65
  const somRatio = sam > 0 ? Math.max(0.18, Math.min(0.55, Math.sqrt(som / sam) * samRatio)) : 0.25
  const samR = tamR * samRatio
  const somR = tamR * somRatio

  // Y-positions for the level letter inside each ring's visible band
  // TAM ring band: from cy-tamR to cy-samR — put label at midpoint of band
  const tamLabelY = cy - (tamR + samR) / 2 + 4
  // SAM ring band: from cy-samR to cy-somR
  const samLabelY = cy - (samR + somR) / 2 + 4
  // SOM: center of innermost circle
  const somLabelY = cy + 4

  return (
    <svg viewBox="0 0 240 240" width="240" height="240" xmlns="http://www.w3.org/2000/svg">
      {/* TAM — outer, light blue */}
      <circle cx={cx} cy={cy} r={tamR} fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
      {/* SAM — middle, green */}
      <circle cx={cx} cy={cy} r={samR} fill="#86efac" stroke="#15803d" strokeWidth="2" />
      {/* SOM — innermost, indigo */}
      <circle cx={cx} cy={cy} r={somR} fill="#a5b4fc" stroke="#1d4ed8" strokeWidth="2" />

      {/* Level letters inside each ring (top of band for TAM/SAM, center for SOM) */}
      <text x={cx} y={tamLabelY} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e3a8a">TAM</text>
      <text x={cx} y={samLabelY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#14532d">SAM</text>
      <text x={cx} y={somLabelY} textAnchor="middle" fontSize={somR < 28 ? 10 : 12} fontWeight="700" fill="#1e3a8a">SOM</text>
    </svg>
  )
}

// Companion label card placed next to the circles. Shows level + value + source.
function RingLabel({ level, tagline, value, source, accentBg, accentBorder, accentText, dotColor }: {
  level: string
  tagline: string
  value: number
  source: string
  accentBg: string
  accentBorder: string
  accentText: string
  dotColor: string
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border ${accentBorder} ${accentBg} p-3`}>
      <div className="flex-shrink-0 w-4 h-4 rounded-full mt-1" style={{ background: dotColor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${accentText}`}>
            <TermTooltip term={level}>{level}</TermTooltip>
          </span>
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">{tagline}</span>
        </div>
        <div className={`text-2xl font-bold ${accentText} leading-tight mt-0.5`}>{fmtMarketSize(value)}</div>
        {source && <div className="text-[11px] text-text-tertiary mt-1 leading-snug">{source}</div>}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
      <p className="text-text-disabled text-sm">Market analysis is processing…</p>
    </div>
  )
}
