// app/match/[id]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Target, Users } from 'lucide-react'
import { NextActionsBlock, Card } from '@/components/ui'
import { deckAnalysisNextActions } from '@/lib/next-actions'
import OverviewTab     from '@/components/results/OverviewTab'
import DeckScoreTab    from '@/components/results/DeckScoreTab'
import MarketTab       from '@/components/results/MarketTab'
import CompetitorsTab  from '@/components/results/CompetitorsTab'
import InvestorsTab    from '@/components/results/InvestorsTab'

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
] as const

type TabId = typeof TABS[number]['id']

type MatchViewProps = {
  isOwner: boolean   // true if the signed-in user owns this submission
  canUseExpertFeatures: boolean
}

export default function MatchView({ isOwner, canUseExpertFeatures }: MatchViewProps) {
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
    const title = `RaiseSEA match — ${String(sub?.company_name || 'analysis')}`
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          {/* Mobile layout: stacked vertical. Desktop: side-by-side. */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-0">

            {/* LEFT — title + meta + (score on mobile only) */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isOwner ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-200/30 text-green-100 text-[11px] font-medium border border-green-200/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
                    This is your analysis
                  </span>
                ) : (
                  <span className="text-green-200 text-xs">Shared analysis</span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-semibold truncate">{sub.company_name as string}</h1>
              <p className="text-green-200 text-xs sm:text-sm mt-0.5">
                {sub.stage as string} &nbsp;·&nbsp; Raising ${((sub.raise_target_usd as number) / 1e6).toFixed(1)}M
                &nbsp;·&nbsp; {sub.country as string}
              </p>

              {/* Score appears BELOW meta on mobile (where user wanted it). Hidden on desktop. */}
              {deckAnalysis && (
                <div className="md:hidden mt-3 flex items-baseline gap-2.5">
                  <div className="text-2xl font-semibold">
                    {(deckAnalysis.overall_score as number) ?? '—'}<span className="text-green-300 text-base">/100</span>
                  </div>
                  <div className={`text-xs font-medium ${
                    (deckAnalysis.overall_score as number) >= 80 ? 'text-green-300' :
                    (deckAnalysis.overall_score as number) >= 60 ? 'text-yellow-300' :
                    'text-orange-300'
                  }`}>
                    {deckAnalysis.investor_readiness as string}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — buttons + score (score hidden on mobile since shown above) */}
            <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
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
              {/* Desktop-only score on the right (mobile shows it below meta above) */}
              {deckAnalysis && (
                <div className="hidden md:block text-right ml-1">
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

        {/* Tab navigation — horizontal scroll on mobile with fade-edge hint */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 text-sm font-medium rounded-t-md transition-all whitespace-nowrap flex-shrink-0 ${
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
          {/* Right-edge fade — subtle hint that tabs scroll horizontally on narrow screens.
              Pointer-events-none lets clicks pass through to tabs. */}
          <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-[#1a4d2e] to-transparent pointer-events-none sm:hidden" />
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
      </div>

      {/* What's next — journey-ending CTAs. Renders below all tabs
          (regardless of which tab is active) so it always feels like
          the closing section of the deck analysis. */}
      <NextActionsForDeckAnalysis deckAnalysis={deckAnalysis} canUseExpertFeatures={canUseExpertFeatures} />
    </div>
  )
}

// ─── What's next: journey-closing CTAs for deck analysis ────────────
function NextActionsForDeckAnalysis({
  deckAnalysis,
  canUseExpertFeatures,
}: {
  deckAnalysis: Record<string, unknown> | null
  canUseExpertFeatures: boolean
}) {
  if (!deckAnalysis) return null
  const score = typeof deckAnalysis.overall_score === 'number' ? deckAnalysis.overall_score : null
  const actions = deckAnalysisNextActions({
    deckAnalysis,
    practiceIcon: <Target className="w-5 h-5" strokeWidth={1.5} />,
    expertIcon:   <Users className="w-4 h-4" strokeWidth={1.5} />,
    includeExpertAction: canUseExpertFeatures,
  })
  if (actions.length === 0) return null

  return (
    <div className="mt-6">
      <Card>
        <NextActionsBlock
          title="What's next"
          subtitle={
            score != null
              ? `Based on your deck score of ${score}/100.`
              : 'Practice your delivery before any investor sees the deck.'
          }
          actions={actions}
        />
      </Card>
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
