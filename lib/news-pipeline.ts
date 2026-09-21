// ═══════════════════════════════════════════════════════════════
// lib/news-pipeline.ts
// RSS → Hermes-compatible model API → news_items pipeline.
//
// Sources for MVP: Tech in Asia, e27, TechCrunch Asia.
// We fetch RSS, deduplicate by source_url/title, then ask the configured model to extract:
//   - category (fundraising | tech | policy | exit)
//   - company name + amount + sector (if fundraising)
//   - 1-line summary
//   - 1-2 sentence "why it matters" with opinionated framing
// High-confidence items publish automatically. Ambiguous records enter a
// non-blocking review queue; weak records are skipped.
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
import {
  NEWS_SOURCES,
  selectBalancedCandidates,
  type NewsMarket,
  type NewsScope,
  type NewsSource,
} from './news-sources'
import { decidePublication } from './news-quality'

const NEWS_AI_API_KEY = process.env.NEWS_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
const NEWS_AI_API_URL = resolveCompletionsUrl(
  process.env.NEWS_AI_API_URL || process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
)
const configuredModels = (process.env.NEWS_AI_MODELS || process.env.NEWS_AI_MODEL || 'deepseek-v4-flash,deepseek-v4-pro')
  .split(',')
  .map(model => model.trim())
  .filter(Boolean)
const NEWS_AI_MODELS = configuredModels.length > 0 ? configuredModels : ['deepseek-v4-flash']

function resolveCompletionsUrl(input: string): string {
  const base = input.replace(/\/$/, '')
  if (base.endsWith('/chat/completions')) return base
  return `${base}/chat/completions`
}

// ── Per-call budget (tightened so no single item can hog the run) ──
const PER_ATTEMPT_TIMEOUT_MS = 12_000   // hard kill a slow DeepSeek call at 12s
const MAX_ATTEMPTS_PER_MODEL = 2        // 2 flash + 2 pro = 4 shots/item worst case
const BACKOFF_BASE_MS        = 1_000    // 1s before the single retry

// ── Flash circuit breaker ──
// Flash is the default. If it's overloaded (429/503) enough times in ONE run,
// we flip to pro-only for the REST of that run instead of paying a doomed flash
// attempt on every remaining item. Pro is ALWAYS retained as the fallback.
const PRIMARY_MODEL_BREAKER_THRESHOLD = 5

/**
 * Per-run mutable state shared across concurrent workers.
 * Single-threaded JS → plain counter mutation is safe (no locks needed).
 */
type RunState = {
  primaryDisabled:  boolean
  primaryOverloads: number
}

function makeRunState(): RunState {
  return { primaryDisabled: false, primaryOverloads: 0 }
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
 * Call the Hermes/SumoPod OpenAI-compatible REST API (no SDK dependency).
 * Models are tried in NEWS_AI_MODELS order. A per-run circuit breaker skips a
 * repeatedly overloaded primary while retaining every configured fallback.
 * Throws only if every available model+retry is exhausted.
 */
async function callDeepSeekText(
  prompt: string,
  opts?: { json?: boolean; maxTokens?: number },
  state?: RunState,
): Promise<string> {
  // Skip flash only when the breaker has tripped this run; pro is always tried.
  const startIndex = state?.primaryDisabled && NEWS_AI_MODELS.length > 1 ? 1 : 0
  let lastErr: unknown = null

  for (let mi = startIndex; mi < NEWS_AI_MODELS.length; mi++) {
    const model = NEWS_AI_MODELS[mi]
    try {
      return await callDeepSeekModelAttempt(model, prompt, opts)
    } catch (err) {
      lastErr = err

      if (mi === 0 && state && isOverloadError(err)) {
        state.primaryOverloads++
        if (!state.primaryDisabled && NEWS_AI_MODELS.length > 1 && state.primaryOverloads >= PRIMARY_MODEL_BREAKER_THRESHOLD) {
          state.primaryDisabled = true
          console.warn(`[news-pipeline] primary model circuit breaker tripped after ${state.primaryOverloads} overloads — routing remaining items to ${NEWS_AI_MODELS[1]}`)
        }
      }

      const isLastModel = mi === NEWS_AI_MODELS.length - 1
      if (isLastModel) throw err
      console.warn(`[news-pipeline] ${model} exhausted retries, falling through to ${NEWS_AI_MODELS[mi + 1]}`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All DeepSeek models exhausted')
}

async function callDeepSeekModelAttempt(model: string, prompt: string, opts?: { json?: boolean; maxTokens?: number }): Promise<string> {
  if (!NEWS_AI_API_KEY) throw new Error('NEWS_AI_API_KEY (or compatible fallback) not configured')
  let lastErr: unknown = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
    try {
      const res = await fetch(NEWS_AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NEWS_AI_API_KEY}`,
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
          ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
      })
      if (!res.ok) {
        const errText = await res.text()
        const msg = `Model API ${res.status} (${model}): ${errText.slice(0, 150)}`
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
        throw new Error(`Model ${model} hit token limit — output truncated`)
      }
      if (!text.trim()) throw new Error(`Model ${model} returned empty content`)
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
  throw lastErr instanceof Error ? lastErr : new Error(`Model ${model} exhausted retries`)
}

export type RssItem = {
  title:       string
  link:        string
  description: string
  pubDate:     string
  source:      string
}

/**
 * Fetch + parse RSS feed XML into structured items.
 * No external RSS parser dep — we do a lightweight regex parse.
 * Returns empty array on fetch error (don't break the pipeline).
 */
export type SourceHealth = {
  name: string
  scope: NewsScope
  market: NewsMarket
  ok: boolean
  status: number | null
  itemCount: number
  latencyMs: number
  error: string | null
}

async function fetchRss(source: NewsSource): Promise<{ items: RssItem[]; health: SourceHealth }> {
  const started = Date.now()
  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[news-pipeline] ${source.name} fetch failed: ${res.status}`)
      return {
        items: [],
        health: { name: source.name, scope: source.scope, market: source.market, ok: false, status: res.status, itemCount: 0, latencyMs: Date.now() - started, error: `HTTP ${res.status}` },
      }
    }
    const xml = await res.text()
    const items = parseRssXml(xml, source.name)
    console.log(`[news-pipeline] ${source.name}: ${items.length} items fetched`)
    return {
      items,
      health: { name: source.name, scope: source.scope, market: source.market, ok: items.length > 0, status: res.status, itemCount: items.length, latencyMs: Date.now() - started, error: items.length > 0 ? null : 'No RSS items parsed' },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[news-pipeline] ${source.name} threw:`, message)
    return {
      items: [],
      health: { name: source.name, scope: source.scope, market: source.market, ok: false, status: null, itemCount: 0, latencyMs: Date.now() - started, error: message.slice(0, 300) },
    }
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
  is_region_relevant:     boolean
  is_roundup:             boolean
  company_name:           string | null
  amount_usd:             number | null
  stage:                  string | null
  sector:                 string | null
  country:                string | null
  lead_investor:          string | null
  ai_summary:             string
  ai_why_it_matters:      string
  confidence:             number
  evidence_quality:       'strong' | 'moderate' | 'weak'
}

function buildExtractionPrompt(scope: NewsScope): string {
  const relevanceRule = scope === 'sea'
    ? 'Set is_region_relevant TRUE only when the specific event concerns Southeast Asia: Indonesia, Singapore, Malaysia, Vietnam, Thailand, Philippines, Myanmar, Cambodia, Laos, Brunei, or Timor-Leste.'
    : scope === 'apac'
      ? 'Set is_region_relevant TRUE only when the specific event concerns China, Japan, or South Korea. Routine India, Australia, US, Europe, or SEA stories are outside this feed\'s target.'
      : 'Set is_region_relevant TRUE only for a major global signal that a SEA founder genuinely needs to know: category-defining funding, regulation, product/platform change, market shift, or mega-exit with likely SEA impact. Reject routine local news.'

  return `You are an analyst for RaiseSEA, a platform serving Southeast Asian (SEA) startup founders.
Given an article title + description, extract structured data.

1. ${relevanceRule}

2. is_roundup: Set TRUE if this is a generic roundup, quarterly/annual review, "deal barometer", ranking list, or aggregate report (e.g. "Q3 2025 Deal Review", "Funding hits $5.4b in 2025"). We only want SPECIFIC events: a named company raising, a specific acquisition, a specific regulation.

3. category — ONE of:
   - "fundraising" — a SPECIFIC named startup raised money
   - "tech" — product launches, specific tech trends, AI deals, platform changes
   - "policy" — a SPECIFIC regulation, government rule, or macro shift
   - "exit" — a SPECIFIC acquisition, IPO, or secondary sale

4. country: Infer the single most relevant country. ${scope === 'sea' ? 'Use the SEA country and infer from the company headquarters. Use "Southeast Asia" only if genuinely region-wide.' : scope === 'apac' ? 'Use China, Japan, or South Korea and infer from the company headquarters.' : 'Use the primary country affected by the event.'} Never leave null.

5. sector: ALWAYS infer (AI/ML, Fintech, SaaS, E-commerce, Healthtech, Logistics, Edtech, Agritech, Cleantech, Deep Tech, Consumer, Cybersecurity, Crypto/Web3, Other). Never null.

6. For "fundraising": also extract company_name, amount_usd (number not string, e.g. 7000000 for $7M), stage (Pre-seed/Seed/Pre-Series A/Series A/B/C/Growth), lead_investor. Null for non-fundraising.

7. ai_summary: 1 sentence, factual, under 25 words.

8. ai_why_it_matters: 1-2 sentences, specific + opinionated, why a SEA founder should care. ${scope === 'sea' ? 'Name the concrete local pattern, company, investor, or policy implication.' : 'Explicitly connect the event to a realistic SEA implication.'} Avoid bland generalities.

9. confidence: A number from 0 to 1 measuring confidence that the event, country, category, and extracted facts are supported by the supplied title/description. Do not reward confident writing.

10. evidence_quality: "strong" when the description contains specific named facts, "moderate" when most key facts are present, or "weak" when the item is vague/second-hand.

Return STRICTLY this JSON (no markdown fences, no trailing commas, no preamble):
{
  "category": "fundraising",
  "is_region_relevant": true,
  "is_roundup": false,
  "company_name": null,
  "amount_usd": null,
  "stage": null,
  "sector": "Fintech",
  "country": "${scope === 'sea' ? 'Indonesia' : scope === 'apac' ? 'Japan' : 'United States'}",
  "lead_investor": null,
  "ai_summary": "...",
  "ai_why_it_matters": "...",
  "confidence": 0.86,
  "evidence_quality": "strong"
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

async function extractWithDeepSeek(item: RssItem, scope: NewsScope, state?: RunState): Promise<ExtractedItem | null> {
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
const MAX_DEEPSEEK_CALLS = Math.max(1, Number(process.env.NEWS_MAX_MODEL_CALLS || 120))

// How many DeepSeek extractions run concurrently. ~6 is a safe balance: a big
// wall-clock speedup without hammering provider rate limits.
const DEEPSEEK_CONCURRENCY = Math.max(1, Number(process.env.NEWS_MODEL_CONCURRENCY || 6))

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

export async function auditNewsSources(): Promise<SourceHealth[]> {
  const health: SourceHealth[] = []
  await runPool(NEWS_SOURCES, 6, async source => {
    const result = await fetchRss(source)
    health.push(result.health)
  })
  return health.sort((a, b) => a.name.localeCompare(b.name))
}

export type NewsPipelineResult = {
  fetched: number
  processed: number
  new: number
  approved: number
  pending: number
  skipped: number
  errors: number
  byScope: Record<NewsScope, number>
  sourceHealth: SourceHealth[]
  stoppedEarly: boolean
  dryRun: boolean
}

export async function runNewsPipeline(options: { dryRun?: boolean; runId?: string | null } = {}): Promise<NewsPipelineResult> {
  let fetched = 0, inserted = 0, approved = 0, pending = 0, skipped = 0, errors = 0
  const byScope: Record<NewsScope, number> = { sea: 0, apac: 0, global: 0 }
  const sourceHealth: SourceHealth[] = []

  // URLs and normalized titles are both checked across runs. This prevents a
  // syndicated story with a different redirect URL from being re-published.
  const { data: existing } = await supabaseAdmin
    .from('news_items')
    .select('source_url, title')
    .gte('created_at', new Date(Date.now() - 30 * 86400 * 1000).toISOString())
  const existingUrls = new Set((existing || []).map(r => r.source_url))
  const seenTitles = new Set((existing || []).map(r => normalizeTitle(r.title || '')).filter(Boolean))
  const sevenDaysAgoMs = Date.now() - 7 * 86400 * 1000

  type Candidate = {
    item: RssItem
    source: NewsSource
    scope: NewsScope
    market: NewsMarket
    pubMs: number
  }
  const candidates: Candidate[] = []

  // Fetch concurrently in small batches: source failures are isolated and
  // recorded for the Hermes run status instead of aborting the whole job.
  await runPool(NEWS_SOURCES, 6, async source => {
    const result = await fetchRss(source)
    sourceHealth.push(result.health)
    fetched += result.items.length

    for (const item of result.items) {
      if (existingUrls.has(item.link)) { skipped++; continue }
      const normTitle = normalizeTitle(item.title)
      if (!normTitle || seenTitles.has(normTitle)) { skipped++; continue }

      const pubDate = item.pubDate ? new Date(item.pubDate) : null
      const pubMs = pubDate && !isNaN(pubDate.getTime()) ? pubDate.getTime() : Date.now()
      if (pubMs < sevenDaysAgoMs) { skipped++; continue }
      if (ROUNDUP_KEYWORDS.some(kw => item.title.toLowerCase().includes(kw))) { skipped++; continue }

      seenTitles.add(normTitle)
      candidates.push({ item, source, scope: source.scope, market: source.market, pubMs })
    }
  })

  const workList = selectBalancedCandidates(
    candidates.map(candidate => ({ value: candidate, scope: candidate.scope, market: candidate.market, pubMs: candidate.pubMs })),
    MAX_DEEPSEEK_CALLS,
  ).map(candidate => candidate.value)

  const candidateCounts = candidates.reduce<Record<NewsScope, number>>(
    (acc, candidate) => { acc[candidate.scope]++; return acc },
    { sea: 0, apac: 0, global: 0 },
  )
  console.log(`[news-pipeline] pre-filter done. candidates: sea=${candidateCounts.sea} apac=${candidateCounts.apac} global=${candidateCounts.global}. Processing ${workList.length} (cap ${MAX_DEEPSEEK_CALLS}).`)

  const runState = makeRunState()
  const pipelineStart = Date.now()
  let processed = 0
  let stoppedEarly = false

  const handleCandidate = async ({ item, source, scope, pubMs }: Candidate): Promise<void> => {
    processed++
    const extracted = await extractWithDeepSeek(item, scope, runState)
    if (!extracted) { errors++; return }
    if (extracted.is_roundup || !extracted.is_region_relevant) { skipped++; return }

    const decision = decidePublication(extracted, source)
    if (decision.action === 'skip') { skipped++; return }
    if (decision.action === 'approved') approved++
    else pending++

    if (options.dryRun) {
      byScope[scope]++
      return
    }

    const nowIso = new Date().toISOString()
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
        ai_confidence:     decision.confidence,
        review_reason:     decision.reason,
        source_tier:       source.tier,
        pipeline_run_id:   options.runId || null,
        status:            decision.action,
        approved_at:       decision.action === 'approved' ? nowIso : null,
        approved_by:       null,
        published_at:      new Date(pubMs).toISOString(),
        region_scope:      scope,
      })
    if (error) {
      if (error.code !== '23505') { console.error('[news-pipeline] insert failed:', error.message); errors++ }
      else skipped++
      return
    }

    inserted++
    byScope[scope]++
    existingUrls.add(item.link)
  }

  await runPool(workList, DEEPSEEK_CONCURRENCY, handleCandidate, () => {
    if (Date.now() - pipelineStart > WALL_CLOCK_BUDGET_MS) { stoppedEarly = true; return true }
    return false
  })

  if (stoppedEarly) {
    console.warn(`[news-pipeline] wall-clock guard hit (${WALL_CLOCK_BUDGET_MS}ms) — processed ${processed}/${workList.length}; remainder deferred.`)
  }

  const qualified = options.dryRun ? approved + pending : inserted
  console.log(`[news-pipeline] complete. fetched=${fetched} processed=${processed} qualified=${qualified} inserted=${inserted} approved=${approved} pending=${pending} scopes=${JSON.stringify(byScope)} skipped=${skipped} errors=${errors}${options.dryRun ? ' [dry-run]' : ''}${stoppedEarly ? ' [stopped early]' : ''}`)
  return { fetched, processed, new: inserted, approved, pending, skipped, errors, byScope, sourceHealth, stoppedEarly, dryRun: !!options.dryRun }
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

  // Keep the same 40/40/20 editorial balance used during discovery.
  const seaItems = items.filter(i => (i.region_scope || 'sea') === 'sea')
  const apacItems = items.filter(i => i.region_scope === 'apac')
  const globalItems = items.filter(i => i.region_scope === 'global')

  const fmtItem = (it: typeof items[number], i: number) =>
    `${i + 1}. [${it.category}] ${it.company_name || '(no company)'} · ${it.sector || '?'} · ${it.country || '?'} · ${it.amount_usd ? '$' + (it.amount_usd / 1e6).toFixed(1) + 'M ' : ''}${it.stage || ''}${it.lead_investor ? ' · led by ' + it.lead_investor : ''} — ${it.ai_summary}`

  const seaBlock = seaItems.map(fmtItem).join('\n')
  const apacBlock = apacItems.length > 0 ? apacItems.map(fmtItem).join('\n') : '(none this week)'
  const globalBlock = globalItems.length > 0 ? globalItems.map(fmtItem).join('\n') : '(none this week)'

  const prompt = `You are the editor of RaiseSEA, writing the weekly market take for Southeast Asian startup founders.

Write a structured take with THREE parts:
1. headline — a punchy, opinionated 5-10 word headline. Example: "AI is eating SEA's funding — but the smart money is local"
2. body — ONE flowing paragraph (4-6 sentences) that touches on MULTIPLE categories this week: include 1-2 sentences on FUNDRAISING, 1-2 on TECH/product, and a sentence on POLICY and/or EXITS if notable. Weave them into one cohesive paragraph, not a list. Cite SPECIFIC numbers/companies/investors from the data.
3. takeaway — ONE actionable line for founders, starting with "What to do:" or "Watch:". Concrete. Do NOT repeat this line inside the body.

CRITICAL FOCUS RULE — 40/40/20:
- ~40% Southeast Asia: local funding, products, policy and exits.
- ~40% APAC: primarily China, Japan and South Korea, always connected to what SEA founders can learn or anticipate.
- ~20% global: only major signals with credible SEA implications.
- The headline may lead with SEA or an APAC development with a clear SEA consequence. Never lead with routine US/European news.

TONE: smart friend texting, confident, specific. AVOID cliches like "this week saw", "the ecosystem continued".

SOUTHEAST ASIA NEWS (~40%):
${seaBlock}

CHINA, JAPAN AND SOUTH KOREA NEWS (~40%):
${apacBlock}

GLOBAL NEWS (max 20%):
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
