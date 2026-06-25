// ═══════════════════════════════════════════════════════════════
// lib/news-pipeline.ts
// RSS → DeepSeek → news_items pipeline.
//
// Sources for MVP: Tech in Asia, e27, TechCrunch Asia.
// We fetch RSS, deduplicate by source_url, then ask DeepSeek to extract:
//   - category (fundraising | tech | policy | exit)
//   - company name + amount + sector (if fundraising)
//   - 1-line summary
//   - 1-2 sentence "why it matters" with opinionated framing
// Items land with status='pending' for super admin review.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from './supabase'
import {
  clusterStories,
  clustersByCategory,
  TOP_STORY_CATEGORIES,
  type StoryItem,
  type CategorizedTopStories,
  type TopStoryCategory,
} from './news-clustering'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const

// ── Per-call budget (tightened so no single item can hog the run) ──
const PER_ATTEMPT_TIMEOUT_MS = 12_000   // hard kill a slow DeepSeek call at 12s
const MAX_ATTEMPTS_PER_MODEL = 2        // 2 flash + 2 pro = 4 shots/item worst case
const BACKOFF_BASE_MS        = 1_000    // 1s before the single retry

// ── Flash circuit breaker ──
// Flash is the default. If it's overloaded (429/503) enough times in ONE run,
// we flip to pro-only for the REST of that run instead of paying a doomed flash
// attempt on every remaining item. Pro is ALWAYS retained as the fallback.
const FLASH_BREAKER_THRESHOLD = 5

/**
 * Per-run mutable state shared across concurrent workers.
 * Single-threaded JS → plain counter mutation is safe (no locks needed).
 */
type RunState = {
  flashDisabled:  boolean   // true once the breaker trips → skip flash, go straight to pro
  flashOverloads: number    // count of flash 429/503 this run
}

function makeRunState(): RunState {
  return { flashDisabled: false, flashOverloads: 0 }
}

/** HTTP error carrying the status code so callers can detect overload (429/503). */
class DeepSeekHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function isOverloadError(err: unknown): boolean {
  return err instanceof DeepSeekHttpError && (err.status === 429 || err.status >= 500)
}

/**
 * Call DeepSeek via its OpenAI-compatible REST API (no SDK dependency).
 * Model order: flash → pro. If `state.flashDisabled` is set (breaker tripped),
 * we start at pro and skip flash entirely. Pro is never dropped — it's the backup.
 * Throws only if every available model+retry is exhausted.
 */
async function callDeepSeekText(
  prompt: string,
  opts?: { json?: boolean; maxTokens?: number },
  state?: RunState,
): Promise<string> {
  // Skip flash only when the breaker has tripped this run; pro is always tried.
  const startIndex = state?.flashDisabled ? 1 : 0
  let lastErr: unknown = null

  for (let mi = startIndex; mi < DEEPSEEK_MODELS.length; mi++) {
    const model = DEEPSEEK_MODELS[mi]
    try {
      return await callDeepSeekModelAttempt(model, prompt, opts)
    } catch (err) {
      lastErr = err

      // Flash overloaded? Count it; trip the breaker so the rest of the run goes pro-only.
      if (model === 'deepseek-v4-flash' && state && isOverloadError(err)) {
        state.flashOverloads++
        if (!state.flashDisabled && state.flashOverloads >= FLASH_BREAKER_THRESHOLD) {
          state.flashDisabled = true
          console.warn(`[news-pipeline] flash circuit breaker TRIPPED after ${state.flashOverloads} overloads — routing remaining items straight to ${DEEPSEEK_MODELS[1]}`)
        }
      }

      const isLastModel = mi === DEEPSEEK_MODELS.length - 1
      if (isLastModel) throw err
      console.warn(`[news-pipeline] ${model} exhausted retries, falling through to ${DEEPSEEK_MODELS[mi + 1]}`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All DeepSeek models exhausted')
}

async function callDeepSeekModelAttempt(model: string, prompt: string, opts?: { json?: boolean; maxTokens?: number }): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured')
  let lastErr: unknown = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
    try {
      const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: opts?.json
                ? 'You are a precise news analyst. Return only valid JSON.'
                : 'You are a precise news analyst.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: opts?.maxTokens || 8192,
          stream: false,
          // News extraction is narrow structured work. Disabling thinking keeps
          // latency and output token spend predictable.
          thinking: { type: 'disabled' },
          ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
      })
      if (!res.ok) {
        const errText = await res.text()
        const msg = `DeepSeek ${res.status} (${model}): ${errText.slice(0, 150)}`
        // Retry on transient errors (503 overloaded, 429 rate limit, 5xx)
        if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS_PER_MODEL) {
          const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)  // 1s
          console.warn(`[news-pipeline] ${model} attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL} got ${res.status}, retrying in ${backoffMs}ms`)
          await new Promise(r => setTimeout(r, backoffMs))
          lastErr = new DeepSeekHttpError(msg, res.status)
          continue
        }
        throw new DeepSeekHttpError(msg, res.status)
      }
      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      }
      const choice = data.choices?.[0]
      const text = choice?.message?.content || ''
      // Hard guard: if the model hit the token ceiling, the body is truncated.
      // Do NOT return it — safeParseJson would repair broken JSON and we would
      // silently store a half-written take.
      if (choice?.finish_reason === 'length') {
        throw new Error(`DeepSeek ${model} hit token limit — output truncated`)
      }
      if (!text.trim()) throw new Error(`DeepSeek ${model} returned empty content`)
      return text
    } catch (err) {
      lastErr = err
      // Token-limit truncation won't improve by retrying the same model with
      // the same cap — propagate immediately so the caller falls through.
      if (err instanceof Error && err.message.includes('token limit')) throw err
      // Network errors (fetch threw / timeout) — retry too
      if (attempt < MAX_ATTEMPTS_PER_MODEL) {
        const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }
      throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`DeepSeek ${model} exhausted retries`)
}

export type RssItem = {
  title:       string
  link:        string
  description: string
  pubDate:     string
  source:      string
}

// Google News RSS — reliable, not bot-blocked (unlike scraping publishers directly).
// Each "source" is a search query. The "when:7d" operator restricts to last 7 days.
//
// Strategy: 80% SEA-focused feeds, 20% global feeds (US/China/Japan/Korea/Europe).
// Global news matters to SEA founders — it predicts what reaches the region in 6-12mo
// (e.g. a US AI funding wave or a China fintech regulation often ripples to SEA).
//
// `scope` tags each feed so we keep the right 80/20 balance + can show region tags.
const SOURCES: Array<{ name: string; url: string; scope: 'sea' | 'global' }> = [
  // ── SEA feeds (80%) ──
  {
    name: 'SEA Fundraising',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+thailand+OR+philippines+OR+malaysia+OR+singapore)+startup+(raises+OR+funding+OR+"series+a"+OR+"series+b"+OR+seed)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  {
    name: 'SEA Venture Capital',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(southeast+asia+OR+indonesia+OR+vietnam+OR+philippines)+(venture+capital+OR+raises+OR+investment)+startup+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  {
    name: 'SEA Tech & Policy',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+thailand+OR+philippines+OR+singapore)+(fintech+OR+regulation+OR+"digital+economy"+OR+startup+policy)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  {
    name: 'SEA Exits & M&A',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+philippines+OR+singapore+OR+malaysia)+startup+(acquisition+OR+IPO+OR+acquired+OR+merger)+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  {
    name: 'SEA AI & Deep Tech',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+thailand+OR+philippines+OR+singapore+OR+malaysia)+(AI+OR+"artificial+intelligence"+OR+"deep+tech"+OR+SaaS)+startup+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  {
    name: 'SEA Consumer & Commerce',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+thailand+OR+philippines)+(e-commerce+OR+logistics+OR+consumer+OR+healthtech+OR+edtech)+startup+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  {
    name: 'SEA Climate & Fintech',
    scope: 'sea',
    url: 'https://news.google.com/rss/search?q=(indonesia+OR+vietnam+OR+philippines+OR+singapore)+(climate+OR+cleantech+OR+"green+energy"+OR+payments+OR+lending)+startup+when:7d&hl=en-SG&gl=SG&ceid=SG:en',
  },
  // ── Global feeds (20%) — only major, relevant signals ──
  {
    name: 'Global VC & AI',
    scope: 'global',
    url: 'https://news.google.com/rss/search?q=(US+OR+"silicon+valley"+OR+europe)+(startup+raises+OR+venture+capital)+(AI+OR+fintech)+when:7d&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Asia Major Markets',
    scope: 'global',
    url: 'https://news.google.com/rss/search?q=(china+OR+japan+OR+"south+korea"+OR+india)+(startup+OR+tech+OR+fintech)+(funding+OR+regulation+OR+IPO)+when:7d&hl=en-US&gl=US&ceid=US:en',
  },
]

/**
 * Fetch + parse RSS feed XML into structured items.
 * No external RSS parser dep — we do a lightweight regex parse.
 * Returns empty array on fetch error (don't break the pipeline).
 */
async function fetchRss(name: string, url: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[news-pipeline] ${name} fetch failed: ${res.status}`)
      return []
    }
    const xml = await res.text()
    const items = parseRssXml(xml, name)
    console.log(`[news-pipeline] ${name}: ${items.length} items fetched`)
    return items
  } catch (err) {
    console.error(`[news-pipeline] ${name} threw:`, err)
    return []
  }
}

/**
 * Lightweight RSS parser. Extracts <item>...</item> blocks then individual fields.
 * Not robust to malformed XML — but RSS from major publishers is usually clean.
 */
function parseRssXml(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1]
    let title = stripCDATA(extractTag(block, 'title')).trim()
    const link = stripCDATA(extractTag(block, 'link')).trim()
    const description = stripCDATA(extractTag(block, 'description')).replace(/<[^>]+>/g, '').slice(0, 1500)
    const pubDate = stripCDATA(extractTag(block, 'pubDate')).trim()
    // Google News puts the real publisher in <source url="...">Publisher</source>
    const sourceTag = stripCDATA(extractTag(block, 'source')).trim()
    // Google News titles are formatted "Headline - Publisher Name" — strip the trailing publisher
    let publisher = sourceTag || sourceName
    if (sourceTag && title.endsWith(` - ${sourceTag}`)) {
      title = title.slice(0, title.length - ` - ${sourceTag}`.length).trim()
    }
    if (title && link) {
      items.push({
        title,
        link,
        description: description || title,
        pubDate,
        source: publisher,
      })
    }
    if (items.length >= 40) break  // cap per feed
  }
  return items
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = block.match(re)
  return m ? m[1] : ''
}

function stripCDATA(s: string): string {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
}

// ─── DeepSeek extraction ─────────────────────────────────────────

export type ExtractedItem = {
  category:               'fundraising' | 'tech' | 'policy' | 'exit'
  is_sea_relevant:        boolean
  is_globally_interesting: boolean   // for global-scope items: is it major enough to matter to SEA founders?
  is_roundup:             boolean
  company_name:           string | null
  amount_usd:             number | null
  stage:                  string | null
  sector:                 string | null
  country:                string | null
  lead_investor:          string | null
  ai_summary:             string
  ai_why_it_matters:      string
}

function buildExtractionPrompt(scope: 'sea' | 'global'): string {
  const relevanceRule = scope === 'sea'
    ? `1. is_sea_relevant: Set TRUE if the article is about Indonesia, Singapore, Malaysia, Vietnam, Thailand, Philippines, Myanmar, Cambodia, Laos, Brunei, or Timor-Leste. Otherwise FALSE.
   is_globally_interesting: Set FALSE (this is a SEA feed).`
    : `1. is_sea_relevant: Set FALSE (this is a global feed — it's about US/China/Japan/Korea/Europe/India, not SEA).
   is_globally_interesting: Set TRUE only if this is a MAJOR signal a SEA founder genuinely needs to know — e.g. a landmark AI funding round, a major fintech regulation in China, a category-defining product, a mega-acquisition, a shift in VC sentiment that will ripple to SEA in 6-12 months. Set FALSE for routine local news with no SEA implication (most items).`

  return `You are an analyst for RaiseSEA, a platform serving Southeast Asian (SEA) startup founders.
Given an article title + description, extract structured data.

${relevanceRule}

2. is_roundup: Set TRUE if this is a generic roundup, quarterly/annual review, "deal barometer", ranking list, or aggregate report (e.g. "Q3 2025 Deal Review", "Funding hits $5.4b in 2025"). We only want SPECIFIC events: a named company raising, a specific acquisition, a specific regulation.

3. category — ONE of:
   - "fundraising" — a SPECIFIC named startup raised money
   - "tech" — product launches, specific tech trends, AI deals, platform changes
   - "policy" — a SPECIFIC regulation, government rule, or macro shift
   - "exit" — a SPECIFIC acquisition, IPO, or secondary sale

4. country: Infer the single most relevant country. ${scope === 'sea' ? 'For SEA items use the SEA country (Indonesia, Singapore, Vietnam, etc.) — infer from the company HQ. Use "Southeast Asia" only if genuinely region-wide.' : 'For global items use the country (United States, China, Japan, South Korea, India, or a European country).'} Never leave null.

5. sector: ALWAYS infer (AI/ML, Fintech, SaaS, E-commerce, Healthtech, Logistics, Edtech, Agritech, Cleantech, Deep Tech, Consumer, Cybersecurity, Crypto/Web3, Other). Never null.

6. For "fundraising": also extract company_name, amount_usd (number not string, e.g. 7000000 for $7M), stage (Pre-seed/Seed/Pre-Series A/Series A/B/C/Growth), lead_investor. Null for non-fundraising.

7. ai_summary: 1 sentence, factual, under 25 words.

8. ai_why_it_matters: 1-2 sentences, specific + opinionated, why a SEA founder should care. ${scope === 'global' ? 'For global news, explicitly connect it to SEA implications, e.g. "US AI infra spend signals the wave hitting SEA enterprise SaaS by 2026 — position now."' : 'Be specific and concrete. GOOD example: name the investor and the pattern. BAD example: bland lines like "This shows continued investor interest."'} Avoid bland generalities.

Return STRICTLY this JSON (no markdown fences, no trailing commas, no preamble):
{
  "category": "fundraising",
  "is_sea_relevant": ${scope === 'sea' ? 'true' : 'false'},
  "is_globally_interesting": ${scope === 'global' ? 'true' : 'false'},
  "is_roundup": false,
  "company_name": null,
  "amount_usd": null,
  "stage": null,
  "sector": "Fintech",
  "country": "${scope === 'sea' ? 'Indonesia' : 'United States'}",
  "lead_investor": null,
  "ai_summary": "...",
  "ai_why_it_matters": "..."
}`
}

/**
 * Robustly parse JSON from an LLM response.
 * Handles: markdown fences, leading/trailing prose, trailing commas.
 */
function safeParseJson<T>(raw: string): T | null {
  let s = raw.trim()
  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  // Extract from first { onward (we may not have a closing brace if truncated)
  const firstBrace = s.indexOf('{')
  if (firstBrace === -1) return null
  s = s.slice(firstBrace)
  const lastBrace = s.lastIndexOf('}')
  if (lastBrace !== -1) {
    s = s.slice(0, lastBrace + 1)
  }
  // Remove trailing commas before } or ]
  const cleaned = s.replace(/,(\s*[}\]])/g, '$1')

  // First attempt: parse as-is
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fallback: attempt to repair truncated JSON (response cut off by token limit).
    // These are flat objects, so we can close an unterminated string + brace.
    try {
      let repaired = s
      // Count unescaped quotes — if odd, we're inside an unterminated string
      const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length
      if (quoteCount % 2 !== 0) {
        repaired += '"'  // close the dangling string
      }
      // Drop any trailing partial key/value after the last complete comma
      repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*[^,{}\[\]]*$/, '')
      // Close any unbalanced braces
      const open = (repaired.match(/{/g) || []).length
      const close = (repaired.match(/}/g) || []).length
      repaired += '}'.repeat(Math.max(0, open - close))
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1')
      return JSON.parse(repaired) as T
    } catch {
      return null
    }
  }
}

async function extractWithDeepSeek(item: RssItem, scope: 'sea' | 'global', state?: RunState): Promise<ExtractedItem | null> {
  try {
    const input = `TITLE: ${item.title}\n\nDESCRIPTION: ${item.description}\n\nSOURCE: ${item.source}`
    const text = await callDeepSeekText(`${buildExtractionPrompt(scope)}\n\n${input}`, { json: true, maxTokens: 2048 }, state)
    const parsed = safeParseJson<ExtractedItem>(text)
    if (!parsed) {
      console.warn('[news-pipeline] parse failed. Raw DeepSeek output (first 200 chars):', text.slice(0, 200).replace(/\n/g, '\\n'))
      return null
    }
    return parsed
  } catch (err) {
    console.error('[news-pipeline] deepseek extract failed for', item.title.slice(0, 50), err)
    return null
  }
}

/**
 * Main entry: pull all sources, extract via DeepSeek, dedupe, insert into news_items.
 * Returns counts for reporting.
 */
// Title keywords that signal a roundup/aggregate (reject for FREE, before DeepSeek)
const ROUNDUP_KEYWORDS = [
  'deal review', 'deals review', 'q1 20', 'q2 20', 'q3 20', 'q4 20',
  'year in review', 'annual review', 'barometer', 'roundup', 'round-up',
  'weekly digest', 'monthly digest', 'ecosystem report', 'state of',
  'top 10', 'top 20', 'top 50', 'best of', 'list of', 'ranking',
  'half-year', 'first half', 'second half', 'h1 20', 'h2 20',
]

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
}

// Max DeepSeek calls per run — hard cap on how many candidates we extract.
// Raised from 60: bounded concurrency makes a larger set fit comfortably,
// and the wall-clock guard (below) is the real safety net against timeouts.
const MAX_DEEPSEEK_CALLS = 120

// How many DeepSeek extractions run concurrently. ~6 is a safe balance: a big
// wall-clock speedup without hammering provider rate limits.
const DEEPSEEK_CONCURRENCY = 6

// Stop LAUNCHING new extractions once the run has been going this long. Each
// in-flight item is independently bounded by the per-call timeout, so the
// function always returns well under Vercel's 300s ceiling. Anything not
// reached this run is retried by the next daily cron (RSS + URL dedupe make
// the whole pipeline idempotent). NOTE: the Monday cron also runs the weekly
// digest after this — 220s leaves headroom for that within the same 300s.
const WALL_CLOCK_BUDGET_MS = 220_000

/**
 * Bounded-concurrency pool. Runs `worker` over `items` with at most
 * `concurrency` promises in flight at once. `shouldStop` is checked before
 * pulling each next item — once it returns true, no NEW items are launched
 * (already in-flight items run to completion).
 */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  let cursor = 0
  async function drain(): Promise<void> {
    while (cursor < items.length) {
      if (shouldStop?.()) return
      const item = items[cursor++]
      try {
        await worker(item)
      } catch (err) {
        // Workers handle their own errors; this is a last-resort guard so one
        // unexpected throw can't reject the whole Promise.all and abort the run.
        console.error('[news-pipeline] worker threw unexpectedly:', err)
      }
    }
  }
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => drain())
  await Promise.all(lanes)
}

export async function runNewsPipeline(): Promise<{
  fetched: number
  new:     number
  skipped: number
  errors:  number
}> {
  let fetched = 0, inserted = 0, skipped = 0, errors = 0
  let seaInserted = 0, globalInserted = 0

  // Existing URLs (last 30 days) so we skip duplicates without a DeepSeek call
  const { data: existing } = await supabaseAdmin
    .from('news_items')
    .select('source_url')
    .gte('created_at', new Date(Date.now() - 30 * 86400 * 1000).toISOString())
  const existingUrls = new Set((existing || []).map(r => r.source_url))

  const sevenDaysAgoMs = Date.now() - 7 * 86400 * 1000

  // ── STAGE 1: fetch all feeds + pre-filter using FREE rss data (no DeepSeek) ──
  type Candidate = { item: RssItem; scope: 'sea' | 'global'; pubMs: number }
  const seaCandidates: Candidate[] = []
  const globalCandidates: Candidate[] = []
  const seenTitles = new Set<string>()

  for (const source of SOURCES) {
    const items = await fetchRss(source.name, source.url)
    fetched += items.length

    for (const item of items) {
      // 1. Already in DB?
      if (existingUrls.has(item.link)) { skipped++; continue }

      // 2. Dedupe by normalized title (same story across feeds)
      const normTitle = normalizeTitle(item.title)
      if (seenTitles.has(normTitle)) { skipped++; continue }

      // 3. Date window — reject older than 7 days using RSS pubDate (FREE)
      const pubDate = item.pubDate ? new Date(item.pubDate) : null
      const pubMs = pubDate && !isNaN(pubDate.getTime()) ? pubDate.getTime() : Date.now()
      if (pubMs < sevenDaysAgoMs) { skipped++; continue }

      // 4. Roundup keywords in title (FREE)
      const lowerTitle = item.title.toLowerCase()
      if (ROUNDUP_KEYWORDS.some(kw => lowerTitle.includes(kw))) { skipped++; continue }

      seenTitles.add(normTitle)
      const cand: Candidate = { item, scope: source.scope, pubMs }
      if (source.scope === 'sea') seaCandidates.push(cand)
      else globalCandidates.push(cand)
    }
  }

  // ── STAGE 2: build a capped, balanced work list (80/20 SEA/global) ──
  // Sort each pool newest-first so we process the freshest news within our call budget.
  seaCandidates.sort((a, b) => b.pubMs - a.pubMs)
  globalCandidates.sort((a, b) => b.pubMs - a.pubMs)

  const globalBudget = Math.min(globalCandidates.length, Math.floor(MAX_DEEPSEEK_CALLS * 0.2))
  const seaBudget = Math.min(seaCandidates.length, MAX_DEEPSEEK_CALLS - globalBudget)
  const workList: Candidate[] = [
    ...seaCandidates.slice(0, seaBudget),
    ...globalCandidates.slice(0, globalBudget),
  ]

  console.log(`[news-pipeline] pre-filter done. candidates: sea=${seaCandidates.length} global=${globalCandidates.length}. Processing ${workList.length} (cap ${MAX_DEEPSEEK_CALLS}).`)

  // ── STAGE 3: DeepSeek extraction (bounded concurrency + wall-clock guard) ──
  // Process the work list with a small pool of concurrent workers instead of
  // one-at-a-time. The wall-clock guard stops launching NEW work before we
  // approach the 300s Vercel ceiling, and each in-flight call is bounded by
  // PER_ATTEMPT_TIMEOUT_MS — so the run ALWAYS returns cleanly. The flash
  // circuit breaker lives in runState (pro is retained as the fallback).
  const runState = makeRunState()
  const pipelineStart = Date.now()
  let processed = 0
  let stoppedEarly = false

  const handleCandidate = async ({ item, scope, pubMs }: Candidate): Promise<void> => {
    processed++

    const extracted = await extractWithDeepSeek(item, scope, runState)
    if (!extracted) { errors++; return }

    if (extracted.is_roundup) { skipped++; return }
    if (scope === 'sea' && !extracted.is_sea_relevant) { skipped++; return }
    if (scope === 'global' && !extracted.is_globally_interesting) { skipped++; return }

    // Guard: a truncated/garbled DeepSeek reply can still parse (via safeParseJson's
    // repair path) into an object whose AI fields are empty. Don't persist a
    // half-baked row — skip it and let the next cron retry the URL (RSS + URL
    // dedupe keep the pipeline idempotent, so nothing is lost permanently).
    if (!extracted.ai_summary?.trim() || !extracted.ai_why_it_matters?.trim()) {
      console.warn('[news-pipeline] dropping item with empty AI fields:', item.title.slice(0, 60))
      errors++
      return
    }

    const { error } = await supabaseAdmin
      .from('news_items')
      .insert({
        category:          extracted.category,
        title:             item.title.slice(0, 300),
        company_name:      extracted.company_name,
        amount_usd:        extracted.amount_usd,
        stage:             extracted.stage,
        sector:            extracted.sector,
        country:           extracted.country,
        lead_investor:     extracted.lead_investor,
        source_url:        item.link,
        source_name:       item.source,
        ai_summary:        extracted.ai_summary,
        ai_why_it_matters: extracted.ai_why_it_matters,
        status:            'pending',
        published_at:      new Date(pubMs).toISOString(),
        region_scope:      scope,
      })
    if (error) {
      // 23505 = unique violation (a concurrent worker inserted the same URL first) → treat as dup
      if (error.code !== '23505') { console.error('[news-pipeline] insert failed:', error.message); errors++ }
      else skipped++
    } else {
      inserted++
      if (scope === 'global') globalInserted++; else seaInserted++
      existingUrls.add(item.link)
    }
  }

  await runPool(workList, DEEPSEEK_CONCURRENCY, handleCandidate, () => {
    if (Date.now() - pipelineStart > WALL_CLOCK_BUDGET_MS) { stoppedEarly = true; return true }
    return false
  })

  if (stoppedEarly) {
    console.warn(`[news-pipeline] wall-clock guard hit (${WALL_CLOCK_BUDGET_MS}ms) — stopped launching new items. Processed ${processed}/${workList.length}; remainder deferred to next run.`)
  }

  console.log(`[news-pipeline] complete. fetched=${fetched} processed=${processed} new=${inserted} (sea=${seaInserted} global=${globalInserted}) skipped=${skipped} errors=${errors}${stoppedEarly ? ' [stopped early — budget guard]' : ''}`)
  return { fetched, new: inserted, skipped, errors }
}

/**
 * Generate an "Editor's take" — opinionated 3-5 sentence weekly summary.
 * Based on the last 7 days of approved news_items + their stats.
 */
export type EditorsTake = {
  headline: string
  body:     string
  takeaway: string
  content:  string  // full-text mirror (headline + body + takeaway) for fallback/search
}

export async function generateEditorsTake(): Promise<EditorsTake | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('category, company_name, amount_usd, stage, sector, country, lead_investor, ai_summary, region_scope')
    .eq('status', 'approved')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })
    .limit(60)

  if (!items || items.length === 0) {
    console.log('[editors-take] no items to summarize')
    return null
  }

  // Split SEA vs global so the prompt can keep the 80/20 emphasis
  const seaItems = items.filter(i => (i.region_scope || 'sea') === 'sea')
  const globalItems = items.filter(i => i.region_scope === 'global')

  const fmtItem = (it: typeof items[number], i: number) =>
    `${i + 1}. [${it.category}] ${it.company_name || '(no company)'} · ${it.sector || '?'} · ${it.country || '?'} · ${it.amount_usd ? '$' + (it.amount_usd / 1e6).toFixed(1) + 'M ' : ''}${it.stage || ''}${it.lead_investor ? ' · led by ' + it.lead_investor : ''} — ${it.ai_summary}`

  const seaBlock = seaItems.map(fmtItem).join('\n')
  const globalBlock = globalItems.length > 0 ? globalItems.map(fmtItem).join('\n') : '(none this week)'

  const prompt = `You are the editor of RaiseSEA, writing the weekly market take for Southeast Asian startup founders.

Write a structured take with THREE parts:
1. headline — a punchy, opinionated 5-10 word headline. Example: "AI is eating SEA's funding — but the smart money is local"
2. body — ONE flowing paragraph (4-6 sentences) that touches on MULTIPLE categories this week: include 1-2 sentences on FUNDRAISING, 1-2 on TECH/product, and a sentence on POLICY and/or EXITS if notable. Weave them into one cohesive paragraph, not a list. Cite SPECIFIC numbers/companies/investors from the data.
3. takeaway — ONE actionable line for founders, starting with "What to do:" or "Watch:". Concrete. Do NOT repeat this line inside the body.

CRITICAL FOCUS RULE — 80/20:
- ~80% of the take is about SOUTHEAST ASIA (SEA NEWS below). Headline + most of body MUST center on SEA.
- ~20% may reference GLOBAL signals — ONLY as supporting context for SEA founders. Never lead with a global/US company.

TONE: smart friend texting, confident, specific. AVOID cliches like "this week saw", "the ecosystem continued".

SEA NEWS (primary — 80%):
${seaBlock}

GLOBAL NEWS (supporting context only — max 20%):
${globalBlock}

Return STRICTLY this JSON (no markdown fences, no trailing commas, do NOT repeat the takeaway inside body):
{
  "headline": "...",
  "body": "One paragraph spanning fundraising + tech + policy/exits...",
  "takeaway": "What to do: ..."
}`

  try {
    const text = await callDeepSeekText(prompt, { json: true, maxTokens: 8192 })
    const parsed = safeParseJson<{ headline?: string; body?: string; takeaway?: string }>(text)
    if (!parsed || !parsed.body) {
      console.warn('[editors-take] parse failed or empty body. Raw:', text.slice(0, 200).replace(/\n/g, '\\n'))
      return null
    }
    const headline = (parsed.headline || '').trim().slice(0, 200)
    let body = (parsed.body || '').trim().slice(0, 2000)
    const takeaway = (parsed.takeaway || '').trim().slice(0, 400)
    // Defensive: if the model echoed the takeaway at the end of body, strip it
    if (takeaway && body.endsWith(takeaway)) body = body.slice(0, body.length - takeaway.length).trim()
    const content = [headline, body, takeaway].filter(Boolean).join('\n\n').slice(0, 3000)
    return { headline, body, takeaway, content }
  } catch (err) {
    console.error('[editors-take] deepseek failed:', err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// Top Stories — categorized, AI-selected, with REAL source coverage.
//
// Hybrid: clustering finds candidates + the objective "N sources" signal,
// then DeepSeek picks the single most important story per category and writes
// the headline + "why it matters" (SEA-first). The chosen cluster's real
// source list/coverage are attached — never invented by the model.
// Generated + stored + approved alongside the Editor's Take.
// ═══════════════════════════════════════════════════════════════
export async function generateTopStories(): Promise<CategorizedTopStories | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('id, category, title, company_name, amount_usd, stage, sector, country, source_url, source_name, ai_summary, published_at, region_scope')
    .eq('status', 'approved')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })
    .limit(200)

  if (!items || items.length === 0) {
    console.log('[top-stories] no approved items to rank')
    return null
  }

  const clusters = clusterStories(items as StoryItem[])
  const byCat = clustersByCategory(clusters, 6)

  const catTitles: Record<TopStoryCategory, string> = {
    fundraising: 'FUNDRAISING (a specific named startup raised money)',
    tech:        'TECH & PRODUCT (product launches, AI deals, platform shifts)',
    policy:      'POLICY & ECONOMIC (a specific regulation or macro shift)',
    exit:        'EXIT (a specific acquisition, IPO, or secondary sale)',
  }

  const fmtAmount = (n: number | null) => (n ? ` ($${(n / 1e6).toFixed(1)}M)` : '')
  const candidateBlocks: string[] = []
  for (const cat of TOP_STORY_CATEGORIES) {
    const cands = byCat[cat]
    const lines = cands.length === 0
      ? '(no candidates this week)'
      : cands.map((c, i) => {
          const p = c.primary
          const label = p.company_name ? `${p.company_name}${fmtAmount(p.amount_usd)}` : p.title
          return `[${i + 1}] ${label} — ${p.sector || '?'}, ${p.country || '?'} — covered by ${c.coverage} source(s) — ${p.ai_summary || p.title}`
        }).join('\n')
    candidateBlocks.push(`### ${catTitles[cat]}\n${lines}`)
  }

  const prompt = `You are the editor of RaiseSEA, picking THE single most important story in each of 4 categories for Southeast Asian (SEA) startup founders this week.

For EACH category below, choose the ONE candidate that matters most to a SEA founder, and write:
- "headline": a punchy, specific headline (<= 12 words). Use the real company/event — never vague.
- "why": ONE sentence (<= 30 words) on why a SEA founder should care. Concrete; avoid "this shows continued interest".

SEA-FIRST RULE: prefer Southeast Asia stories. Only pick a global/non-SEA candidate if it's a genuinely major signal that will ripple to SEA — and if so, the "why" MUST state the SEA implication.

If a category has no candidate worth featuring (weak or empty), set "pick" to 0 for that category.

Return STRICTLY this JSON (no markdown fences, no preamble). "pick" is the [number] of the chosen candidate, or 0 for none:
{
  "fundraising": { "pick": 1, "headline": "...", "why": "..." },
  "tech":        { "pick": 0 },
  "policy":      { "pick": 2, "headline": "...", "why": "..." },
  "exit":        { "pick": 0 }
}

CANDIDATES:
${candidateBlocks.join('\n\n')}`

  let parsed: Record<string, { pick?: number; headline?: string; why?: string }> | null = null
  try {
    // 4 categories × (headline + why) — give it real headroom. At 2048 the
    // JSON truncated after the first 1-2 categories, dropping policy + exit
    // (they're last in the object). 8192 + bounded thinking fits all four.
    const text = await callDeepSeekText(prompt, { json: true, maxTokens: 8192 }, makeRunState())
    parsed = safeParseJson(text)
  } catch (err) {
    console.error('[top-stories] deepseek failed:', err)
    return null
  }
  if (!parsed) { console.warn('[top-stories] parse failed'); return null }

  const result: CategorizedTopStories = { fundraising: null, tech: null, policy: null, exit: null }
  for (const cat of TOP_STORY_CATEGORIES) {
    const pickObj = parsed[cat]
    const pick = pickObj?.pick
    if (!pick || pick < 1) continue
    const cluster = byCat[cat][pick - 1]
    if (!cluster) continue
    const headline = (pickObj.headline || '').trim().slice(0, 160)
    const why = (pickObj.why || '').trim().slice(0, 400)
    if (!headline) continue
    result[cat] = {
      id:         cluster.primary.id,
      headline,
      why,
      sector:     cluster.primary.sector,
      country:    cluster.primary.country,
      coverage:   cluster.coverage,
      sources:    cluster.sources,
      source_url: cluster.primary.source_url,
    }
  }

  const anyPicked = TOP_STORY_CATEGORIES.some(c => result[c] !== null)
  if (!anyPicked) { console.log('[top-stories] AI picked nothing worth featuring'); return null }
  return result
}
