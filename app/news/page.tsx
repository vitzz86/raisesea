import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import NewsFeed from './NewsFeed'

export const dynamic = 'force-dynamic'

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sectors?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/news')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name, news_sectors')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  // Load approved items from last 7 days (this week's feed)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('id, category, title, company_name, amount_usd, stage, sector, country, lead_investor, source_url, source_name, ai_summary, ai_why_it_matters, published_at, region_scope')
    .eq('status', 'approved')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })
    .limit(300)

  // Editor's take (most recent approved) — structured
  const { data: takes } = await supabaseAdmin
    .from('editors_takes')
    .select('content, headline, body, takeaway, approved_at')
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

  // Compute trending stats (last 7 days)
  const recentItems = (items || [])
  const trending = computeTrending(recentItems)

  // "This week at a glance" summaries
  const glance = computeGlance(recentItems)

  // Group similar stories (same news, different sources) + find the most-covered
  const { topStories } = clusterStories(items || [])

  // Compute the date range for the header
  const rangeStart = new Date(Date.now() - 7 * 86400 * 1000)
  const rangeEnd = new Date()
  const fmtRange = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRange = `${fmtRange(rangeStart)} – ${fmtRange(rangeEnd)}, ${rangeEnd.getFullYear()}`

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="news">
      <NewsFeed
        items={items || []}
        userSectors={profile?.news_sectors || []}
        editorsTake={editorsTake}
        trending={trending}
        topStories={topStories}
        glance={glance}
        dateRange={dateRange}
        weekStats={{
          dealCount:    recentItems.filter(i => i.category === 'fundraising').length,
          totalRaised:  recentItems.reduce((sum, i) => sum + (i.amount_usd || 0), 0),
          sectorCount:  new Set(recentItems.map(i => i.sector).filter(Boolean)).size,
        }}
      />
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

// ─── Story clustering via fuzzy title similarity ───────────────────
// Groups items reporting the SAME story from different sources, then ranks
// by coverage (more sources = more important) for a "Top stories" list.

function tokenize(s: string): Set<string> {
  const stop = new Set(['the','a','an','to','of','in','on','for','and','or','with','at','by','from','as','is','its','it','this','that','raises','raise','startup','million','funding'])
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const w of a) if (b.has(w)) inter++
  return inter / (a.size + b.size - inter)
}

type StoryItem = {
  id: string; title: string; company_name: string | null; amount_usd: number | null
  stage: string | null; sector: string | null; country: string | null
  source_url: string; source_name: string | null; published_at: string | null
  category: string; region_scope?: string | null
}

function clusterStories(items: StoryItem[]) {
  const clusters: { items: StoryItem[]; tokens: Set<string> }[] = []
  for (const item of items) {
    const tokens = tokenize(item.company_name ? `${item.company_name} ${item.title}` : item.title)
    // Match against existing cluster if title similarity OR same company name
    let placed = false
    for (const c of clusters) {
      const sim = jaccard(tokens, c.tokens)
      const sameCompany = item.company_name && c.items.some(ci => ci.company_name && ci.company_name.toLowerCase() === item.company_name!.toLowerCase())
      if (sim >= 0.45 || sameCompany) {
        c.items.push(item)
        for (const t of tokens) c.tokens.add(t)
        placed = true
        break
      }
    }
    if (!placed) clusters.push({ items: [item], tokens })
  }

  // Top stories: rank by (source count desc, then amount desc, then recency)
  const ranked = clusters
    .map(c => {
      const sorted = [...c.items].sort((a, b) => (b.amount_usd || 0) - (a.amount_usd || 0))
      const primary = sorted[0]
      const sources = c.items
        .map(i => ({ name: i.source_name || 'source', url: i.source_url }))
        .filter((s, idx, arr) => arr.findIndex(x => x.url === s.url) === idx)  // dedupe by url
      return { primary, sources, coverage: sources.length }
    })
    .sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage
      if ((b.primary.amount_usd || 0) !== (a.primary.amount_usd || 0)) return (b.primary.amount_usd || 0) - (a.primary.amount_usd || 0)
      return (b.primary.published_at || '').localeCompare(a.primary.published_at || '')
    })

  // Top 5 stories that have meaningful signal (multi-source OR a notable raise)
  const topStories = ranked
    .filter(s => s.coverage >= 2 || (s.primary.amount_usd || 0) >= 5_000_000)
    .slice(0, 5)
    .map(s => ({
      id: s.primary.id,
      headline: s.primary.company_name
        ? `${s.primary.company_name}${s.primary.amount_usd ? ' raised $' + (s.primary.amount_usd / 1e6).toFixed(1) + 'M' : ''}`
        : s.primary.title,
      sector: s.primary.sector,
      country: s.primary.country,
      coverage: s.coverage,
      sources: s.sources,
    }))

  return { topStories }
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
