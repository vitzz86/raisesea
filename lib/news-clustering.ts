// ═══════════════════════════════════════════════════════════════
// lib/news-clustering.ts
// Shared story-clustering used by BOTH the /news page (live fallback)
// and the news pipeline (AI Top Stories generation).
//
// Groups items reporting the SAME story across different outlets, so
// "covered by N sources" is a real, objective importance signal — not
// something the AI invents. The AI layer (generateTopStories) then picks
// + writes the winner per category from these clustered candidates.
// ═══════════════════════════════════════════════════════════════

export type StoryItem = {
  id: string
  title: string
  company_name: string | null
  amount_usd: number | null
  stage: string | null
  sector: string | null
  country: string | null
  source_url: string
  source_name: string | null
  published_at: string | null
  category: string
  region_scope?: string | null
  ai_summary?: string | null
}

export type StorySource = { name: string; url: string }

export type StoryCluster = {
  primary:  StoryItem      // representative item (largest raise, else first)
  items:    StoryItem[]
  sources:  StorySource[]  // de-duped by url
  coverage: number         // distinct source count
}

// The 4 buckets surfaced as Top Stories.
export const TOP_STORY_CATEGORIES = ['fundraising', 'tech', 'policy', 'exit'] as const
export type TopStoryCategory = typeof TOP_STORY_CATEGORIES[number]

// One AI-selected top story (with real source coverage attached).
export type TopStory = {
  id:         string
  headline:   string
  why:        string
  sector:     string | null
  country:    string | null
  coverage:   number
  sources:    StorySource[]
  source_url: string
}

export type CategorizedTopStories = Record<TopStoryCategory, TopStory | null>

function tokenize(s: string): Set<string> {
  const stop = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'with', 'at', 'by', 'from', 'as', 'is', 'its', 'it', 'this', 'that', 'raises', 'raise', 'startup', 'million', 'funding'])
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const w of a) if (b.has(w)) inter++
  return inter / (a.size + b.size - inter)
}

/**
 * Cluster items into stories, ranked by coverage (desc) → amount (desc) → recency.
 * Two items merge if their title/company tokens are similar enough OR they share
 * the same company name.
 */
export function clusterStories(items: StoryItem[]): StoryCluster[] {
  const clusters: { items: StoryItem[]; tokens: Set<string> }[] = []
  for (const item of items) {
    const tokens = tokenize(item.company_name ? `${item.company_name} ${item.title}` : item.title)
    let placed = false
    for (const c of clusters) {
      const sim = jaccard(tokens, c.tokens)
      const sameCompany = !!item.company_name && c.items.some(ci => ci.company_name && ci.company_name.toLowerCase() === item.company_name!.toLowerCase())
      if (sim >= 0.45 || sameCompany) {
        c.items.push(item)
        for (const t of tokens) c.tokens.add(t)
        placed = true
        break
      }
    }
    if (!placed) clusters.push({ items: [item], tokens })
  }

  return clusters
    .map(c => {
      const sorted = [...c.items].sort((a, b) => (b.amount_usd || 0) - (a.amount_usd || 0))
      const primary = sorted[0]
      const sources = c.items
        .map(i => ({ name: i.source_name || 'source', url: i.source_url }))
        .filter((s, idx, arr) => arr.findIndex(x => x.url === s.url) === idx)
      return { primary, items: c.items, sources, coverage: sources.length }
    })
    .sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage
      if ((b.primary.amount_usd || 0) !== (a.primary.amount_usd || 0)) return (b.primary.amount_usd || 0) - (a.primary.amount_usd || 0)
      return (b.primary.published_at || '').localeCompare(a.primary.published_at || '')
    })
}

/**
 * Group ranked clusters by their primary item's category, capped at
 * `perCategory` candidates each. This is the candidate set the AI picks from.
 */
export function clustersByCategory(
  clusters: StoryCluster[],
  perCategory = 6,
): Record<TopStoryCategory, StoryCluster[]> {
  const out: Record<TopStoryCategory, StoryCluster[]> = { fundraising: [], tech: [], policy: [], exit: [] }
  for (const c of clusters) {
    const cat = c.primary.category as TopStoryCategory
    if (out[cat] && out[cat].length < perCategory) out[cat].push(c)
  }
  return out
}

/**
 * LEGACY fallback: the old mixed top-5 list (no AI, no categories).
 * Used on /news only when no approved AI Top Stories artifact exists yet.
 */
export type LegacyTopStory = {
  id: string
  headline: string
  sector: string | null
  country: string | null
  coverage: number
  sources: StorySource[]
}

export function legacyTopStories(items: StoryItem[]): LegacyTopStory[] {
  return clusterStories(items)
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
}
