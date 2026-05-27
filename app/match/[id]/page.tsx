// app/match/[id]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import OverviewTab     from '@/components/results/OverviewTab'
import DeckScoreTab    from '@/components/results/DeckScoreTab'
import MarketTab       from '@/components/results/MarketTab'
import CompetitorsTab  from '@/components/results/CompetitorsTab'
import InvestorsTab    from '@/components/results/InvestorsTab'
import MeetTab         from '@/components/results/MeetTab'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: '◈' },
  { id: 'deck',         label: 'Deck score',   icon: '◎' },
  { id: 'market',       label: 'Market',       icon: '◉' },
  { id: 'competitors',  label: 'Competitors',  icon: '◐' },
  { id: 'investors',    label: 'Investors',    icon: '◑' },
  { id: 'meet',         label: 'Meet',         icon: '◒' },
] as const

type TabId = typeof TABS[number]['id']

export default function MatchPage() {
  const params    = useParams()
  const slug      = params?.id as string
  const [sub, setSub]         = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [shareStatus, setShareStatus] = useState<'' | 'copied' | 'shared'>('')

  useEffect(() => {
    if (!slug) return
    fetchSubmission()
  }, [slug])

  async function fetchSubmission() {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('unique_slug', slug)
        .single()

      if (error) throw error
      if (!data)  throw new Error('Submission not found')

      // Parse JSON columns
      const parsed = {
        ...data,
        match_results:        safeJSON(data.match_results),
        warm_intros:          safeJSON(data.warm_intros),
        deck_analysis:        safeJSON(data.deck_analysis),
        market_analysis:      safeJSON(data.market_analysis),
        competitive_analysis: safeJSON(data.competitive_analysis),
        sector_profile:       safeJSON(data.sector_profile),
      }
      setSub(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingScreen />
  if (error || !sub) return <ErrorScreen error={error} />

  const matchResults       = (sub.match_results as Record<string, unknown>[]) || []
  const deckAnalysis       = sub.deck_analysis  as Record<string, unknown> | null
  const marketAnalysis     = sub.market_analysis as Record<string, unknown> | null
  const competitiveAnalysis = sub.competitive_analysis as Record<string, unknown> | null
  const warmIntros          = (sub.warm_intros as Array<{ investor: string; via?: string; via_investors?: string[]; matched_in_db?: boolean }>) || []

  // Download PDF — open the server-side print route in a new tab. It auto-fires window.print()
  // with the company name as the document title, so "Save as PDF" picks up the right filename.
  function handleDownloadPdf() {
    window.open(`/api/export-pdf?slug=${params.id}`, '_blank')
  }

  // Share — try native Web Share, fall back to clipboard copy
  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = `RaiseSEA match — ${sub.company_name as string}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        setShareStatus('shared')
        setTimeout(() => setShareStatus(''), 2500)
        return
      } catch { /* user cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('copied')
      setTimeout(() => setShareStatus(''), 2500)
    } catch {
      // Last resort: prompt
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1a4d2e] text-white">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <a href="/" className="text-green-200 text-sm hover:text-white transition-colors">
                  ← RaiseSEA
                </a>
              </div>
              <h1 className="text-xl font-semibold">{sub.company_name as string}</h1>
              <p className="text-green-200 text-sm mt-0.5">
                {sub.stage as string} &nbsp;·&nbsp; Raising ${((sub.raise_target_usd as number) / 1e6).toFixed(1)}M
                &nbsp;·&nbsp; {sub.country as string}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <button
                onClick={handleShare}
                className="text-xs font-medium px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 transition-colors whitespace-nowrap"
                title="Share this match report"
              >
                {shareStatus === 'copied' ? '✓ Link copied' : shareStatus === 'shared' ? '✓ Shared' : '↗ Share'}
              </button>
              <button
                onClick={handleDownloadPdf}
                className="text-xs font-medium px-3 py-2 rounded-md bg-white text-[#1a4d2e] hover:bg-green-50 transition-colors whitespace-nowrap"
                title="Download formatted PDF report"
              >
                ↓ Download PDF
              </button>
              {deckAnalysis && (
                <div className="text-right">
                  <div className="text-3xl font-semibold">
                    {(deckAnalysis.overall_score as number) ?? '—'}<span className="text-green-300 text-lg">/100</span>
                  </div>
                  <div className={`text-sm font-medium mt-0.5 ${
                    (deckAnalysis.overall_score as number) >= 80 ? 'text-green-300' :
                    (deckAnalysis.overall_score as number) >= 60 ? 'text-yellow-300' :
                    'text-orange-300'
                  }`}>
                    {deckAnalysis.investor_readiness as string}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-all ${
                  activeTab === tab.id
                    ? 'bg-gray-50 text-[#1a4d2e]'
                    : 'text-green-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
                {tab.id === 'investors' && matchResults.length > 0 && (
                  <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {matchResults.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            submission={sub}
            deckAnalysis={deckAnalysis}
            marketAnalysis={marketAnalysis}
            competitiveAnalysis={competitiveAnalysis}
            matchResults={matchResults}
            onTabChange={setActiveTab}
          />
        )}
        {activeTab === 'deck' && <DeckScoreTab analysis={deckAnalysis} />}
        {activeTab === 'market' && (
          <MarketTab
            analysis={marketAnalysis}
            raiseTarget={sub.raise_target_usd as number}
            sectorProfile={sub.sector_profile as Record<string, unknown>}
            deckAnalysis={deckAnalysis}
          />
        )}
        {activeTab === 'competitors' && <CompetitorsTab analysis={competitiveAnalysis} />}
        {activeTab === 'investors' && (
          <InvestorsTab
            matchResults={matchResults}
            warmIntros={warmIntros}
            submission={sub}
          />
        )}
        {activeTab === 'meet' && (
          <MeetTab
            matchResults={matchResults}
            submission={sub}
          />
        )}
      </div>
    </div>
  )
}

function safeJSON(val: unknown): unknown {
  if (!val) return null
  if (typeof val === 'object') return val
  try { return JSON.parse(val as string) } catch { return null }
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#1a4d2e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Generating your investor intelligence report…</p>
        <p className="text-gray-400 text-xs mt-1">AI analysis takes 30-60 seconds</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error }: { error: string | null }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <p className="text-red-500 font-medium mb-2">Unable to load results</p>
        <p className="text-gray-400 text-sm">{error || 'Please check the URL and try again'}</p>
        <a href="/" className="mt-4 inline-block text-[#1a4d2e] text-sm underline">← Back to home</a>
      </div>
    </div>
  )
}
