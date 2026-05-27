// components/results/CompetitorsTab.tsx
'use client'
import type { CompetitiveAnalysis } from '@/lib/gemini'

interface Props { analysis: Record<string, unknown> | null }

// Slugify a competitor name → DOM id for scroll-to
function competitorId(name: string): string {
  return 'competitor-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function scrollToCompetitor(name: string) {
  const id = competitorId(name)
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // brief highlight pulse
    el.classList.add('ring-2', 'ring-[#1a4d2e]', 'ring-offset-2')
    setTimeout(() => el.classList.remove('ring-2', 'ring-[#1a4d2e]', 'ring-offset-2'), 1800)
  }
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1).trim() + '…' : s
}

export default function CompetitorsTab({ analysis }: Props) {
  if (!analysis) return <EmptyState />
  const a = analysis as unknown as CompetitiveAnalysis
  const moat = a.moat_scores || ({} as CompetitiveAnalysis['moat_scores'])

  return (
    <div className="space-y-6">

      {/* Moat scores */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Moat score</h3>
          {typeof moat.overall === 'number' && (
            <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${moatBadge(moat.overall)}`}>
              {moat.overall}/10 — {moat.overall >= 7 ? 'Strong' : moat.overall >= 5 ? 'Moderate' : 'Vulnerable'}
            </span>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {Object.entries(moat)
              .filter(([k]) => !['overall','actions'].includes(k))
              .map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g,' ')}</span>
                    <span className="text-xs font-semibold" style={{ color: moatColor(val as number) }}>{val}/10</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${(val as number) * 10}%`, background: moatColor(val as number) }}
                    />
                  </div>
                </div>
              ))
            }
          </div>
          {(moat.actions?.length ?? 0) > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Actions to improve moat</p>
              <ol className="space-y-1.5">
                {moat.actions!.map((action, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-[#1a4d2e] font-bold flex-shrink-0">{i+1}.</span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* 2x2 positioning */}
      {a.positioning && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Competitive positioning</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {/* Full-width chart with proper padding for axis labels */}
            <div className="relative w-full pt-7 pb-7 px-12">
              <div className="relative w-full h-80 bg-white rounded-lg border border-gray-200">
                {/* Y axis labels */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-700 font-medium whitespace-nowrap max-w-full px-2">
                  <span className="font-mono text-[10px] text-gray-400 mr-1">Y+</span>
                  ↑ {truncate(a.positioning.y_axis_label, 50)}
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 font-medium whitespace-nowrap max-w-full px-2">
                  <span className="font-mono text-[10px] text-gray-400 mr-1">Y−</span>
                  ↓ {truncate(a.positioning.y_axis_label_low || `Less ${a.positioning.y_axis_label}`, 50)}
                </div>
                {/* X axis labels — placed OUTSIDE chart in left/right padding (no rotation = readable) */}
                <div className="absolute top-1/2 -translate-y-1/2 -left-12 w-11 text-right text-xs text-gray-500 font-medium leading-tight">
                  <div className="font-mono text-[10px] text-gray-400">X−</div>
                  <div>{truncate(a.positioning.x_axis_label_low || `Less ${a.positioning.x_axis_label}`, 22)} ←</div>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 -right-12 w-11 text-left text-xs text-gray-700 font-medium leading-tight">
                  <div className="font-mono text-[10px] text-gray-400">X+</div>
                  <div>→ {truncate(a.positioning.x_axis_label, 22)}</div>
                </div>

                {/* Crosshairs + plot area */}
                <div className="absolute inset-4">
                  <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gray-300" />
                  <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-gray-300" />
                  {(a.positioning.positions || []).slice(0, 9).map((pos, i) => {
                    const competitors = (a.positioning?.positions || []).filter(p => !p.is_founder)
                    const competitorIdx = competitors.findIndex(c => c.name === pos.name)
                    const number = competitorIdx + 1
                    return (
                      <div
                        key={i}
                        className="absolute -translate-x-1/2 translate-y-1/2 flex flex-col items-center"
                        style={{ left: `${Math.min(95, Math.max(5, pos.x))}%`, bottom: `${Math.min(95, Math.max(5, pos.y))}%` }}
                      >
                        {pos.is_founder ? (
                          <>
                            <div className="w-4 h-4 rounded-full bg-[#1a4d2e] border-2 border-white shadow-md ring-2 ring-[#1a4d2e]/30" />
                            <span className="text-[11px] mt-1 px-1.5 py-0.5 rounded font-semibold bg-[#1a4d2e] text-white whitespace-nowrap">{pos.name}</span>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => scrollToCompetitor(pos.name)}
                            title={`Jump to ${pos.name}`}
                            className="w-6 h-6 rounded-full bg-white border-2 border-gray-400 hover:border-[#1a4d2e] hover:text-[#1a4d2e] flex items-center justify-center text-[10px] font-semibold text-gray-600 transition-colors cursor-pointer"
                          >
                            {number}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Legend — BELOW chart, full-width grid, no overlap */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-2">Legend <span className="font-normal text-gray-400">(click any to view details below)</span></p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#1a4d2e] border-2 border-white ring-2 ring-[#1a4d2e]/30 flex-shrink-0" />
                  <span className="text-[#1a4d2e] font-medium">You</span>
                </div>
                {(a.positioning.positions || []).filter(p => !p.is_founder).slice(0, 8).map((pos, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => scrollToCompetitor(pos.name)}
                    className="flex items-center gap-2 text-left hover:text-[#1a4d2e] transition-colors min-w-0"
                  >
                    <div className="w-5 h-5 rounded-full bg-white border-2 border-gray-400 flex items-center justify-center text-[9px] font-semibold text-gray-600 flex-shrink-0">{i + 1}</div>
                    <span className="text-gray-700 truncate">{pos.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEA competitors */}
      {a.sea_competitors?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            SEA direct competitors ({a.sea_competitors.length})
          </h3>
          <div className="space-y-3">
            {a.sea_competitors.map((comp, i) => (
              <CompetitorCard key={i} competitor={comp} />
            ))}
          </div>
        </div>
      )}

      {/* Global benchmarks */}
      {a.global_benchmarks?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Global benchmarks — what this space can become
          </h3>
          <div className="space-y-3">
            {a.global_benchmarks.map((comp, i) => (
              <CompetitorCard key={i} competitor={comp} isGlobal />
            ))}
          </div>
        </div>
      )}

      {/* Key differentiators */}
      {a.key_differentiators?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-green-800 mb-2">Your key differentiators — state these explicitly in your pitch</p>
          <ol className="space-y-1.5">
            {a.key_differentiators.map((d, i) => (
              <li key={i} className="text-sm text-green-800 flex gap-2">
                <span className="font-bold">{i+1}.</span> {d}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* White space */}
      {a.white_space && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">White space opportunity</p>
          <p className="text-sm text-gray-700 leading-relaxed">{a.white_space}</p>
        </div>
      )}

      {/* Conflict warning */}
      {a.conflict_warning && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">Investor conflict of interest</p>
          <p className="text-sm text-amber-800">{a.conflict_warning}</p>
        </div>
      )}
    </div>
  )
}

function CompetitorCard({ competitor: c, isGlobal }: { competitor: ReturnType<typeof useCompetitor>; isGlobal?: boolean }) {
  // Reject placeholder URLs (e.g. literal "https://...", "https://example.com") that Gemini
  // sometimes emits when it can't find the real one. Better to show no link than a broken one.
  const isRealUrl = (u: string | undefined | null): boolean => {
    if (!u) return false
    if (!/^https?:\/\//.test(u)) return false
    if (u.includes('...')) return false
    if (/example\.com|placeholder|todo|tbd/i.test(u)) return false
    if (u.length < 12) return false  // 'https://a.co' is the realistic minimum
    return true
  }
  const hasWebsite  = isRealUrl(c.website)
  const hasLinkedin = isRealUrl(c.linkedin)
  return (
    <div id={competitorId(c.name)} className="bg-white border border-gray-200 rounded-xl p-4 scroll-mt-24 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{c.name}</span>
            {isGlobal && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Global benchmark</span>
            )}
            {(hasWebsite || hasLinkedin) && (
              <span className="flex items-center gap-1.5">
                {hasWebsite && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-gray-500 hover:text-[#1a4d2e] underline-offset-2 hover:underline">
                    ↗ Website
                  </a>
                )}
                {hasLinkedin && (
                  <a href={c.linkedin} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-gray-500 hover:text-[#0a66c2] underline-offset-2 hover:underline">
                    ↗ LinkedIn
                  </a>
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{c.hq} · {c.stage} · {c.founded_year ? `Founded ${c.founded_year}` : ''}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-[#1a4d2e]">
            {c.total_raised_usd ? `$${fmtM(c.total_raised_usd)} raised` : 'Undisclosed'}
          </p>
          <p className="text-xs text-gray-400">{c.similarity_pct}% overlap</p>
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-3">{c.one_liner}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-lg p-2.5">
          <p className="text-xs font-medium text-green-700 mb-0.5">Their strength</p>
          <p className="text-xs text-green-800">{c.key_strength}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2.5">
          <p className="text-xs font-medium text-red-700 mb-0.5">Their weakness (your opportunity)</p>
          <p className="text-xs text-red-800">{c.key_weakness}</p>
        </div>
      </div>
      {c.investors?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.investors.slice(0,4).map((inv: string, i: number) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{inv}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// Type helper
function useCompetitor(c: unknown) { return c as {
  name: string; hq: string; stage: string; founded_year: number | null;
  total_raised_usd: number | null; similarity_pct: number; one_liner: string;
  key_strength: string; key_weakness: string; investors: string[];
  website: string; linkedin: string
}}

const moatColor  = (s: number) => s >= 7 ? '#16a34a' : s >= 5 ? '#d97706' : '#dc2626'
const moatBadge  = (s: number) => s >= 7 ? 'bg-green-50 text-green-700' : s >= 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
const fmtM       = (n: number | null) => !n ? '—' : n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : `${(n/1e3).toFixed(0)}K`

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
      <p className="text-gray-600 text-sm font-medium mb-2">Competitive analysis not available</p>
      <p className="text-gray-400 text-xs leading-relaxed max-w-md mx-auto">
        Either your submission is still processing (refresh in a minute) or the Gemini search backend returned errors on all 5 retries. If this persists across multiple submissions, the API quota or the search grounding tier may be the issue — check the server logs.
      </p>
    </div>
  )
}
