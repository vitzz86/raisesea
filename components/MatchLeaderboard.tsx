'use client'
import { useState } from 'react'
import { MatchResult } from '@/lib/supabase'

type CoInvestorNetwork = {
  name: string
  investor_id: string | null
  investor_data: any | null
  via_investors: string[]
}

type Props = {
  matches: MatchResult[]
  warmIntros?: CoInvestorNetwork[]
  submission?: any
}

function formatMoney(n: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n/1_000_000 % 1 === 0 ? (n/1_000_000).toFixed(0) : (n/1_000_000).toFixed(1))}M`
  if (n >= 1_000)     return `$${(n/1_000 % 1 === 0     ? (n/1_000).toFixed(0)     : (n/1_000).toFixed(1))}K`
  return `$${n}`
}

function PieChart({ data, size = 110 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  let cum = 0
  const r  = size/2 - 8
  const cx = size/2, cy = size/2
  const slices = data.map(d => {
    const pct = d.value/total
    const s = cum; cum += pct
    const sa = s*2*Math.PI - Math.PI/2, ea = cum*2*Math.PI - Math.PI/2
    const x1 = cx+r*Math.cos(sa), y1 = cy+r*Math.sin(sa)
    const x2 = cx+r*Math.cos(ea), y2 = cy+r*Math.sin(ea)
    return { ...d, path:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${pct>.5?1:0},1 ${x2},${y2} Z`, pct }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity={0.9}><title>{s.label}: {Math.round(s.pct*100)}%</title></path>)}
    </svg>
  )
}

const COLORS = ['#1a7a3c','#2d9e54','#4dbf70','#80d49a','#d4a017','#f0b429','#fcd34d','#94a3b8','#cbd5e1']

function parsePctData(detail: string) {
  if (!detail) return []
  return detail.split(',').map((item,i) => {
    const m = item.trim().match(/^(.+?)\s*\((\d+)%\)/)
    if (!m) return null
    return { label: m[1].trim(), value: parseInt(m[2]), color: COLORS[i % COLORS.length] }
  }).filter(Boolean) as Array<{label:string;value:number;color:string}>
}

function InvestorPopup({ investor, onClose }: { investor: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-gray-900 text-base">{investor.name}</div>
              <div className="text-xs text-gray-400">{investor.type} · {investor.hq_city}, {investor.hq_country}
                {investor.hq_in_sea ? ' · 🌏 SEA HQ' : ''}</div>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(investor.invest_stages||[]).map((s:string) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-forest-50 text-forest-600">{s}</span>
            ))}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {investor.investment_thesis && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Investment thesis</p>
              <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-forest-300 pl-3 italic">"{investor.investment_thesis}"</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Ticket size', investor.ticket_min_usd && investor.ticket_max_usd ? `${formatMoney(investor.ticket_min_usd)} – ${formatMoney(investor.ticket_max_usd)}` : 'Varies'],
              ['Strategy', investor.investment_strategy || '—'],
            ].map(([l,v]) => (
              <div key={l} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                <div className="text-sm font-medium text-gray-800">{v}</div>
              </div>
            ))}
          </div>
          {investor.notable_portfolio && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notable portfolio</p>
              <div className="flex flex-wrap gap-1.5">
                {investor.notable_portfolio.split(',').slice(0,8).map((p:string) => (
                  <span key={p.trim()} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{p.trim()}</span>
                ))}
              </div>
            </div>
          )}
          {investor.value_add && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Value add</p>
              <div className="flex flex-wrap gap-1.5">
                {investor.value_add.split(',').map((v:string) => (
                  <span key={v.trim()} className="text-xs px-2.5 py-1 rounded-full bg-forest-50 text-forest-600">{v.trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
          {investor.website && (
            <a href={investor.website} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-medium bg-forest-500 text-white px-4 py-2.5 rounded-xl hover:bg-forest-600 transition-colors">
              Visit website →
            </a>
          )}
          {investor.linkedin && (
            <a href={investor.linkedin} target="_blank" rel="noopener noreferrer"
              className="text-sm border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">LinkedIn</a>
          )}
          <button onClick={onClose} className="text-sm border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function MatchLeaderboard({ matches, warmIntros = [], submission }: Props) {
  const [selected, setSelected]           = useState<MatchResult | null>(null)
  const [networkSelected, setNetworkSelected] = useState<any | null>(null)
  const [copied, setCopied]               = useState(false)
  const [networkPage, setNetworkPage]     = useState(0)

  const CARDS_PER_PAGE = 6
  const totalNetworkPages = Math.ceil(warmIntros.length / CARDS_PER_PAGE)
  const visibleNetwork = warmIntros.slice(networkPage * CARDS_PER_PAGE, (networkPage + 1) * CARDS_PER_PAGE)

  const top3 = matches.slice(0, 3)
  const rest  = matches.slice(3)
  const podiumOrder = [top3[1], top3[0], top3[2]]
  const origIdx     = [1, 0, 2]
  const medals      = ['🥇','🥈','🥉']

  // Parse current investors list from submission
  const currentInvestorsList = (submission?.current_investors || '')
    .split(',').map((s: string) => s.trim()).filter(Boolean)

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadPDF() {
    const slug = window.location.pathname.split('/').pop()
    window.open(`/api/export-pdf?slug=${slug}`, '_blank')
  }

  return (
    <>
      {/* AI Insights */}
      {(submission?.ai_description || submission?.ai_traction) && (
        <div className="mb-8 space-y-3">
          {submission.ai_description && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">About your company</p>
              <p className="text-sm text-gray-700 leading-relaxed">{submission.ai_description}</p>
            </div>
          )}
          {submission.ai_traction && (
            <div className="p-4 bg-forest-50 rounded-xl border border-forest-100">
              <p className="text-xs font-medium text-forest-600 uppercase tracking-wide mb-2">📈 Your traction</p>
              <p className="text-sm text-forest-800 leading-relaxed">{submission.ai_traction}</p>
            </div>
          )}
        </div>
      )}

      {/* Podium */}
      <div className="mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">🏆 Top 3 investor matches</p>

        {/* Score legend */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs text-gray-400">Match score:</span>
          {[
            { range: '80–100', label: 'Strong fit', color: 'bg-forest-100 text-forest-700' },
            { range: '60–79',  label: 'Good fit',   color: 'bg-blue-50 text-blue-600' },
            { range: '40–59',  label: 'Possible',   color: 'bg-amber-50 text-amber-600' },
          ].map(s => (
            <span key={s.range} className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.color}`}>
              {s.range} · {s.label}
            </span>
          ))}
          <span className="text-xs text-gray-400 ml-1">→ Pitch investors scoring 70+</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {podiumOrder.map((m, i) => {
            if (!m) return <div key={i} className="hidden sm:block" />
            const oi = origIdx[i]
            const borderClass = oi===0 ? 'border-2 border-amber-400 shadow-lg shadow-amber-100' : 'border border-gray-200'
            const headerBg    = oi===0 ? 'bg-gradient-to-b from-amber-50 to-amber-100' : oi===1 ? 'bg-gray-50' : 'bg-orange-50'
            const scoreColor  = oi===0 ? 'text-amber-600' : oi===1 ? 'text-gray-500' : 'text-amber-700'
            // Podium stagger only on desktop — mobile stacks cleanly without offsets
            const podiumStagger = oi===0 ? '' : oi===1 ? 'sm:mt-3' : 'sm:mt-5'
            return (
              <div key={m.investor_id} onClick={() => setSelected(m)}
                className={`${borderClass} ${podiumStagger} rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-200 hover:shadow-md`}>
                <div className={`${headerBg} px-3 py-5 text-center`}>
                  <div className="text-2xl mb-1">{medals[oi]}</div>
                  <div className={`font-serif text-3xl font-semibold ${scoreColor}`}>{m.score}</div>
                  <div className="text-xs text-gray-400 mt-0.5">/ 100</div>
                  <div className={`text-xs mt-1 font-medium ${m.score >= 80 ? 'text-forest-600' : m.score >= 60 ? 'text-blue-500' : 'text-amber-500'}`}>
                    {m.score >= 80 ? 'Strong fit' : m.score >= 60 ? 'Good fit' : 'Possible'}
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <div className="font-semibold text-sm text-gray-900 mb-0.5 leading-tight">{m.investor?.name}</div>
                  <div className="text-xs text-gray-400 mb-2">{m.investor?.type} · {m.investor?.investment_strategy}</div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(m.investor?.invest_stages||[]).slice(0,2).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-forest-50 text-forest-600">{s}</span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 border-l-2 border-forest-400 leading-relaxed">{m.reason}</div>
                  <p className="text-xs text-forest-500 text-center mt-2 font-medium">tap for full profile →</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ranks 4-10 */}
      {rest.length > 0 && (
        <div className="border border-gray-100 rounded-2xl overflow-hidden mt-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">More matches</p>
          </div>
          {rest.map((m, i) => (
            <div key={m.investor_id} onClick={() => setSelected(m)}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
              <span className="text-xs font-mono text-gray-300 w-5 text-center">{i+4}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{m.investor?.name}</div>
                <div className="text-xs text-gray-400">{m.investor?.type} · {m.investor?.hq_city} · {(m.investor?.invest_stages||[]).join(', ')}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="hidden sm:block w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-forest-400 rounded-full" style={{ width:`${m.score}%` }} />
                </div>
                <span className="text-sm font-semibold text-forest-600 bg-forest-50 px-2.5 py-1 rounded-full">{m.score}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Co-investor Network Section */}
      {warmIntros.length > 0 && (
        <div className="mt-10">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-semibold text-gray-900 mb-1">Networks within your current investors</h3>
            {currentInvestorsList.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">via</span>
                {currentInvestorsList.map((name: string) => (
                  <span key={name} className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">{name}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">{warmIntros.length} co-investors found in their networks · hover to see details</p>
          </div>

          {/* Cards grid — 2 rows of 3 on desktop, stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleNetwork.map((item, i) => (
              <div key={i}
                onClick={() => item.investor_data && setNetworkSelected(item.investor_data)}
                className={`bg-white border border-gray-100 rounded-xl p-3 transition-all duration-150
                  ${item.investor_data ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-forest-200' : 'opacity-70'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 leading-tight truncate">{item.name}</div>
                    {item.investor_data?.type && (
                      <div className="text-xs text-gray-400 mt-0.5">{item.investor_data.type}</div>
                    )}
                  </div>
                  {item.investor_data && (
                    <span className="text-xs text-forest-500 flex-shrink-0 ml-1">→</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(item.investor_data?.invest_stages||[]).slice(0,2).map((s:string) => (
                    <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-forest-50 text-forest-600">{s}</span>
                  ))}
                </div>
                <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                  via {(item.via_investors || []).join(', ')}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalNetworkPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setNetworkPage(p => Math.max(0, p-1))}
                disabled={networkPage === 0}
                className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                ← Previous
              </button>
              <span className="text-xs text-gray-400">
                {networkPage + 1} / {totalNetworkPages} · {warmIntros.length} co-investors
              </span>
              <button
                onClick={() => setNetworkPage(p => Math.min(totalNetworkPages-1, p+1))}
                disabled={networkPage === totalNetworkPages - 1}
                className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions — below network section */}
      <div className="flex gap-3 mt-6">
        <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          {copied ? '✅ Copied!' : '🔗 Copy share link'}
        </button>
        <button onClick={downloadPDF} className="flex-1 flex items-center justify-center gap-2 py-3 bg-forest-500 text-white rounded-xl text-sm font-medium hover:bg-forest-600 transition-colors">
          📄 Download PDF report
        </button>
      </div>

      {/* Main investor popup */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-serif font-semibold text-forest-500">{selected.score}</div>
                  <div>
                    <div className="font-semibold text-gray-900">{selected.investor?.name}</div>
                    <div className="text-xs text-gray-400">{selected.investor?.type} · {selected.investor?.hq_city}
                      {selected.investor?.hq_in_sea ? ' · 🌏 SEA HQ' : ''}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                  ${selected.investor?.active_confidence==='High' ? 'bg-green-100 text-green-700' :
                    selected.investor?.active_confidence==='Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                  {selected.investor?.active_confidence==='High'?'🟢':selected.investor?.active_confidence==='Medium'?'🟡':'⚪'} {selected.investor?.active_confidence} confidence
                </span>
                {(selected.investor?.invest_stages||[]).map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-forest-50 text-forest-600">{s}</span>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Score breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {label:'Active',   val:selected.score_breakdown?.active,   max:20, tip:'Is this fund actively deploying capital in 2024-2025? Based on recent deals and confidence signals.'},
                    {label:'Sector',   val:selected.score_breakdown?.sector,   max:22, tip:'How much of their portfolio is in your sector? Based on actual portfolio distribution data.'},
                    {label:'Stage',    val:selected.score_breakdown?.stage,    max:20, tip:'Do they invest at your funding stage? Exact match scores highest, adjacent stage scores partial.'},
                    {label:'Ticket',   val:selected.score_breakdown?.ticket,   max:18, tip:'Does your raise size fit their typical ticket range? Scored based on lead ticket (50% of raise) vs their min/max.'},
                    {label:'Thesis',   val:selected.score_breakdown?.thesis,   max:12, tip:'How well does their stated investment thesis align with your sector, market, and business model?'},
                    {label:'Location', val:selected.score_breakdown?.location, max:8,  tip:'How focused are they on your country? SEA-headquartered funds with strong local presence score highest.'},
                  ].map(b => (
                    <div key={b.label} className="bg-gray-50 rounded-xl p-2.5 text-center relative group cursor-help">
                      <div className="text-xs text-gray-400 mb-1">{b.label}</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {b.val||0}<span className="text-gray-300 text-xs font-normal">/{b.max}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-forest-400 rounded-full" style={{width:`${((b.val||0)/b.max)*100}%`}} />
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-gray-900 text-white text-xs rounded-lg
                        opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 leading-relaxed text-left shadow-xl">
                        <div className="font-medium text-white mb-1">{b.label} <span className="text-gray-400 font-normal">({b.max} pts)</span></div>
                        {b.tip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.investor?.investment_thesis && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Investment thesis</p>
                  <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-forest-300 pl-3 italic">
                    "{selected.investor.investment_thesis}"
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Key details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'Ticket size',
                      val: selected.investor?.ticket_min_usd && selected.investor?.ticket_max_usd
                        ? `${formatMoney(selected.investor.ticket_min_usd)} – ${formatMoney(selected.investor.ticket_max_usd)}` : 'Varies',
                      tip: 'The amount they typically invest per company. Aim for a raise where their max ticket covers at least 30% of what you need.',
                    },
                    {
                      label: 'Strategy',
                      val: selected.investor?.investment_strategy || '—',
                      tip: {
                        'Lead': 'They lead the round — setting terms, valuation, and taking a board seat. Great for founders who need a strong anchor investor.',
                        'Co-lead': 'They co-lead with another investor. Both negotiate terms together. Good for splitting dilution.',
                        'Follow': 'They follow other investors — they won\'t lead or set terms. You need to find a lead first, then invite them.',
                        'Agnostic': 'Flexible — they can lead or follow depending on the deal. Usually a good sign of flexibility.',
                      }[selected.investor?.investment_strategy || ''] || 'Their preferred role in a funding round — lead, co-lead, or follow.',
                    },
                    {
                      label: 'Min traction',
                      val: selected.investor?.min_traction_stage || '—',
                      tip: 'The minimum business progress they expect before investing. Pre-revenue = idea/prototype ok. Revenue = you need paying customers.',
                    },
                    {
                      label: 'Follow-on',
                      val: selected.investor?.follow_on_investment || '—',
                      tip: 'Whether they invest again in your later rounds. "Yes" means they may double down as you grow — good for long-term partnership.',
                    },
                    {
                      label: 'Instruments',
                      val: selected.investor?.investment_instrument || '—',
                      tip: 'How they structure the investment. Equity = direct ownership. SAFE/Convertible Note = debt that converts to equity later (common at pre-seed).',
                    },
                    {
                      label: 'Ownership target',
                      val: selected.investor?.ownership_preference || '—',
                      tip: 'The % of your company they typically aim to own after investing. Higher ownership = more dilution for you. Typical range: 5–20%.',
                    },
                  ].map(({label, val, tip}) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 relative group">
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="text-xs text-gray-400">{label}</div>
                        <span className="text-xs text-gray-300 cursor-help">ⓘ</span>
                        <div className="absolute bottom-full left-0 mb-2 w-56 p-2.5 bg-gray-900 text-white text-xs rounded-lg
                          opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 leading-relaxed shadow-xl">
                          {tip}
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-800">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Beginner tips for pre-seed/seed founders */}
              {(submission?.stage === 'Pre-seed' || submission?.stage === 'Seed') && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💡</span>
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Tips for approaching {selected.investor?.name}</p>
                  </div>
                  <div className="space-y-2">
                    {selected.investor?.investment_strategy === 'Lead' && (
                      <div className="flex gap-2 text-xs text-amber-700">
                        <span className="flex-shrink-0">→</span>
                        <span>They lead rounds — come prepared with a clear valuation expectation and term sheet comfort.</span>
                      </div>
                    )}
                    {selected.investor?.investment_strategy === 'Follow' && (
                      <div className="flex gap-2 text-xs text-amber-700">
                        <span className="flex-shrink-0">→</span>
                        <span>They don't lead — secure a lead investor first, then invite {selected.investor?.name} to fill the round.</span>
                      </div>
                    )}
                    {selected.investor?.min_traction_stage === 'Pre-revenue' || !selected.investor?.min_traction_stage ? (
                      <div className="flex gap-2 text-xs text-amber-700">
                        <span className="flex-shrink-0">→</span>
                        <span>They're open to pre-revenue startups. Focus your pitch on team strength, market size, and early signals.</span>
                      </div>
                    ) : (
                      <div className="flex gap-2 text-xs text-amber-700">
                        <span className="flex-shrink-0">→</span>
                        <span>They require {selected.investor?.min_traction_stage} traction. Highlight your revenue numbers or customer proof upfront.</span>
                      </div>
                    )}
                    {selected.investor?.co_investors && (
                      <div className="flex gap-2 text-xs text-amber-700">
                        <span className="flex-shrink-0">→</span>
                        <span>They often co-invest with {selected.investor.co_investors.split(',').slice(0,2).map((c:string) => c.trim()).join(' and ')}. A warm intro from these VCs boosts your odds significantly.</span>
                      </div>
                    )}
                    <div className="flex gap-2 text-xs text-amber-700">
                      <span className="flex-shrink-0">→</span>
                      <span>Research their portfolio — mention 1–2 companies they backed that are similar to yours to show thesis alignment.</span>
                    </div>
                  </div>
                </div>
              )}

              {(selected.investor?.top_sectors_detail || selected.investor?.invest_locations_detail) && (
                <div className="grid grid-cols-2 gap-4">
                  {selected.investor?.top_sectors_detail && (() => {
                    const data = parsePctData(selected.investor.top_sectors_detail)
                    return data.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Portfolio by sector</p>
                        <div className="flex flex-col items-center gap-3">
                          <PieChart data={data} size={110} />
                          <div className="space-y-1 w-full">
                            {data.slice(0,4).map(d => (
                              <div key={d.label} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:d.color}} />
                                <span className="text-xs text-gray-600 flex-1 truncate">{d.label}</span>
                                <span className="text-xs font-medium text-gray-800">{d.value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null
                  })()}
                  {selected.investor?.invest_locations_detail && (() => {
                    const data     = parsePctData(selected.investor.invest_locations_detail)
                    const isGlobal = !selected.investor.hq_in_sea
                    return data.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-1 mb-3">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Portfolio geography</p>
                          {isGlobal && (
                            <div className="group relative">
                              <span className="text-xs text-gray-300 cursor-help">ⓘ</span>
                              <div className="absolute bottom-5 right-0 w-52 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 leading-relaxed">
                                Based on available SEA portfolio data. Global/regional fund — total portfolio extends beyond SEA.
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-3">
                          <PieChart data={data} size={110} />
                          <div className="space-y-1 w-full">
                            {data.slice(0,4).map(d => (
                              <div key={d.label} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:d.color}} />
                                <span className="text-xs text-gray-600 flex-1 truncate">{d.label}</span>
                                <span className="text-xs font-medium text-gray-800">{d.value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null
                  })()}
                </div>
              )}

              {selected.investor?.notable_portfolio && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notable portfolio</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.investor.notable_portfolio.split(',').slice(0,10).map((p:string) => (
                      <span key={p.trim()} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{p.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.investor?.co_investors && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Frequent co-investors</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{selected.investor.co_investors}</p>
                </div>
              )}

              {selected.investor?.value_add && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Value add</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.investor.value_add.split(',').map((v:string) => (
                      <span key={v.trim()} className="text-xs px-2.5 py-1 rounded-full bg-forest-50 text-forest-600">{v.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              {selected.investor?.website && (
                <a href={selected.investor.website} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center text-sm font-medium bg-forest-500 text-white px-4 py-2.5 rounded-xl hover:bg-forest-600 transition-colors">
                  Visit website →
                </a>
              )}
              {selected.investor?.linkedin && (
                <a href={selected.investor.linkedin} target="_blank" rel="noopener noreferrer"
                  className="text-sm border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">LinkedIn</a>
              )}
              <button onClick={() => setSelected(null)} className="text-sm border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Network investor popup */}
      {networkSelected && <InvestorPopup investor={networkSelected} onClose={() => setNetworkSelected(null)} />}
    </>
  )
}
