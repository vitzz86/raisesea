import { supabaseAdmin } from '@/lib/supabase'
import { legacyTopStories, type CategorizedTopStories, type StoryItem } from '@/lib/news-clustering'

export type PublicNewsItem = {
  id: string
  category: string
  title: string
  company_name: string | null
  amount_usd: number | null
  stage: string | null
  sector: string | null
  country: string | null
  lead_investor: string | null
  source_url: string
  source_name: string | null
  ai_summary: string | null
  ai_why_it_matters: string | null
  published_at: string | null
  region_scope?: string | null
}

export type PublicEditorsTake = {
  headline: string | null
  body: string | null
  takeaway: string | null
  approved_at: string | null
}

export type PublicNewsDigest = {
  generatedAt: string
  dateRange: string
  weekStartIso: string
  weekEndIso: string
  items: PublicNewsItem[]
  editorsTake: PublicEditorsTake | null
  categorizedTopStories: CategorizedTopStories | null
  topStories: ReturnType<typeof legacyTopStories>
  glance: ReturnType<typeof computeGlance>
  trending: ReturnType<typeof computeTrending>
  weekStats: {
    dealCount: number
    totalRaised: number
    sectorCount: number
  }
}

export const NEWS_MARKDOWN_PATH = '/news/latest.md'
export const NEWS_JSON_PATH = '/news.json'
export const NEWS_RSS_PATH = '/news/rss.xml'

const NEWS_SELECT = [
  'id',
  'category',
  'title',
  'company_name',
  'amount_usd',
  'stage',
  'sector',
  'country',
  'lead_investor',
  'source_url',
  'source_name',
  'ai_summary',
  'ai_why_it_matters',
  'published_at',
  'region_scope',
].join(', ')

export function getPublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.raisesea.com').replace(/\/$/, '')
}

export async function getCurrentPublicNewsDigest(now = new Date()): Promise<PublicNewsDigest> {
  const weekStart = new Date(now.getTime() - 7 * 86400 * 1000)
  const weekStartIso = weekStart.toISOString()
  const weekEndIso = now.toISOString()

  const [{ data: items }, { data: takes }] = await Promise.all([
    supabaseAdmin
      .from('news_items')
      .select(NEWS_SELECT)
      .eq('status', 'approved')
      .gte('published_at', weekStartIso)
      .order('published_at', { ascending: false })
      .limit(300),
    supabaseAdmin
      .from('editors_takes')
      .select('content, headline, body, takeaway, top_stories, approved_at')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1),
  ])

  const newsItems = (items || []) as unknown as PublicNewsItem[]
  const takeRow = takes?.[0]
  const editorsTake = normalizeEditorsTake(takeRow)
  const categorizedTopStories = (takeRow?.top_stories as CategorizedTopStories | null | undefined) || null
  const hasCategorized = !!categorizedTopStories && Object.values(categorizedTopStories).some(Boolean)

  return {
    generatedAt: now.toISOString(),
    dateRange: formatDateRange(weekStart, now),
    weekStartIso,
    weekEndIso,
    items: newsItems,
    editorsTake,
    categorizedTopStories: hasCategorized ? categorizedTopStories : null,
    topStories: hasCategorized ? [] : legacyTopStories(newsItems as StoryItem[]),
    glance: computeGlance(newsItems),
    trending: computeTrending(newsItems),
    weekStats: {
      dealCount: newsItems.filter(i => i.category === 'fundraising').length,
      totalRaised: newsItems.reduce((sum, i) => sum + (i.amount_usd || 0), 0),
      sectorCount: new Set(newsItems.map(i => i.sector).filter(Boolean)).size,
    },
  }
}

export function normalizeEditorsTake(takeRow: {
  content?: string | null
  headline?: string | null
  body?: string | null
  takeaway?: string | null
  approved_at?: string | null
} | null | undefined): PublicEditorsTake | null {
  if (!takeRow) return null

  let body = takeRow.body || null
  if (!body && takeRow.content) {
    body = takeRow.content
    if (takeRow.headline && body.startsWith(takeRow.headline)) body = body.slice(takeRow.headline.length).trim()
    if (takeRow.takeaway && body.endsWith(takeRow.takeaway)) body = body.slice(0, body.length - takeRow.takeaway.length).trim()
    if (takeRow.headline && body.startsWith(takeRow.headline)) body = body.slice(takeRow.headline.length).trim()
  }

  if (!takeRow.headline && !body && !takeRow.takeaway) return null

  return {
    headline: takeRow.headline || null,
    body: body || null,
    takeaway: takeRow.takeaway || null,
    approved_at: takeRow.approved_at || null,
  }
}

export function newsItemHeadline(item: PublicNewsItem): string {
  if (!item.company_name) return item.title
  const amount = item.amount_usd ? ` raised ${formatUSD(item.amount_usd)}` : ''
  const stage = item.stage ? ` - ${item.stage}` : ''
  return `${item.company_name}${amount}${stage}`
}

export function newsItemBody(item: PublicNewsItem): string {
  return [item.ai_summary, item.ai_why_it_matters ? `Why it matters: ${item.ai_why_it_matters}` : null]
    .filter(Boolean)
    .join('\n\n')
}

export function formatUSD(n: number): string {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

export function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`
}

export function computeGlance(items: Array<{
  category: string
  sector: string | null
  country: string | null
  region_scope?: string | null
  amount_usd: number | null
}>) {
  const total = items.length
  const sea = items.filter(i => (i.region_scope || 'sea') === 'sea').length
  const global = items.filter(i => i.region_scope === 'global').length

  const tally = (key: (i: typeof items[number]) => string | null) => {
    const m: Record<string, number> = {}
    for (const i of items) {
      const k = key(i)
      if (k) m[k] = (m[k] || 0) + 1
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }

  const byCountry = tally(i => i.country)
  const bySector = tally(i => i.sector)
  const byCategory = tally(i => i.category)
  const catLabel: Record<string, string> = { fundraising: 'fundraising', tech: 'tech', policy: 'policy/economic', exit: 'exits' }
  const topN = (arr: [string, number][], n: number) => arr.slice(0, n).map(([k, c]) => `${k} (${c})`).join(', ')

  return {
    region: total > 0 ? `${total} stories this week - ${sea} from Southeast Asia${global > 0 ? `, ${global} notable global signal${global > 1 ? 's' : ''}` : ''}.` : 'No stories yet this week.',
    country: byCountry.length > 0 ? `Most active markets: ${topN(byCountry, 3)}.` : '',
    category: byCategory.length > 0 ? `By type: ${byCategory.map(([k, c]) => `${catLabel[k] || k} (${c})`).join(', ')}.` : '',
    industry: bySector.length > 0 ? `Hottest sectors: ${topN(bySector, 3)}.` : '',
  }
}

export function computeTrending(items: Array<{ sector: string | null; lead_investor: string | null }>) {
  const sectorCounts: Record<string, number> = {}
  const investorCounts: Record<string, number> = {}

  for (const item of items) {
    if (item.sector) sectorCounts[item.sector] = (sectorCounts[item.sector] || 0) + 1
    if (item.lead_investor) investorCounts[item.lead_investor] = (investorCounts[item.lead_investor] || 0) + 1
  }

  return {
    sectors: Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    investors: Object.entries(investorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
  }
}

export function buildNewsMarkdown(digest: PublicNewsDigest, baseUrl = getPublicBaseUrl()): string {
  const lines: string[] = [
    '# RaiseSEA Weekly SEA Fundraising Digest',
    '',
    `> ${digest.dateRange}. Full approved weekly digest for AI crawlers, search engines, and readers.`,
    '',
    `Canonical HTML: ${baseUrl}/news`,
    `Structured JSON: ${baseUrl}${NEWS_JSON_PATH}`,
    `RSS: ${baseUrl}${NEWS_RSS_PATH}`,
    `Generated: ${digest.generatedAt}`,
    '',
  ]

  if (digest.editorsTake) {
    lines.push('## Editor\'s Take', '')
    if (digest.editorsTake.headline) lines.push(`### ${escapeMarkdown(digest.editorsTake.headline)}`, '')
    if (digest.editorsTake.body) lines.push(escapeMarkdown(digest.editorsTake.body), '')
    if (digest.editorsTake.takeaway) lines.push(`Action signal: ${escapeMarkdown(digest.editorsTake.takeaway)}`, '')
  }

  lines.push('## This Week At A Glance', '')
  for (const value of Object.values(digest.glance)) {
    if (value) lines.push(`- ${escapeMarkdown(value)}`)
  }
  lines.push('')

  if (digest.categorizedTopStories) {
    lines.push('## Top Stories This Week', '')
    for (const [category, story] of Object.entries(digest.categorizedTopStories)) {
      if (!story) continue
      lines.push(`### ${escapeMarkdown(category)}`)
      lines.push(`- Headline: ${escapeMarkdown(story.headline)}`)
      if (story.why) lines.push(`- Why it matters: ${escapeMarkdown(story.why)}`)
      if (story.sector) lines.push(`- Sector: ${escapeMarkdown(story.sector)}`)
      if (story.country) lines.push(`- Country: ${escapeMarkdown(story.country)}`)
      if (story.sources?.length) {
        lines.push(`- Sources: ${story.sources.map(src => `[${escapeMarkdown(src.name)}](${src.url})`).join(', ')}`)
      }
      lines.push('')
    }
  }

  lines.push(`## All Approved Stories (${digest.items.length})`, '')
  const byCategory = groupByCategory(digest.items)
  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length === 0) continue
    lines.push(`### ${categoryLabel(category)} (${items.length})`, '')
    for (const item of items) {
      lines.push(`#### ${escapeMarkdown(newsItemHeadline(item))}`)
      if (item.published_at) lines.push(`- Published: ${item.published_at}`)
      lines.push(`- Category: ${escapeMarkdown(categoryLabel(item.category))}`)
      if (item.region_scope) lines.push(`- Region scope: ${escapeMarkdown(item.region_scope)}`)
      if (item.country) lines.push(`- Country: ${escapeMarkdown(item.country)}`)
      if (item.sector) lines.push(`- Sector: ${escapeMarkdown(item.sector)}`)
      if (item.stage) lines.push(`- Stage: ${escapeMarkdown(item.stage)}`)
      if (item.amount_usd) lines.push(`- Amount: ${formatUSD(item.amount_usd)}`)
      if (item.lead_investor) lines.push(`- Lead investor: ${escapeMarkdown(item.lead_investor)}`)
      if (item.ai_summary) lines.push('', escapeMarkdown(item.ai_summary))
      if (item.ai_why_it_matters) lines.push('', `Why it matters: ${escapeMarkdown(item.ai_why_it_matters)}`)
      lines.push('', `Source: [${escapeMarkdown(item.source_name || 'Source')}](${item.source_url})`, '')
    }
  }

  return `${lines.join('\n').trim()}\n`
}

export function buildNewsJsonLd(digest: PublicNewsDigest, baseUrl = getPublicBaseUrl()) {
  const pageUrl = `${baseUrl}/news`
  const markdownUrl = `${baseUrl}${NEWS_MARKDOWN_PATH}`
  const jsonUrl = `${baseUrl}${NEWS_JSON_PATH}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        name: 'RaiseSEA',
        url: baseUrl,
      },
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#collection`,
        url: pageUrl,
        name: 'Weekly SEA Fundraising Digest',
        description: 'Full approved RaiseSEA weekly digest covering Southeast Asia startup fundraising, technology, policy, exits, and investor signals.',
        dateModified: digest.generatedAt,
        isPartOf: { '@id': `${baseUrl}/#website` },
        mainEntity: { '@id': `${pageUrl}#item-list` },
        sameAs: [markdownUrl, jsonUrl],
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#item-list`,
        name: `RaiseSEA weekly news items - ${digest.dateRange}`,
        numberOfItems: digest.items.length,
        itemListElement: digest.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${pageUrl}#news-${item.id}`,
          item: { '@id': `${pageUrl}#news-${item.id}` },
        })),
      },
      ...digest.items.map(item => ({
        '@type': 'NewsArticle',
        '@id': `${pageUrl}#news-${item.id}`,
        url: `${pageUrl}#news-${item.id}`,
        headline: newsItemHeadline(item),
        description: item.ai_summary || item.ai_why_it_matters || item.title,
        articleBody: newsItemBody(item) || item.title,
        datePublished: item.published_at || digest.generatedAt,
        dateModified: digest.generatedAt,
        author: { '@type': 'Organization', name: 'RaiseSEA' },
        publisher: { '@type': 'Organization', name: 'RaiseSEA', url: baseUrl },
        isPartOf: { '@id': `${pageUrl}#collection` },
        citation: item.source_url,
        isBasedOn: item.source_url,
        about: [item.category, item.region_scope, item.country, item.sector, item.stage, item.lead_investor].filter(Boolean),
      })),
    ],
  }
}

export function buildNewsJsonPayload(digest: PublicNewsDigest, baseUrl = getPublicBaseUrl()) {
  return {
    site: 'RaiseSEA',
    canonical_url: `${baseUrl}/news`,
    markdown_url: `${baseUrl}${NEWS_MARKDOWN_PATH}`,
    rss_url: `${baseUrl}${NEWS_RSS_PATH}`,
    generated_at: digest.generatedAt,
    date_range: digest.dateRange,
    week_start: digest.weekStartIso,
    week_end: digest.weekEndIso,
    editors_take: digest.editorsTake,
    top_stories: digest.categorizedTopStories || digest.topStories,
    glance: digest.glance,
    trending: digest.trending,
    stats: digest.weekStats,
    items: digest.items.map(item => ({
      id: item.id,
      anchor_url: `${baseUrl}/news#news-${item.id}`,
      headline: newsItemHeadline(item),
      category: item.category,
      region_scope: item.region_scope || 'sea',
      country: item.country,
      sector: item.sector,
      stage: item.stage,
      amount_usd: item.amount_usd,
      lead_investor: item.lead_investor,
      summary: item.ai_summary,
      why_it_matters: item.ai_why_it_matters,
      published_at: item.published_at,
      source_name: item.source_name,
      source_url: item.source_url,
    })),
  }
}

export function buildNewsRssXml(digest: PublicNewsDigest, baseUrl = getPublicBaseUrl()): string {
  const pageUrl = `${baseUrl}/news`
  const items = digest.items.map(item => {
    const title = newsItemHeadline(item)
    const body = [
      item.ai_summary,
      item.ai_why_it_matters ? `Why it matters: ${item.ai_why_it_matters}` : null,
      `Source: ${item.source_name || item.source_url}`,
    ].filter(Boolean).join('\n\n')

    return [
      '<item>',
      `<title>${escapeXml(title)}</title>`,
      `<link>${escapeXml(`${pageUrl}#news-${item.id}`)}</link>`,
      `<guid isPermaLink="false">${escapeXml(`raisesea-news-${item.id}`)}</guid>`,
      item.published_at ? `<pubDate>${new Date(item.published_at).toUTCString()}</pubDate>` : '',
      `<description><![CDATA[${body}]]></description>`,
      `<source url="${escapeXml(item.source_url)}">${escapeXml(item.source_name || 'Source')}</source>`,
      '</item>',
    ].filter(Boolean).join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>RaiseSEA Weekly SEA Fundraising Digest</title>
<link>${escapeXml(pageUrl)}</link>
<description>Full approved RaiseSEA weekly digest for Southeast Asia startup fundraising, technology, policy, exits, and investor signals.</description>
<language>en</language>
<lastBuildDate>${new Date(digest.generatedAt).toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>
`
}

export function groupByCategory(items: PublicNewsItem[]): Record<string, PublicNewsItem[]> {
  const out: Record<string, PublicNewsItem[]> = { fundraising: [], tech: [], policy: [], exit: [] }
  for (const item of items) {
    if (!out[item.category]) out[item.category] = []
    out[item.category].push(item)
  }
  return out
}

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    fundraising: 'Fundraising',
    tech: 'Tech and product',
    policy: 'Economic and policy',
    exit: 'Exit market',
  }
  return labels[category] || category
}

export function escapeMarkdown(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

export function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
