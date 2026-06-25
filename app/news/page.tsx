import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import { NewsSignupPrompt } from '@/components/landing/NewsSignupPrompt'
import NewsFeed from './NewsFeed'
import { legacyTopStories, type StoryItem, type CategorizedTopStories } from '@/lib/news-clustering'

export const dynamic = 'force-dynamic'

type NewsProfile = {
  full_name: string | null
  company_name: string | null
  news_sectors: string[] | null
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sectors?: string }>
}) {
  const user = await getSessionUser()
  let profile: NewsProfile | null = null
  let admin = false
  let isExpert = false

  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, company_name, news_sectors')
      .eq('id', user.id)
      .maybeSingle()
    profile = data as NewsProfile | null
    admin = await isSuperAdmin(user)
    isExpert = await isApprovedExpert(user.id)
  }

  // Load approved items from last 7 days (this week's feed)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('id, category, title, company_name, amount_usd, stage, sector, country, lead_investor, source_url, source_name, ai_summary, ai_why_it_matters, published_at, region_scope')
    .eq('status', 'approved')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })
    .limit(300)

  // Editor's take (most recent approved) — structured, with categorized top stories
  const { data: takes } = await supabaseAdmin
    .from('editors_takes')
    .select('content, headline, body, takeaway, top_stories, approved_at')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(1)
  const t = takes?.[0]
  let editorsTake: { headline: string | null; body: string | null; takeaway: string | null } | null = null
  if (t) {
    let body = t.body || null
    // Fallback for OLD takes (pre-body-column): content holds headline+body+takeaway
    // concatenated. Derive a clean body by removing the headline + takeaway.
    if (!body && t.content) {
      body = t.content
      if (t.headline && body.startsWith(t.headline)) body = body.slice(t.headline.length).trim()
      if (t.takeaway && body.endsWith(t.takeaway)) body = body.slice(0, body.length - t.takeaway.length).trim()
      // also strip a leading duplicate headline that may remain after a blank line
      if (t.headline && body.startsWith(t.headline)) body = body.slice(t.headline.length).trim()
    }
    editorsTake = { headline: t.headline || null, body: body || null, takeaway: t.takeaway || null }
  }

  // Categorized AI top stories ride on the approved take. If present, they win;
  // otherwise we fall back to the live heuristic top-5 (legacyTopStories) below.
  const categorizedTopStories = (t?.top_stories as CategorizedTopStories | null | undefined) || null

  // Compute trending stats (last 7 days)
  const recentItems = (items || [])
  const trending = computeTrending(recentItems)

  // "This week at a glance" summaries
  const glance = computeGlance(recentItems)

  // Live heuristic fallback (mixed top-5) — used only when the approved take
  // has no AI top stories yet.
  const hasCategorized = !!categorizedTopStories && Object.values(categorizedTopStories).some(Boolean)
  const topStories = hasCategorized ? [] : legacyTopStories((items || []) as StoryItem[])

  // Compute the date range for the header
  const rangeStart = new Date(Date.now() - 7 * 86400 * 1000)
  const rangeEnd = new Date()
  const fmtRange = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRange = `${fmtRange(rangeStart)} – ${fmtRange(rangeEnd)}, ${rangeEnd.getFullYear()}`

  const feed = (
    <NewsFeed
      items={items || []}
      userSectors={profile?.news_sectors || []}
      editorsTake={editorsTake}
      trending={trending}
      topStories={topStories}
      categorizedTopStories={hasCategorized ? categorizedTopStories : null}
      glance={glance}
      dateRange={dateRange}
      weekStats={{
        dealCount:    recentItems.filter(i => i.category === 'fundraising').length,
        totalRaised:  recentItems.reduce((sum, i) => sum + (i.amount_usd || 0), 0),
        sectorCount:  new Set(recentItems.map(i => i.sector).filter(Boolean)).size,
      }}
      publicMode={!user}
      className={user ? 'max-w-5xl' : 'max-w-5xl mx-auto'}
      loginHref="/login?redirectTo=/news"
    />
  )

  if (!user) {
    return (
      <main className="min-h-screen bg-surface-page text-text-primary">
        <NewsSignupPrompt
          signedIn={false}
          trigger="immediate"
          storageKey="raisesea_public_news_prompt_seen"
          eyebrow="Weekly digest"
          title="Try the full RaiseSEA experience."
          body="Sign in with Google to receive weekly SEA fundraising news, plus deck analysis, mock pitch practice, investor matching, and CRM."
          ctaLabel="Sign in with Google"
          href="/login?redirectTo=/news"
        />
        <nav className="sticky top-0 z-40 bg-surface-page/85 backdrop-blur border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold text-brand tracking-tight">RaiseSEA</Link>
            <div className="flex items-center gap-5">
              <Link href="/#features" className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">Features</Link>
              <Link href="/#why-sea" className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">Why SEA</Link>
              <Link href="/login?redirectTo=/news" className="text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-3.5 py-1.5 transition-colors">Sign in</Link>
            </div>
          </div>
        </nav>
        <section className="px-6 py-8 md:py-10">
          {feed}
        </section>
      </main>
    )
  }

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="news">
      {feed}
    </DashboardShell>
  )
}

// ─── "This week at a glance" summaries ─────────────────────────────
type GlanceItem = {
  category: string; sector: string | null; country: string | null
  region_scope?: string | null; amount_usd: number | null
}
function computeGlance(items: GlanceItem[]) {
  const total = items.length
  const sea = items.filter(i => (i.region_scope || 'sea') === 'sea').length
  const global = items.filter(i => i.region_scope === 'global').length

  const tally = (key: (i: GlanceItem) => string | null) => {
    const m: Record<string, number> = {}
    for (const i of items) { const k = key(i); if (k) m[k] = (m[k] || 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const byCountry  = tally(i => i.country)
  const bySector   = tally(i => i.sector)
  const byCategory = tally(i => i.category)

  const catLabel: Record<string, string> = { fundraising: 'fundraising', tech: 'tech', policy: 'policy/economic', exit: 'exits' }
  const topN = (arr: [string, number][], n: number) => arr.slice(0, n).map(([k, c]) => `${k} (${c})`).join(', ')

  return {
    region:   total > 0 ? `${total} stories this week — ${sea} from Southeast Asia${global > 0 ? `, ${global} notable global signal${global > 1 ? 's' : ''}` : ''}.` : 'No stories yet this week.',
    country:  byCountry.length  > 0 ? `Most active markets: ${topN(byCountry, 3)}.` : '',
    category: byCategory.length > 0 ? `By type: ${byCategory.map(([k, c]) => `${catLabel[k] || k} (${c})`).join(', ')}.` : '',
    industry: bySector.length   > 0 ? `Hottest sectors: ${topN(bySector, 3)}.` : '',
  }
}

function computeTrending(items: { sector: string | null; lead_investor: string | null }[]) {
  const sectorCounts: Record<string, number> = {}
  const investorCounts: Record<string, number> = {}
  for (const it of items) {
    if (it.sector) sectorCounts[it.sector] = (sectorCounts[it.sector] || 0) + 1
    if (it.lead_investor) investorCounts[it.lead_investor] = (investorCounts[it.lead_investor] || 0) + 1
  }
  const topSectors   = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topInvestors = Object.entries(investorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return {
    sectors:   topSectors.map(([name, count]) => ({ name, count })),
    investors: topInvestors.map(([name, count]) => ({ name, count })),
  }
}
