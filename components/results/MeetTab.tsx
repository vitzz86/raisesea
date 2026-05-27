// components/results/MeetTab.tsx
// Phase 4 placeholder — shows post-match meeting suggestions
// Full /meet page built in Phase 4

interface Match {
  score: number
  investor: { id: string; name: string; hq_city: string; hq_country: string; type: string }
}

interface Props {
  matchResults: Record<string, unknown>[]
  submission:   Record<string, unknown>
}

export default function MeetTab({ matchResults, submission }: Props) {
  const matches = matchResults as unknown as Match[]
  const top5    = matches.slice(0, 5)

  return (
    <div className="space-y-6">

      {/* Coming soon callout */}
      <div className="bg-[#1a4d2e] text-white rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Meeting Scheduler</h2>
        <p className="text-green-200 text-sm mb-4">
          Request 30-minute meetings with investors, industry experts, tech experts, and advisors — 
          directly from your match results. Launching soon.
        </p>
        <a
          href="/meet"
          className="inline-block bg-white text-[#1a4d2e] font-semibold text-sm px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
        >
          Browse available experts →
        </a>
      </div>

      {/* Post-match suggestions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Your top matches — check if they have open slots</h3>
        <div className="space-y-2">
          {top5.map((match, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{match.investor.name}</span>
                  <span className="text-xs font-semibold text-[#1a4d2e] bg-green-50 px-2 py-0.5 rounded-full">
                    {match.score} match
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {match.investor.type} · {match.investor.hq_city}, {match.investor.hq_country}
                </p>
              </div>
              <a
                href={`/meet?search=${encodeURIComponent(match.investor.name)}`}
                className="text-xs text-[#1a4d2e] border border-[#1a4d2e] px-3 py-1.5 rounded-lg hover:bg-[#1a4d2e] hover:text-white transition-colors"
              >
                Check availability →
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Profile types preview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Who you can meet on RaiseSEA</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: 'Investors',          desc: 'VCs, Angels, CVCs with open slots in SEA', icon: '◈' },
            { type: 'Industry experts',   desc: 'O&G, Fintech, Healthcare domain veterans',  icon: '◉' },
            { type: 'Tech experts',       desc: 'AI/ML, infrastructure, security specialists', icon: '◎' },
            { type: 'Startup advisors',   desc: 'Former founders, operators, growth experts', icon: '◐' },
            { type: 'Mentors',            desc: '1-on-1 guidance from experienced builders',  icon: '◑' },
            { type: 'Corporate innovation', desc: 'Potential pilot customers and enterprise partners', icon: '◒' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xl mb-2 text-[#1a4d2e]">{item.icon}</div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{item.type}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
