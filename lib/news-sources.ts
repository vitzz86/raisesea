export type NewsScope = 'sea' | 'apac' | 'global'

export type NewsMarket =
  | 'sea'
  | 'china'
  | 'japan'
  | 'south_korea'
  | 'global'

export type NewsSourceTier = 'primary' | 'specialist' | 'aggregator'

export type NewsSource = {
  name: string
  url: string
  scope: NewsScope
  market: NewsMarket
  kind: 'direct' | 'discovery'
  tier: NewsSourceTier
}

/**
 * Source strategy:
 * - direct publisher feeds improve provenance and reduce Google News dependence;
 * - discovery feeds fill country/category gaps and surface smaller local outlets;
 * - APAC is split explicitly so China, Japan and South Korea cannot collapse
 *   into a single catch-all query dominated by one market.
 */
export const NEWS_SOURCES: NewsSource[] = [
  // Southeast Asia
  {
    name: 'Techsauce Thailand',
    url: 'https://techsauce.co/en/feed',
    scope: 'sea',
    market: 'sea',
    kind: 'direct',
    tier: 'specialist',
  },
  {
    name: 'SEA Fundraising',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+thailand+OR+philippines+OR+malaysia+OR+singapore)+startup+(raises+OR+funding+OR+investment+OR+seed)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'Indonesia Startup Intelligence',
    url: 'https://news.google.com/rss/search?q=Indonesia+(startup+OR+venture+capital+OR+fintech)+(funding+OR+regulation+OR+acquisition)+when:7d&hl=en-ID&gl=ID&ceid=ID:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'Mainland SEA Startup Intelligence',
    url: 'https://news.google.com/rss/search?q=(Vietnam+OR+Thailand+OR+Cambodia+OR+Myanmar+OR+Laos)+startup+(funding+OR+technology+OR+policy+OR+acquisition)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'Maritime SEA Startup Intelligence',
    url: 'https://news.google.com/rss/search?q=(Philippines+OR+Malaysia+OR+Brunei)+(startup+OR+venture+capital+OR+fintech)+(funding+OR+policy+OR+acquisition)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'Singapore Regional Hub',
    url: 'https://news.google.com/rss/search?q=Singapore+(startup+OR+venture+capital+OR+technology)+(funding+OR+regulation+OR+acquisition)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'e27 and Tech in Asia',
    url: 'https://news.google.com/rss/search?q=(source:e27+OR+source:%22Tech+in+Asia%22)+(startup+OR+funding+OR+technology)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'DealStreetAsia Discovery',
    url: 'https://news.google.com/rss/search?q=source:DealStreetAsia+(funding+OR+venture+OR+acquisition)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
    scope: 'sea',
    market: 'sea',
    kind: 'discovery',
    tier: 'aggregator',
  },

  // China
  {
    name: 'TechNode China',
    url: 'https://technode.com/feed/',
    scope: 'apac',
    market: 'china',
    kind: 'direct',
    tier: 'specialist',
  },
  {
    name: 'China Startup and VC',
    url: 'https://news.google.com/rss/search?q=China+(startup+OR+venture+capital+OR+technology)+(funding+OR+regulation+OR+IPO+OR+acquisition)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'china',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: '36Kr Discovery',
    url: 'https://news.google.com/rss/search?q=(source:36Kr+OR+source:%2236Kr+Global%22)+(startup+OR+funding+OR+technology)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'china',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'China Technology Policy',
    url: 'https://news.google.com/rss/search?q=China+(AI+OR+semiconductor+OR+fintech+OR+platform)+(regulation+OR+policy+OR+investment)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'china',
    kind: 'discovery',
    tier: 'aggregator',
  },

  // Japan
  {
    name: 'The Bridge Japan',
    url: 'https://thebridge.jp/feed',
    scope: 'apac',
    market: 'japan',
    kind: 'direct',
    tier: 'specialist',
  },
  {
    name: 'Japan Startup and VC',
    url: 'https://news.google.com/rss/search?q=Japan+(startup+OR+venture+capital+OR+technology)+(funding+OR+IPO+OR+acquisition+OR+regulation)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'japan',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'Nikkei Asia Startup Discovery',
    url: 'https://news.google.com/rss/search?q=source:%22Nikkei+Asia%22+Japan+(startup+OR+technology+OR+funding)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'japan',
    kind: 'discovery',
    tier: 'aggregator',
  },

  // South Korea
  {
    name: 'beSUCCESS Korea',
    url: 'https://besuccess.com/feed/',
    scope: 'apac',
    market: 'south_korea',
    kind: 'direct',
    tier: 'specialist',
  },
  {
    name: 'South Korea Startup and VC',
    url: 'https://news.google.com/rss/search?q=(%22South+Korea%22+OR+Korean)+(startup+OR+venture+capital+OR+technology)+(funding+OR+IPO+OR+acquisition+OR+regulation)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'south_korea',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'KoreaTechDesk Discovery',
    url: 'https://news.google.com/rss/search?q=source:KoreaTechDesk+(startup+OR+funding+OR+technology)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'apac',
    market: 'south_korea',
    kind: 'discovery',
    tier: 'aggregator',
  },

  // Global signals that can materially affect SEA founders
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    scope: 'global',
    market: 'global',
    kind: 'direct',
    tier: 'specialist',
  },
  {
    name: 'Global VC and AI',
    url: 'https://news.google.com/rss/search?q=(US+OR+Europe)+(startup+OR+venture+capital)+(AI+OR+fintech+OR+SaaS)+(funding+OR+regulation+OR+acquisition)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'global',
    market: 'global',
    kind: 'discovery',
    tier: 'aggregator',
  },
  {
    name: 'TechCrunch and Sifted',
    url: 'https://news.google.com/rss/search?q=(source:TechCrunch+OR+source:Sifted)+(startup+OR+funding+OR+technology)+when:7d&hl=en-US&gl=US&ceid=US:en',
    scope: 'global',
    market: 'global',
    kind: 'discovery',
    tier: 'aggregator',
  },
]

export const SCOPE_TARGETS: Record<NewsScope, number> = {
  sea: 0.4,
  apac: 0.4,
  global: 0.2,
}

export const APAC_MARKET_TARGETS: Record<'china' | 'japan' | 'south_korea', number> = {
  china: 0.45,
  japan: 0.3,
  south_korea: 0.25,
}

export type BalancedCandidate<T> = {
  value: T
  scope: NewsScope
  market: NewsMarket
  pubMs: number
}

/** Select the freshest candidates while protecting the agreed regional mix. */
export function selectBalancedCandidates<T>(
  candidates: BalancedCandidate<T>[],
  limit: number,
): BalancedCandidate<T>[] {
  const newest = [...candidates].sort((a, b) => b.pubMs - a.pubMs)
  const scopeCaps = {
    sea: Math.round(limit * SCOPE_TARGETS.sea),
    apac: Math.round(limit * SCOPE_TARGETS.apac),
    global: 0,
  }
  scopeCaps.global = Math.max(0, limit - scopeCaps.sea - scopeCaps.apac)

  const selected = new Set<BalancedCandidate<T>>()
  const take = (pool: BalancedCandidate<T>[], count: number) => {
    let added = 0
    for (const candidate of pool) {
      if (added >= count) break
      if (selected.has(candidate)) continue
      selected.add(candidate)
      added++
    }
  }

  take(newest.filter(c => c.scope === 'sea'), scopeCaps.sea)

  const apacCap = scopeCaps.apac
  const chinaCap = Math.round(apacCap * APAC_MARKET_TARGETS.china)
  const japanCap = Math.round(apacCap * APAC_MARKET_TARGETS.japan)
  const koreaCap = Math.max(0, apacCap - chinaCap - japanCap)
  take(newest.filter(c => c.market === 'china'), chinaCap)
  take(newest.filter(c => c.market === 'japan'), japanCap)
  take(newest.filter(c => c.market === 'south_korea'), koreaCap)

  // If one APAC market is quiet, backfill from the other two while preserving
  // the overall 40% APAC envelope.
  const apacSelected = () => [...selected].filter(c => c.scope === 'apac').length
  take(newest.filter(c => c.scope === 'apac'), Math.max(0, apacCap - apacSelected()))
  take(newest.filter(c => c.scope === 'global'), scopeCaps.global)

  return [...selected].sort((a, b) => b.pubMs - a.pubMs).slice(0, limit)
}
