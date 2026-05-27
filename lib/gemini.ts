// lib/gemini.ts
import {
  SECTOR_MULTIPLES,
  ROUND_BENCHMARKS,
  calculateBlendedMultiple,
  buildMarketContext,
  getDilutionAssessment,
  normalizeSector,
  getRoundBenchmark,
  getValuationBySector,
  getMarketSize,
} from './intelligence-db'

// Gemini 2.5 Flash — replaces lib/claude.ts entirely
// Handles: deck extraction, deck analysis, market analysis, competitive analysis

// Gemini models — primary first, fallback after primary exhausts all retries.
// Primary: gemini-2.5-flash (fast, cheap, proven prompts).
// Fallback: gemini-2.5-pro (different fleet — if Flash is overloaded, Pro often isn't,
// and vice versa). Same prompt-behavior family (both temperature 0.1, JSON modes).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const
const buildUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// ─────────────────────────────────────────────────────────────
// Core call — text only (no search). Tries primary first; if all retries
// exhaust, falls through to fallback. Each model gets its own retry budget.
// ─────────────────────────────────────────────────────────────
async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  let lastErr: unknown = null
  for (let mi = 0; mi < MODELS.length; mi++) {
    const model = MODELS[mi]
    try {
      return await callGeminiAttempt(model, prompt, maxTokens)
    } catch (err) {
      lastErr = err
      const isLast = mi === MODELS.length - 1
      if (isLast) throw err
      console.warn(`[gemini] model ${model} exhausted retries, falling through to ${MODELS[mi + 1]}. Last error: ${err instanceof Error ? err.message : err}`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Gemini models exhausted')
}

async function callGeminiAttempt(model: string, prompt: string, maxTokens: number): Promise<string> {
  const maxAttempts = 3
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${buildUrl(model)}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
          systemInstruction: {
            parts: [{ text: 'You are a precise analyst. Return only valid JSON. Never return null, undefined or empty strings — always provide best estimates with reasoning.' }]
          }
        })
      })
      if (!res.ok) {
        const err = await res.text()
        const msg = `Gemini API error ${res.status} (model=${model}): ${err.slice(0, 200)}`
        if ((res.status >= 500 || res.status === 429) && attempt < maxAttempts) {
          const backoffMs = 1500 * Math.pow(2, attempt - 1)
          console.warn(`[gemini ${model}] attempt ${attempt}/${maxAttempts} failed (${res.status}), retrying in ${backoffMs}ms`)
          await new Promise(r => setTimeout(r, backoffMs))
          lastErr = new Error(msg)
          continue
        }
        throw new Error(msg)
      }
      const data = await res.json()
      const candidate = data.candidates?.[0]
      if (!candidate) throw new Error(`No candidates in Gemini response (model=${model})`)
      // Gemini sometimes returns a candidate without content.parts when finishReason
      // is SAFETY / MAX_TOKENS / RECITATION / OTHER. Surface a clear error so the
      // retry layer logs "Blocked by safety" instead of "Cannot read properties of undefined".
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini returned finishReason=${candidate.finishReason} (model=${model})`)
      }
      const parts = candidate.content?.parts
      if (!Array.isArray(parts)) {
        throw new Error(`Gemini response missing content.parts (model=${model}, finishReason=${candidate.finishReason || 'none'})`)
      }
      return parts.map((p: { text?: string }) => p.text || '').join('')
    } catch (err) {
      lastErr = err
      if (attempt === maxAttempts) throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`callGemini failed after retries (model=${model})`)
}

// ─────────────────────────────────────────────────────────────
// Core call — with Google Search grounding.
// Tries primary model first; if all 5 retries exhaust, falls through to fallback.
// Each model gets its own retry budget. Gemini grounding 5xx errors are often
// sticky for several seconds, hence the longer backoff (2/4/8/16s).
// ─────────────────────────────────────────────────────────────
async function callGeminiWithSearch(prompt: string, maxTokens = 12000): Promise<string> {
  let lastErr: unknown = null
  for (let mi = 0; mi < MODELS.length; mi++) {
    const model = MODELS[mi]
    try {
      return await callGeminiWithSearchAttempt(model, prompt, maxTokens)
    } catch (err) {
      lastErr = err
      const isLast = mi === MODELS.length - 1
      if (isLast) throw err
      console.warn(`[gemini-search] model ${model} exhausted retries, falling through to ${MODELS[mi + 1]}. Last error: ${err instanceof Error ? err.message : err}`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Gemini models exhausted (search)')
}

async function callGeminiWithSearchAttempt(model: string, prompt: string, maxTokens: number): Promise<string> {
  const maxAttempts = 5
  let lastErr: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${buildUrl(model)}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: maxTokens,
            // Note: responseMimeType cannot be used with search grounding
          },
          systemInstruction: {
            parts: [{ text: 'You are a precise market researcher. Return only valid JSON. Use Google Search to find accurate, current information. Never fabricate data — if uncertain, state confidence level.' }]
          }
        })
      })

      if (!res.ok) {
        const err = await res.text()
        const msg = `Gemini search API error ${res.status} (model=${model}): ${err.slice(0, 200)}`
        // Retry on 5xx (transient server-side) and 429 (rate limit) only
        if ((res.status >= 500 || res.status === 429) && attempt < maxAttempts) {
          // Backoff: 2s, 4s, 8s, 16s — Gemini grounding 500s are often sticky for several seconds
          const backoffMs = 2000 * Math.pow(2, attempt - 1)
          console.warn(`[gemini-search ${model}] attempt ${attempt}/${maxAttempts} failed (${res.status}), retrying in ${backoffMs}ms`)
          await new Promise(r => setTimeout(r, backoffMs))
          lastErr = new Error(msg)
          continue
        }
        throw new Error(msg)
      }

      const data = await res.json()
      const candidate = data.candidates?.[0]
      if (!candidate) throw new Error(`No candidates in Gemini response (model=${model})`)
      // Guard against finishReason=SAFETY/MAX_TOKENS/RECITATION/OTHER where content.parts
      // doesn't exist. Without this, .map() throws an unhelpful "undefined" error.
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini search returned finishReason=${candidate.finishReason} (model=${model})`)
      }
      const parts = candidate.content?.parts
      if (!Array.isArray(parts)) {
        throw new Error(`Gemini search response missing content.parts (model=${model}, finishReason=${candidate.finishReason || 'none'})`)
      }
      const text = parts.map((p: { text?: string }) => p.text || '').join('')
      // Extract JSON from search response (may have surrounding text)
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`No JSON in search response (model=${model}). Got: ${text.slice(0, 200)}`)
      return match[0]
    } catch (err) {
      lastErr = err
      // Network errors (fetch threw) — retry too
      if (attempt < maxAttempts && !(err instanceof Error && err.message.includes('Gemini search API error 4'))) {
        const backoffMs = 1500 * Math.pow(2, attempt - 1)
        console.warn(`[gemini-search ${model}] attempt ${attempt}/${maxAttempts} threw, retrying in ${backoffMs}ms:`, err instanceof Error ? err.message : err)
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }
      throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Gemini search failed after retries (model=${model})`)
}

// ─────────────────────────────────────────────────────────────
// Parse JSON helper with robust repair for LLM output
// ─────────────────────────────────────────────────────────────
function parseJSON<T>(text: string): T {
  // 1. Try direct parse
  try { return JSON.parse(text) as T } catch {}

  // 2. Strip markdown code fences (```json ... ```)
  let cleaned = text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')   // drop everything before opening fence
    .replace(/\s*```[\s\S]*$/, '')              // drop everything after closing fence
    .trim()

  // 3. If still no fences matched, isolate the JSON object: first { to last }
  if (!cleaned.startsWith('{')) {
    const start = text.indexOf('{')
    const end   = text.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('No JSON object found in response')
    cleaned = text.slice(start, end + 1)
  }

  try { return JSON.parse(cleaned) as T } catch {}

  // 4. Apply repairs for common LLM mistakes
  let repaired = cleaned
    // strip lines that are entirely // comments (line-anchored to avoid
    // clipping `//` that appear inside JSON string values like URLs)
    .replace(/^\s*\/\/.*$/gm, '')
    // strip /* block comments */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // smart quotes → straight quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // trailing commas before closing ] or }
    .replace(/,(\s*[}\]])/g, '$1')

  try { return JSON.parse(repaired) as T } catch {}

  // 5. Balance unclosed brackets/braces (handles truncation from token-limit hits)
  let opens        = (repaired.match(/\{/g) || []).length
  let closes       = (repaired.match(/\}/g) || []).length
  let bracketOpens = (repaired.match(/\[/g) || []).length
  let bracketShuts = (repaired.match(/\]/g) || []).length

  // Count unescaped quotes — odd number means we're inside an unterminated string
  // (e.g. Gemini ran out of tokens mid-string). Walk back to the last safe boundary.
  const unescapedQuotes = (repaired.match(/(?<!\\)"/g) || []).length
  const inUnterminatedString = unescapedQuotes % 2 === 1

  if (inUnterminatedString) {
    // Find the last complete property: ..."key": "value", or ..."key": <number>,
    // i.e. the last comma that's outside a string. Walk backwards from the end.
    let depth = 0
    let inStr = false
    let lastCleanBoundary = -1
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i]
      const prev = repaired[i - 1]
      if (ch === '"' && prev !== '\\') inStr = !inStr
      if (!inStr) {
        if (ch === '{' || ch === '[') depth++
        else if (ch === '}' || ch === ']') depth--
        else if (ch === ',') lastCleanBoundary = i
      }
    }
    if (lastCleanBoundary > 0) {
      repaired = repaired.slice(0, lastCleanBoundary)  // drop the broken trailing item
      // Recount after the chop
      opens        = (repaired.match(/\{/g) || []).length
      closes       = (repaired.match(/\}/g) || []).length
      bracketOpens = (repaired.match(/\[/g) || []).length
      bracketShuts = (repaired.match(/\]/g) || []).length
    }
  }

  // Close any unclosed brackets / braces in the right nesting order.
  if (opens !== closes || bracketOpens !== bracketShuts) {
    for (let i = 0; i < bracketOpens - bracketShuts; i++) repaired += ']'
    for (let i = 0; i < opens - closes; i++) repaired += '}'
  }

  try {
    return JSON.parse(repaired) as T
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    throw new Error(`parseJSON failed after repair: ${msg}\nFirst 400 chars of cleaned input: ${cleaned.slice(0, 400)}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. DECK EXTRACTION (replaces claude.ts extractFromDeck)
// ═══════════════════════════════════════════════════════════════
export interface DeckExtraction {
  company_name: string
  one_liner: string
  problem: string
  solution: string
  sector: string
  stage: string
  business_model: string
  founder_name: string
  founder_profile: string
  current_mrr_usd: number | null
  annual_revenue_usd: number | null
  estimated_revenue_usd: number | null    // Forecast based on deck signals when explicit revenue not disclosed
  revenue_basis: string | null            // Required when estimated_revenue_usd is set
  num_customers: number | null
  raise_target_usd: number | null
  traction: string
  team_summary: string
  market_size: string
  sector_profile: {
    primary_sector: string
    sector_weights: Record<string, number>
    sub_categories: string[]
    secondary_sectors: string[]
  }
}

export async function extractFromDeck(deckBase64: string, mimeType = 'application/pdf'): Promise<DeckExtraction> {
  // Tries primary model first; if all 5 retries exhaust, falls through to fallback.
  // Each model gets its own retry budget. Extraction is the most critical step
  // (everything downstream depends on it), hence the maximum tolerance for failures.
  let lastErr: unknown = null
  for (let mi = 0; mi < MODELS.length; mi++) {
    const model = MODELS[mi]
    try {
      return await extractFromDeckAttempt(model, deckBase64, mimeType)
    } catch (err) {
      lastErr = err
      const isLast = mi === MODELS.length - 1
      if (isLast) throw err
      console.warn(`[gemini-extract] model ${model} exhausted retries, falling through to ${MODELS[mi + 1]}. Last error: ${err instanceof Error ? err.message : err}`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Gemini models exhausted (extract)')
}

async function extractFromDeckAttempt(model: string, deckBase64: string, mimeType: string): Promise<DeckExtraction> {
  const maxAttempts = 5
  let lastErr: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${buildUrl(model)}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: deckBase64
                }
              },
              {
                text: `Analyze this pitch deck and extract structured data. Return ONLY valid JSON:
{
  "company_name": "company name",
  "one_liner": "one sentence description of what they do",
  "problem": "the core problem they solve",
  "solution": "their solution approach",
  "sector": "primary sector: AI/ML, Fintech, SaaS, E-commerce, D2C, Marketplace, Consumer, Healthtech, Biotech, Deep Tech, Manufacturing, Space, Cleantech, Agritech, Foodtech, Logistics, Mobility, Edtech, Proptech, Travel, Crypto/Web3, Developer Tools, Cybersecurity, Gaming, Media, B2B, Insurtech, Regtech, Other",
  "stage": "Pre-seed, Seed, Pre-series A, Series A, Series B, Series C+",
  "business_model": "B2B, B2C, B2B2C, Marketplace, D2C, SaaS, Project/Contract, Other",
  "founder_name": "founder name(s)",
  "founder_profile": "Technical founder, Domain expert, Serial entrepreneur, First-time founder, or combination",
  "current_mrr_usd": null or integer USD monthly recurring revenue (null if not shown or not subscription-based),
  "annual_revenue_usd": null or integer USD annual revenue/contract value (null if not disclosed),
  "estimated_revenue_usd": null or integer USD estimated annual revenue based on deck signals when annual_revenue_usd is null. Use deck context to forecast: "20 paying customers × estimated $500/mo per customer (typical SaaS ACV in this sector) = $120,000/yr", or "3 enterprise pilots × $50K typical pilot value = $150K", or "5 named contracts × $30K average value = $150K". If genuinely pre-revenue (truly nothing — no customers, no pilots, no LOIs, no contracts), set to null.,
  "revenue_basis": null or string explaining how estimated_revenue_usd was derived (e.g. "Derived from 20 paying customers × $500/mo estimated ACV based on Indonesian SaaS pricing benchmarks"). Required when estimated_revenue_usd is set.,
  "num_customers": null or integer number of paying customers,
  "raise_target_usd": null or integer raise amount in USD,
  "traction": "description of traction, clients, metrics shown in deck",
  "team_summary": "description of founding team and key members",
  "market_size": "any market sizing data mentioned in the deck",
  "sector_profile": {
    "primary_sector": "main sector",
    "sector_weights": {"AI/ML": 0.45, "SaaS": 0.30, "Deep Tech": 0.15, "Cleantech": 0.10},
    "sub_categories": ["Computer Vision", "Asset Integrity", "Industrial AI"],
    "secondary_sectors": ["SaaS", "Deep Tech"]
  }
}

Rules:
- current_mrr_usd: only fill if recurring subscription revenue explicitly shown. Null for project/contract businesses.
- annual_revenue_usd: total annual revenue or contract value EXPLICITLY shown in deck. Null if not disclosed.
- estimated_revenue_usd: ONLY use when annual_revenue_usd is null but the deck has SIGNALS that justify a forecast (customer count, named pilots, signed contracts, LOIs with values, etc.). Forecast conservatively. If genuinely nothing — pre-idea, pre-pilot, only TAM-side aspiration — leave as null. Pre-revenue is a real state, don't fabricate revenue out of nothing.
- revenue_basis: REQUIRED when estimated_revenue_usd is set. Explain the calculation clearly so the founder can verify.
- sector_weights must sum to 1.0
- Be precise — only extract what is actually in the deck, do not invent data`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          }
        })
      })

      if (!res.ok) {
        const err = await res.text()
        const msg = `Gemini deck extraction error ${res.status} (model=${model}): ${err.slice(0, 200)}`
        if ((res.status >= 500 || res.status === 429) && attempt < maxAttempts) {
          const backoffMs = 2000 * Math.pow(2, attempt - 1)  // 2s, 4s, 8s, 16s
          console.warn(`[gemini-extract ${model}] attempt ${attempt}/${maxAttempts} failed (${res.status}), retrying in ${backoffMs}ms`)
          await new Promise(r => setTimeout(r, backoffMs))
          lastErr = new Error(msg)
          continue
        }
        throw new Error(msg)
      }

      const data = await res.json()
      const candidate = data.candidates?.[0]
      if (!candidate) throw new Error(`No candidates in Gemini deck extraction response (model=${model})`)
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini deck extraction returned finishReason=${candidate.finishReason} (model=${model})`)
      }
      const text = candidate.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
      if (!text) {
        throw new Error(`Gemini deck extraction returned empty response (model=${model})`)
      }
      return parseJSON<DeckExtraction>(text)
    } catch (err) {
      lastErr = err
      if (attempt === maxAttempts) throw err
      const backoffMs = 2000 * Math.pow(2, attempt - 1)
      console.warn(`[gemini-extract ${model}] attempt ${attempt}/${maxAttempts} threw, retrying in ${backoffMs}ms:`, err instanceof Error ? err.message : err)
      await new Promise(r => setTimeout(r, backoffMs))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`extractFromDeck failed after all retries (model=${model})`)
}

// ═══════════════════════════════════════════════════════════════
// 2. DECK INTELLIGENCE (NEW — 8-dimension analysis)
// ═══════════════════════════════════════════════════════════════
export interface DimensionScore {
  score: number
  max_score: number
  weight_pct: number
  found: string[]
  missing: string[]
  best_practice: string
  fix_effort: string
  score_impact: string
}

export interface DeckAnalysis {
  overall_score: number
  stage: string
  investor_readiness: 'Strong' | 'Good' | 'Needs Work' | 'Weak'
  dimensions: {
    traction: DimensionScore
    problem: DimensionScore
    solution: DimensionScore
    team: DimensionScore
    market_size: DimensionScore
    business_model: DimensionScore
    financials: DimensionScore
    narrative: DimensionScore
  }
  missing_slides: { slide: string; why_critical: string; stage_requirement: string }[]
  generated_content: {
    // AI generates missing slide content
    market_slide?: string
    business_model_note?: string
  }
  priority_fixes: {
    priority: 'critical' | 'high' | 'polish'
    title: string
    description: string
    score_impact: string
    effort: string
  }[]
  revenue_metric_type: 'subscription_mrr' | 'contract_acv' | 'project_revenue' | 'pre_revenue' | 'unknown'
  // Honest assessment: does the deck content match the stage the founder is raising at?
  // The founder picked their stage in the form; we respect that choice for matching
  // and analysis weights, but separately judge whether the actual deck signals
  // (traction, customers, revenue, team maturity) support that stage.
  stage_readiness?: {
    verdict: 'ready' | 'borderline' | 'early'
    actual_signals_stage: string       // e.g. "Late Seed" or "Pre-revenue Seed"
    stage_target: string                // mirrors extraction.stage
    gap_summary: string                 // 1-2 sentence honest assessment
    typical_expectations_at_target: string[]  // what investors expect at the target stage
    bridge_actions: string[]            // specific things they need to add/build to credibly raise at target
  }
}

// Stage-adaptive weights
const STAGE_WEIGHTS: Record<string, Record<string, number>> = {
  'Pre-seed': { traction: 8, problem: 18, solution: 15, team: 25, market_size: 12, business_model: 10, financials: 8, narrative: 4 },
  'Seed':     { traction: 25, problem: 10, solution: 12, team: 20, market_size: 12, business_model: 12, financials: 6, narrative: 3 },
  'Pre-series A': { traction: 30, problem: 8, solution: 10, team: 18, market_size: 12, business_model: 12, financials: 7, narrative: 3 },
  'Series A': { traction: 35, problem: 8, solution: 10, team: 15, market_size: 12, business_model: 12, financials: 5, narrative: 3 },
  'Series B': { traction: 40, problem: 5, solution: 8, team: 10, market_size: 10, business_model: 15, financials: 8, narrative: 4 },
}

export async function analyzeDeck(
  extraction: DeckExtraction,
  deckBase64?: string
): Promise<DeckAnalysis> {
  const stage = extraction.stage || 'Seed'
  const weights = STAGE_WEIGHTS[stage] || STAGE_WEIGHTS['Seed']

  // Pull benchmark expectations for this stage so Gemini can judge gap honestly
  const stageBench = getRoundBenchmark(stage as 'Pre-seed' | 'Seed' | 'Pre-series A' | 'Series A' | 'Series B' | 'Series C+')

  // Effective revenue: explicit values from deck first, then estimated/forecasted value
  // from deck signals. Only when ALL three are null is the company truly pre-revenue.
  const explicitAnnual = extraction.annual_revenue_usd ?? (extraction.current_mrr_usd ? extraction.current_mrr_usd * 12 : null)
  const effectiveRevenue = explicitAnnual ?? extraction.estimated_revenue_usd ?? 0
  const hasAnyRevenueSignal = effectiveRevenue > 0

  // Determine revenue metric type
  let revenueType = 'unknown'
  const bm = (extraction.business_model || '').toLowerCase()
  if (bm.includes('saas') || bm.includes('subscription')) revenueType = 'subscription_mrr'
  else if (bm.includes('project') || bm.includes('contract')) revenueType = 'contract_acv'
  else if (bm.includes('b2b') && hasAnyRevenueSignal) revenueType = 'contract_acv'
  else if (!hasAnyRevenueSignal) revenueType = 'pre_revenue'

  const benchmarkBlock = stageBench ? `
TYPICAL BENCHMARKS AT ${stage.toUpperCase()} (SEA, source: ${stageBench.source || 'industry benchmarks'}):
- Typical raise range: ${stageBench.sea_raise_min_usd ? '$' + (stageBench.sea_raise_min_usd/1e6).toFixed(1) + 'M' : '?'} – ${stageBench.sea_raise_max_usd ? '$' + (stageBench.sea_raise_max_usd/1e6).toFixed(1) + 'M' : '?'} (median ~$${stageBench.sea_raise_median_usd ? (stageBench.sea_raise_median_usd/1e6).toFixed(1) : '?'}M)
- Typical pre-money: ${stageBench.sea_premoney_low_usd ? '$' + (stageBench.sea_premoney_low_usd/1e6).toFixed(1) + 'M' : '?'} – ${stageBench.sea_premoney_high_usd ? '$' + (stageBench.sea_premoney_high_usd/1e6).toFixed(1) + 'M' : '?'}
- Minimum traction expected: ${stageBench.min_traction || 'see sector norms'}
- Key risk investors evaluate: ${stageBench.key_risk || 'execution and traction'}
- Typical investor types: ${stageBench.typical_investor_types?.join(', ') || 'seed/early-stage VCs and angels'}
` : ''

  const prompt = `You are an expert pitch deck analyst evaluating a ${stage} startup for investor readiness.

Company: ${extraction.company_name}
Sector: ${extraction.sector}
Business model: ${extraction.business_model} (Revenue type: ${revenueType})
Problem: ${extraction.problem}
Solution: ${extraction.solution}
Traction: ${extraction.traction}
Team: ${extraction.team_summary}
Market size mentioned: ${extraction.market_size || 'Not mentioned'}
Revenue: ${
  extraction.annual_revenue_usd
    ? '$' + extraction.annual_revenue_usd + ' annual (explicit in deck)'
    : extraction.current_mrr_usd
      ? '$' + extraction.current_mrr_usd + '/mo (explicit in deck)'
      : extraction.estimated_revenue_usd
        ? '$' + extraction.estimated_revenue_usd + '/yr ESTIMATED (' + (extraction.revenue_basis || 'forecast from deck signals') + ')'
        : 'Pre-revenue — no explicit revenue and no signals to forecast from'
}
Raise target: ${extraction.raise_target_usd ? '$' + extraction.raise_target_usd : 'Not stated'}
${benchmarkBlock}
${extraction.estimated_revenue_usd && !extraction.annual_revenue_usd ? `NOTE on revenue: The deck did not disclose explicit revenue, so we estimated $${extraction.estimated_revenue_usd}/yr from deck signals. When scoring the Financials & ask dimension and Stage Readiness, weigh this as forecasted (not actual) — it's a credibility hint, not a confirmed metric.\n` : ''}IMPORTANT: This is a ${revenueType} business in the ${extraction.sector} sector. Do NOT use ARR/MRR metrics for contract/project businesses. Use contract value, project revenue, client count, and renewal rate instead.

For each dimension, the "best_practice" field MUST be:
  (a) Specific to the ${extraction.sector} sector and ${revenueType} business model — NOT generic startup advice
  (b) Actionable — start with a verb (e.g. "Add a slide showing...", "Quantify your...", "Name 3-5...")
  (c) Concrete on WHAT TO INCLUDE — e.g. for utilities don't say "show traction" but say "Show contract values per utility client (e.g. PUB Singapore: $X), pipeline of named utilities, and average sales cycle (typically 9-18 months for utilities)"
The "missing" array MUST list specific concrete items the founder should add, phrased as nouns the reader can paste as slide content (e.g. "Pipeline of named utility clients with stage", not "Show your pipeline").

Evaluate each dimension and return ONLY this JSON:
{
  "dimensions": {
    "traction": {
      "score": integer 0-${weights.traction},
      "max_score": ${weights.traction},
      "weight_pct": ${weights.traction},
      "found": ["concrete thing found in deck (paraphrased, ≤12 words)"],
      "missing": ["concrete item to add — phrased as a slide bullet, sector-specific"],
      "best_practice": "Sector & revenue-type specific actionable guidance. For ${extraction.sector}/${revenueType}: name the SPECIFIC metrics, contract structures, or sales cycle realities that investors expect to see.",
      "fix_effort": "X hours/days",
      "score_impact": "+X to +Y points"
    },
    "problem": { "score": 0-${weights.problem}, "max_score": ${weights.problem}, "weight_pct": ${weights.problem}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" },
    "solution": { "score": 0-${weights.solution}, "max_score": ${weights.solution}, "weight_pct": ${weights.solution}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" },
    "team": { "score": 0-${weights.team}, "max_score": ${weights.team}, "weight_pct": ${weights.team}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" },
    "market_size": { "score": 0-${weights.market_size}, "max_score": ${weights.market_size}, "weight_pct": ${weights.market_size}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" },
    "business_model": { "score": 0-${weights.business_model}, "max_score": ${weights.business_model}, "weight_pct": ${weights.business_model}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" },
    "financials": { "score": 0-${weights.financials}, "max_score": ${weights.financials}, "weight_pct": ${weights.financials}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" },
    "narrative": { "score": 0-${weights.narrative}, "max_score": ${weights.narrative}, "weight_pct": ${weights.narrative}, "found": [], "missing": [], "best_practice": "", "fix_effort": "", "score_impact": "" }
  },
  "missing_slides": [
    { "slide": "slide name", "why_critical": "why investors need this", "stage_requirement": "Required at ${stage}" }
  ],
  "generated_content": {
    "market_slide": "If no market slide exists, generate the content for one using their sector and business description. Format: TAM: [amount] ([source]) | SAM: [amount] (bottom-up: [formula]) | SOM: [amount] (Year 3 at X% capture). Return empty string if market slide already strong.",
    "business_model_note": "If no business model slide, generate a note explaining the likely model. Return empty string if already clear."
  },
  "priority_fixes": [
    { "priority": "critical", "title": "Fix title", "description": "Specific actionable fix", "score_impact": "+X pts", "effort": "X hours" },
    { "priority": "high", "title": "Fix title", "description": "Specific actionable fix", "score_impact": "+X pts", "effort": "X hours" },
    { "priority": "polish", "title": "Fix title", "description": "Specific actionable fix", "score_impact": "+X pts", "effort": "X hours" }
  ],
  "stage_readiness": {
    "verdict": "ready | borderline | early — ONE word. 'ready' if deck signals fully match ${stage} expectations. 'borderline' if 70-90% there with minor gaps. 'early' if actual signals (traction, revenue, customer count, team maturity) are closer to one stage earlier than ${stage}.",
    "actual_signals_stage": "Honest label for what stage the deck content ACTUALLY reads as based on revenue/customers/team — e.g. 'Pre-revenue Seed', 'Late Seed', 'Early Pre-Series A'. Do NOT just echo the target stage; judge from the actual numbers.",
    "stage_target": "${stage}",
    "gap_summary": "1-2 sentences. Honest, specific assessment of the gap between actual deck signals and ${stage} expectations. Reference concrete numbers from the deck. If verdict is 'ready', explain WHY they qualify (cite the signals). If 'borderline' or 'early', explain the specific shortfall (e.g. 'Pre-Series A typically requires \\\$50K+ MRR or strong contracted ARR pipeline; the deck shows X named pilots but no recurring revenue').",
    "typical_expectations_at_target": [
      "3-5 bullets — concrete metrics investors look for at ${stage} for a ${extraction.sector} ${revenueType} business in SEA. Be SPECIFIC: revenue ranges, customer counts, retention metrics, team composition, etc. Use the benchmarks above and adapt to this sector & revenue type."
    ],
    "bridge_actions": [
      "3-5 specific actions to credibly raise at ${stage}. Each starts with a verb. Tie to the actual gap. E.g. 'Convert 2-3 of your named pilots into 12-month contracts before pitching — pure pilots don't count as Series A traction.' or 'Add a CFO/finance lead — investors will not write $1.5M Series A checks without one for this sector.'"
    ]
  }
}

Score strictly — investors are not generous. Empty fields = 0 points.`

  const text = await callGemini(prompt, 16000)
  const result = parseJSON<Omit<DeckAnalysis, 'overall_score' | 'stage' | 'investor_readiness' | 'revenue_metric_type'>>(text)

  // Calculate overall score
  const overall = Object.values(result.dimensions).reduce((sum, d) => sum + d.score, 0)
  const rating: DeckAnalysis['investor_readiness'] =
    overall >= 80 ? 'Strong' : overall >= 60 ? 'Good' : overall >= 40 ? 'Needs Work' : 'Weak'

  return {
    ...result,
    overall_score: overall,
    stage,
    investor_readiness: rating,
    revenue_metric_type: revenueType as DeckAnalysis['revenue_metric_type'],
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. COMPETITIVE ANALYSIS (NEW — Gemini Search grounding)
// ═══════════════════════════════════════════════════════════════
export interface Competitor {
  name: string
  hq: string
  hq_region: 'SEA' | 'Global'
  stage: string
  total_raised_usd: number | null
  founded_year: number | null
  one_liner: string
  key_strength: string
  key_weakness: string
  similarity_pct: number
  investors: string[]
  website: string
  linkedin: string
  type: 'direct' | 'adjacent' | 'global_benchmark'
}

export interface CompetitiveAnalysis {
  sea_competitors: Competitor[]
  global_benchmarks: Competitor[]
  positioning: {
    x_axis_label: string
    x_axis_label_low?: string
    y_axis_label: string
    y_axis_label_low?: string
    positions: { name: string; x: number; y: number; is_founder: boolean }[]
  }
  moat_scores: {
    data_advantage: number
    switching_costs: number
    tech_ip: number
    regulatory: number
    network_effects: number
    brand_trust: number
    overall: number
    actions: string[]
  }
  key_differentiators: string[]
  white_space: string
  conflict_warning: string | null
}

export async function analyzeCompetitors(
  extraction: DeckExtraction,
  topInvestorNames: string[] = []
): Promise<CompetitiveAnalysis> {
  const safeCompName = extraction.company_name || 'this company'
  const safeOneLiner = extraction.one_liner    || ''
  const safeSector   = extraction.sector       || ''
  const safeBM       = extraction.business_model || ''

  const prompt = `Search the web and research competitors for this startup:

Company: ${safeCompName}
What they do: ${safeOneLiner}
Sector: ${safeSector}
Sub-categories: ${extraction.sector_profile?.sub_categories?.join(', ') || ''}
Region: Southeast Asia
Business model: ${safeBM}

WEBSITE/LINKEDIN URL RULES — these are visible to users who click through, so wrong URLs are unacceptable:
1. For EACH competitor, run a separate Google Search for "[company name] official website" — use the FIRST result from the company's own domain (not aggregator sites like Crunchbase, LinkedIn, news articles).
2. The .com vs .org vs .co.id vs .vn etc. is critical — DO NOT guess. If the official site is gohijau.org, do NOT write gohijau.com.
3. For LinkedIn, search "[company name] linkedin" and take the linkedin.com/company/[slug] URL exactly as it appears.
4. If you cannot find the official URL in your search results within 1–2 queries, set the field to null. Null is better than a hallucinated guess.
5. NEVER fabricate URLs by pattern-matching the company name to .com/.org. Use only URLs you've seen in search results.

Find and return ONLY this JSON:
{
  "sea_competitors": [
    {
      "name": "company name",
      "hq": "city, country",
      "hq_region": "SEA",
      "stage": "Seed/Series A/etc",
      "total_raised_usd": integer or null,
      "founded_year": integer or null,
      "one_liner": "what they do in one sentence",
      "key_strength": "what they do well",
      "key_weakness": "their gap or limitation",
      "similarity_pct": 0-100 overlap with ${extraction.company_name},
      "investors": ["investor1", "investor2"],
      "website": "verified URL from search results, or null if not confidently found",
      "linkedin": "verified linkedin.com/company/[slug] URL from search results, or null",
      "type": "direct"
    }
  ],
  "global_benchmarks": [
    {
      "name": "US/global company doing similar thing",
      "hq": "city, country",
      "hq_region": "Global",
      "stage": "Series B/C/Public",
      "total_raised_usd": integer or null,
      "founded_year": integer or null,
      "one_liner": "what they do",
      "key_strength": "why they succeeded globally",
      "key_weakness": "why founder can differentiate",
      "similarity_pct": 0-100,
      "investors": [],
      "website": "verified URL from search results, or null if not confidently found",
      "linkedin": "verified linkedin.com/company/[slug] URL from search results, or null",
      "type": "global_benchmark"
    }
  ],
  "positioning": {
    "x_axis_label": "the X axis high-end label (e.g. 'AI sophistication')",
    "x_axis_label_low": "the X axis low-end / opposite label (e.g. 'Basic automation')",
    "y_axis_label": "the Y axis high-end label (e.g. 'Industry specificity')",
    "y_axis_label_low": "the Y axis low-end / opposite label (e.g. 'General-purpose')",
    "positions": [
      { "name": "${extraction.company_name}", "x": 0-100, "y": 0-100, "is_founder": true },
      { "name": "competitor name", "x": 0-100, "y": 0-100, "is_founder": false }
    ]
  },
  "moat_scores": {
    "data_advantage": 0-10,
    "switching_costs": 0-10,
    "tech_ip": 0-10,
    "regulatory": 0-10,
    "network_effects": 0-10,
    "brand_trust": 0-10,
    "overall": 0-10,
    "actions": ["specific action to improve moat 1", "action 2", "action 3"]
  },
  "key_differentiators": ["differentiator 1", "differentiator 2", "differentiator 3"],
  "white_space": "one paragraph describing gaps no competitor currently fills",
  "conflict_warning": null or "investor X has backed [competitor] which directly competes. Recommend approaching after lead is secured."
}

Find 4-5 SEA direct competitors and 2-3 global benchmarks.
For conflict_warning: check if any of these investors have backed a direct competitor: ${topInvestorNames.join(', ')}`

  const text = await callGeminiWithSearch(prompt, 12000)
  return parseJSON<CompetitiveAnalysis>(text)
}

// ═══════════════════════════════════════════════════════════════
// 4. MARKET & VALUATION ANALYSIS (NEW)
// ═══════════════════════════════════════════════════════════════
export interface ValuationScenario {
  label: string
  method: string
  premoney_low_usd: number
  premoney_mid_usd: number
  premoney_high_usd: number
  multiple_low: number | null
  multiple_mid: number | null
  multiple_high: number | null
  dilution_pct: number
  notes: string
  confidence: 'high' | 'medium' | 'low'
}

export interface MarketAnalysis {
  tam_usd: number
  sam_usd: number
  som_usd: number
  tam_source: string
  sam_methodology?: string                 // legacy single field, kept for back-compat
  sam_methodology_topdown?: string         // NEW: top-down derivation
  sam_methodology_bottomup?: string        // NEW: bottom-up derivation
  som_rationale: string
  growth_rate_cagr: number
  growth_drivers: string[]
  key_countries: string[]
  methodology_grade: 'bottom-up' | 'top-down' | 'mixed' | 'missing'
  methodology_note: string
  sector_multiples: {
    sector: string
    weight: number
    ev_revenue_low: number
    ev_revenue_high: number
    ev_revenue_mid: number
    contribution: number
  }[]
  blended_multiple: { low: number; mid: number; high: number }
  revenue_base_usd: number
  revenue_type: string
  valuation_scenarios: ValuationScenario[]
  recommended_premoney: { low: number; high: number; rationale: string }
  recommended_dilution_pct: number
  sea_vs_us_vs_global: {
    sea: { low: number; high: number; median: number; note: string }
    global: { low: number; high: number; median: number; note: string }
    us_reference: { low: number; high: number; median: number; note: string }
  }
  adjustments: { factor: string; impact: string; direction: 'positive' | 'negative' }[]
  investor_appetite: string
  comparable_deals: { description: string; premoney_usd: number; raise_usd: number; year: number }[]
}

export async function analyzeMarket(
  extraction: DeckExtraction,
  raiseTargetUsd: number
): Promise<MarketAnalysis> {
  const sectorWeights = extraction.sector_profile?.sector_weights || { [extraction.sector || 'B2B']: 1.0 }
  // Revenue base: explicit > forecasted from deck signals > 0 (truly pre-revenue).
  // The forecasted value carries lower confidence but lets the revenue-based valuation
  // scenario show something useful instead of always falling back to "forward revenue assumption".
  const explicitRev = extraction.annual_revenue_usd ?? (extraction.current_mrr_usd ? extraction.current_mrr_usd * 12 : null)
  const revenueBase = explicitRev ?? extraction.estimated_revenue_usd ?? 0
  const revenueIsEstimate = !explicitRev && !!extraction.estimated_revenue_usd
  const stage = extraction.stage || 'Seed'

  // SEA sector multiples database (from our intelligence database)
  // Calculate weighted multiples from intelligence database
  const { low: blendedLow, mid: blendedMid, high: blendedHigh, breakdown } = calculateBlendedMultiple(sectorWeights)

  // Revenue-based pre-money ranges (used in prompt + fallback scenarios below)
  const revLow  = revenueBase * blendedLow
  const revMid  = revenueBase * blendedMid
  const revHigh = revenueBase * blendedHigh

  // If revenue is unknown, estimate a stage-typical forward revenue so all
  // valuation scenarios get concrete numbers rather than "$— – $—".
  // These are conservative SEA Pre-A / Seed forward-revenue benchmarks.
  const STAGE_FORWARD_REVENUE: Record<string, number> = {
    'Pre-seed':     50_000,
    'Seed':        250_000,
    'Pre-series A':500_000,
    'Series A':  1_500_000,
    'Series B':  5_000_000,
    'Series C+':15_000_000,
    'Bridge':      400_000,
    'Grant':        50_000,
  }
  const estRevenue = revenueBase > 0 ? revenueBase : (STAGE_FORWARD_REVENUE[stage] || 500_000)
  const estRevLow  = estRevenue * blendedLow
  const estRevMid  = estRevenue * blendedMid
  const estRevHigh = estRevenue * blendedHigh

  const sectorMultiplesData = breakdown.map(b => ({
    sector: b.sector,
    weight: b.weight,
    ev_revenue_low: b.multiple.low,
    ev_revenue_high: b.multiple.high,
    ev_revenue_mid: b.multiple.mid,
    contribution: b.contribution,
  }))

  // ── Pull pre-built SEA benchmarks for this sector + stage ──
  // These are sourced numbers from our intelligence database (Equidam, Crunchbase,
  // Finro, Aventis, etc. — see lib/intelligence-db.ts for citations).
  // The prompt below tells Gemini to ANCHOR on these and only override with newer data it finds.
  const dbContext = buildMarketContext(
    normalizeSector(extraction.sector || ''),
    stage,
    sectorWeights,
    raiseTargetUsd,
    revenueBase,
  )

  // Specific anchor values for use in the JSON template defaults
  const dbRoundBench  = getRoundBenchmark(stage as 'Pre-seed' | 'Seed' | 'Pre-series A' | 'Series A' | 'Series B' | 'Series C+')
  const dbSectorVal   = getValuationBySector(normalizeSector(extraction.sector || ''), stage)
  const dbMarketSize  = getMarketSize(normalizeSector(extraction.sector || ''))

  // Defensive defaults — extraction may have missing/null fields (Gemini sometimes
  // skips fields in its JSON response, especially under load). Every string access
  // below must tolerate undefined/null without throwing.
  const safeSector       = extraction.sector       || ''
  const safeCompanyName  = extraction.company_name || 'this company'
  const safeBusinessModel = extraction.business_model || ''
  const safeOneLiner     = extraction.one_liner    || ''
  const safeProblem      = extraction.problem      || ''
  const safeSolution     = extraction.solution     || ''
  const safeTraction     = extraction.traction     || ''
  const isMalaysia = safeCompanyName.toLowerCase().includes('malaysia') || safeSector.toLowerCase().includes('my')

  // ── Independent research hints when DB has no anchor for this sector/stage ──
  // For sectors not in MARKET_SIZES (SaaS, Deep Tech, Consumer, Cybersecurity) or
  // VALUATION_BY_SECTOR (Crypto/Web3, Other), tell Gemini explicitly to research
  // independently using the deck context. Keeps the analysis useful for any sector.
  const researchHints: string[] = []
  if (!dbMarketSize) {
    researchHints.push(`MARKET-SIZE RESEARCH NEEDED — no pre-built anchor for "${safeSector}" in our SEA database.
Do the following:
  1. Search the web for: "${safeSector} market size Southeast Asia 2025", "${safeSector} TAM ASEAN", "${safeSector} industry report SEA".
  2. Use the deck's problem statement ("${safeProblem.slice(0, 140)}") and target customer description to refine bottom-up sizing.
  3. Sub-categories ${(extraction.sector_profile?.sub_categories || []).slice(0, 3).join(', ') || 'none specified'} should narrow the search.
  4. Cite specific industry reports in your tam_source field (Statista, IDC, Gartner, IMARC, Mordor Intelligence, Bain SEA, McKinsey ASEAN — name the report and year).
  5. If absolutely no SEA-specific data exists, take a credible global market size and apply a SEA-share factor (typically 4–8% of global) — state the factor explicitly.`)
  }
  if (!dbSectorVal) {
    researchHints.push(`VALUATION RESEARCH NEEDED — no pre-built anchor for "${safeSector}" at "${stage}" in our SEA database.
Do the following:
  1. Search for: "${safeSector} startup funding SEA 2025", "${safeSector} ${stage} valuation Singapore Indonesia", "${safeSector} Series A pre-money ASEAN".
  2. Find 2–3 named comparable deals from the last 12 months (founders, amount raised, post-money if disclosed, lead investor).
  3. Cross-reference adjacent sectors that ARE in our database for sanity-check (use SEA Pre-A median from ROUND_BENCHMARKS context above as your floor reference).
  4. Use the deck context: ${safeOneLiner.slice(0, 120)} — find startups doing similar things.
  5. Note confidence as "low" given the missing direct anchor, and ALWAYS name the specific deals you found in the notes field.`)
  }
  const hintsBlock = researchHints.length > 0
    ? `\n\n=== INDEPENDENT RESEARCH REQUIRED (no DB anchor for this sector/stage) ===\n${researchHints.join('\n\n')}\n=== END RESEARCH GUIDANCE ===\n`
    : ''

  const prompt = `Search the web for current market data and comparable funding deals for this startup:

Company: ${safeCompanyName}
One-liner: ${safeOneLiner}
Sector: ${safeSector || '(sector not extracted — infer from business model & description)'}
Sub-categories: ${(extraction.sector_profile?.sub_categories || []).join(', ')}
Stage: ${stage}
Geography: ${isMalaysia ? 'Malaysia, SEA' : 'Southeast Asia'}
Revenue: ${revenueBase > 0 ? '$' + revenueBase + ' annually' : 'Not disclosed / pre-revenue'}
Raise target: $${raiseTargetUsd}
Business model: ${safeBusinessModel}
Problem: ${safeProblem.slice(0, 200)}
Solution: ${safeSolution.slice(0, 200)}
Traction: ${safeTraction.slice(0, 200)}
${hintsBlock}
Pre-calculated sector-weighted valuation from database:
- Blended multiple range: ${blendedLow.toFixed(1)}x – ${blendedHigh.toFixed(1)}x (mid: ${blendedMid.toFixed(1)}x)
${revenueBase > 0 ? `- Revenue-based pre-money range: $${(revLow/1e6).toFixed(1)}M – $${(revHigh/1e6).toFixed(1)}M (mid: $${(revMid/1e6).toFixed(1)}M)` : '- Revenue not disclosed — use traction/team/IP basis'}

${dbContext}

Search for:
1. SEA market size for ${extraction.sector} sector — BUT focus on the SPECIFIC sub-niche this company operates in (not the generic sector). Use the deck context:
   - Sub-categories: ${(extraction.sector_profile?.sub_categories || []).join(', ') || '(none)'}
   - Problem they solve: ${safeProblem.slice(0, 180) || 'see deck'}
   - Solution: ${safeSolution.slice(0, 180) || 'see deck'}
   For example, if the company collects Used Cooking Oil for biofuels, the relevant market is "UCO/waste-to-energy/biofuels feedstock in SEA" — NOT generic "Cleantech." Pick the tightest niche that still has credible reports.
2. Comparable funding rounds for similar companies in SEA at ${stage} stage — same niche, not generic sector
3. Global / US comparables for the same sector & stage
4. Current investor appetite for ${extraction.sector} in SEA 2025

CRITICAL RULES:
- Every valuation_scenarios entry MUST have non-zero premoney_low/mid/high values.
- **sam_methodology_bottomup MUST be a quantitative formula with concrete numbers**, e.g. "20M Indonesian households × $50 UCO/year per household = $1B" or "5,000 SME logistics operators × $30K ACV = $150M". NEVER just list qualitative drivers ("government targets, EV adoption, etc.") — that's a top-down rationale, not a bottom-up calculation.
- DB anchors below are STARTING POINTS — override them if the deck's specific niche has different (usually smaller and more credible) market size.
- ${dbMarketSize?.cagr_pct ? `DB anchor CAGR for ${safeSector} is ${dbMarketSize.cagr_pct}% — use it only if no niche-specific figure is found.` : 'Include CAGR only if you find a credible figure for this specific niche. Set to null if you cannot find a sourced number.'}

⚠ TAM/SAM/SOM LOGICAL CONSISTENCY (failure to follow this is a fatal error):
- TAM (global) ≥ SAM (SEA) ≥ SOM (Year 3). The relationship is strict — TAM is the OUTER ring, SAM is INSIDE TAM, SOM is INSIDE SAM.
- TAM is the global market for this niche. SAM is the SEA-addressable slice. SOM is the Year 3 capture.
- SEA is typically 4–30% of the global market for tech/B2B niches. So **TAM should be at minimum 3× your SAM** (since SAM ≤ ~30% of TAM in best cases), and often much larger.
- ALIGN THE SCOPES: TAM and SAM must describe the SAME niche. Don't pair "global shrimp diagnostics market" ($250M) as TAM with "SEA shrimp PCR testing for 150,000 farms" ($252M) as SAM — those are two different scopes and one is bigger than the other. Pick a TAM scope that genuinely contains the SAM scope (e.g. "global aquaculture diagnostics" or "global shrimp pathology + biosecurity").
- WORKFLOW: (1) Compute bottom-up SAM first for SEA. (2) Determine the TAM as the global equivalent of the EXACT same niche, must be ≥ 3× SAM. (3) If you cannot find a credible global TAM ≥ 3× SAM, your bottom-up SAM scope is too broad — tighten it.
- BEFORE returning the JSON, sanity-check: tam_usd ≥ sam_usd ≥ som_usd. If not, fix one of them. NEVER return SAM > TAM.

Return ONLY this JSON:
{
  "tam_usd": <integer — sizing for THIS company's specific market. DB anchor for ${safeSector}: ${dbMarketSize?.tam_usd || 'none — research independently'}, but override with niche-specific TAM if you find one>,
  "sam_usd": <integer — SEA-addressable portion of the niche TAM>,
  "som_usd": <integer — typically 1-3% of SAM in Year 3>,
  "tam_source": "${dbMarketSize?.source ? `${dbMarketSize.source} (verify and update with niche-specific source if found)` : 'name the specific report and year you used'}",
  "sam_methodology_topdown": "top-down: X% of [niche] TAM rationale with source — e.g. '20% of SEA AI in Utilities market for our serviceable segment, per IMARC 2025'",
  "sam_methodology_bottomup": "bottom-up: MUST be a NUMERICAL formula. E.g. 'N target customers (e.g. 5,000 mid-size SME logistics operators in SEA per ASEAN SME Council) × \\\$Y average annual contract value (per industry pricing benchmarks) = \\\$Z SAM'. Never qualitative drivers only.",
  "som_rationale": "how SOM was calculated (e.g. 'Year 3 capture rate of 2% × \\\$SAM, based on similar startups achieving this trajectory')",
  "growth_rate_cagr": <number or null — only include if you find a credible niche-specific CAGR. DB anchor: ${dbMarketSize?.cagr_pct || 'none'}>,
  "growth_drivers": ["driver 1 (specific to this niche, with mechanism)", "driver 2", "driver 3"],
  "key_countries": ["SG", "ID", "MY"],
  "methodology_grade": "${extraction.market_size ? 'top-down' : 'missing'}",
  "methodology_note": "One-sentence assessment of the deck's market slide quality and what to improve. If methodology_grade is 'missing', say: 'No market slide in the deck — use our TAM/SAM/SOM above as a starting point.'",
  "valuation_scenarios": [
    {
      "label": "Revenue-based (weighted sector multiple)",
      "method": "EV/Revenue",
      "premoney_low_usd": ${Math.round(estRevLow)},
      "premoney_mid_usd": ${Math.round(estRevMid)},
      "premoney_high_usd": ${Math.round(estRevHigh)},
      "multiple_low": ${blendedLow.toFixed(1)},
      "multiple_mid": ${blendedMid.toFixed(1)},
      "multiple_high": ${blendedHigh.toFixed(1)},
      "dilution_pct": ${Math.round((raiseTargetUsd / (estRevMid + raiseTargetUsd)) * 100)},
      "notes": "${revenueBase > 0 ? (revenueIsEstimate ? `Based on $${Math.round(revenueBase).toLocaleString()} ESTIMATED annual revenue (deck did not disclose explicit revenue; forecasted from: ${extraction.revenue_basis || 'deck signals'}) × ${blendedMid.toFixed(1)}x weighted sector multiple — lower confidence given forecast` : `Based on $${Math.round(revenueBase).toLocaleString()} annual revenue × ${blendedMid.toFixed(1)}x weighted sector multiple`) : `Based on estimated forward revenue ($${Math.round(estRevenue).toLocaleString()}/yr typical for ${stage}) × ${blendedMid.toFixed(1)}x weighted sector multiple`}",
      "confidence": "${revenueBase > 0 ? (revenueIsEstimate ? 'medium' : 'high') : 'low'}"
    },
    {
      "label": "SEA comparables",
      "method": "Market comparison",
      "premoney_low_usd": ${dbSectorVal?.sea_premoney_low_usd || dbRoundBench?.sea_premoney_low_usd || 3000000},
      "premoney_mid_usd": ${dbSectorVal?.sea_premoney_median_usd || dbRoundBench?.sea_premoney_median_usd || 6000000},
      "premoney_high_usd": ${dbSectorVal?.sea_premoney_high_usd || dbRoundBench?.sea_premoney_high_usd || 10000000},
      "multiple_low": null,
      "multiple_mid": null,
      "multiple_high": null,
      "dilution_pct": <calculated dilution at mid>,
      "notes": "Based on ${extraction.sector} ${stage} deals in SEA (anchor: ${dbSectorVal?.source || dbRoundBench?.source || 'SEA benchmark database'}). OVERRIDE only if you find a more recent named comparable in your web search.",
      "confidence": "${dbSectorVal?.confidence || 'medium'}"
    },
    {
      "label": "Traction & client quality basis",
      "method": "Qualitative adjustment",
      "premoney_low_usd": <fill: revenue-based low adjusted by traction/client/IP (typically ±10-25%)>,
      "premoney_mid_usd": <fill: revenue-based mid adjusted by traction/client/IP>,
      "premoney_high_usd": <fill: revenue-based high adjusted by traction/client/IP>,
      "multiple_low": null,
      "multiple_mid": null,
      "multiple_high": null,
      "dilution_pct": <calculated dilution at mid>,
      "notes": "Premium/discount applied for client logos, team strength and IP defensibility. State the actual % adjustment used.",
      "confidence": "medium"
    },
    {
      "label": "Global benchmark",
      "method": "Global comps × SEA discount",
      "premoney_low_usd": ${dbSectorVal?.global_premoney_ref_usd ? Math.round(dbSectorVal.global_premoney_ref_usd * 0.5) : 6000000},
      "premoney_mid_usd": ${dbSectorVal?.global_premoney_ref_usd ? Math.round(dbSectorVal.global_premoney_ref_usd * 0.6) : 9000000},
      "premoney_high_usd": ${dbSectorVal?.global_premoney_ref_usd ? Math.round(dbSectorVal.global_premoney_ref_usd * 0.75) : 12000000},
      "multiple_low": null,
      "multiple_mid": null,
      "multiple_high": null,
      "dilution_pct": <calculated dilution at mid>,
      "notes": "US/global ${stage} ${extraction.sector} median × 0.6 SEA discount",
      "confidence": "low"
    },
    {
      "label": "US equivalent (reference)",
      "method": "US comps (no discount)",
      "premoney_low_usd": ${dbSectorVal?.global_premoney_ref_usd ? Math.round(dbSectorVal.global_premoney_ref_usd * 0.85) : 10000000},
      "premoney_mid_usd": ${dbSectorVal?.global_premoney_ref_usd ?? 15000000},
      "premoney_high_usd": ${dbSectorVal?.global_premoney_ref_usd ? Math.round(dbSectorVal.global_premoney_ref_usd * 1.3) : 20000000},
      "multiple_low": null,
      "multiple_mid": null,
      "multiple_high": null,
      "dilution_pct": <calculated dilution at mid>,
      "notes": "US ${stage} ${extraction.sector} reference (DB anchor: ${dbSectorVal?.global_premoney_ref_usd ? `$${(dbSectorVal.global_premoney_ref_usd/1e6).toFixed(0)}M median, source: ${dbSectorVal.source}` : 'estimate'}). DO NOT inflate above 1.4x of anchor — keep stage-appropriate.",
      "confidence": "low"
    }
  ],
  "recommended_premoney": {
    "low": integer,
    "high": integer,
    "rationale": "Be SPECIFIC. State (a) which 2-3 valuation_scenarios above were weighted most heavily and roughly what weights (e.g. 'SEA comparables 50% + Traction & client quality 30% + Revenue-based 20%'), (b) WHY those weights are appropriate for a ${stage} ${extraction.sector} company in SEA right now (current funding climate, traction signal, sector premium/discount), and (c) the specific bridge from those weighted inputs to the final low and high numbers. Avoid generic phrases like 'reflects market sentiment' — be concrete."
  },
  "recommended_dilution_pct": number,
  "sea_vs_us_vs_global": {
    "sea":    { "low": integer, "high": integer, "median": integer, "note": "SEA context" },
    "global": { "low": integer, "high": integer, "median": integer, "note": "Global context" },
    "us_reference": { "low": integer, "high": integer, "median": integer, "note": "US reference only" }
  },
  "adjustments": [
    { "factor": "enterprise client logos", "impact": "+20% to +35%", "direction": "positive" },
    { "factor": "solo founder risk", "impact": "-10% to -20%", "direction": "negative" }
  ],
  "investor_appetite": "current state of investor appetite for this sector in SEA 2025",
  "comparable_deals": [
    { "description": "deal description", "premoney_usd": integer, "raise_usd": integer, "year": 2024 }
  ]
}

Fill ALL scenario values with real numbers from your search. Make comparable_deals specific and real.`

  const text = await callGeminiWithSearch(prompt, 12000)
  const result = parseJSON<Omit<MarketAnalysis, 'sector_multiples' | 'blended_multiple' | 'revenue_base_usd' | 'revenue_type'>>(text)

  // ── Sanity-check TAM ≥ SAM ≥ SOM ──
  // Even with the prompt rule, Gemini sometimes returns SAM > TAM when the bottom-up
  // niche calculation exceeds the cited generic TAM. Fix it deterministically here.
  if (result.sam_usd && result.tam_usd && result.sam_usd > result.tam_usd) {
    console.warn(`[analyzeMarket] SAM (${result.sam_usd}) > TAM (${result.tam_usd}) — scaling TAM to 3× SAM as a defensive fix. Source citation may be misaligned with bottom-up scope.`)
    // Scale TAM to be at least 3× SAM (since SEA is typically ≤ 30% of global for this kind of niche)
    result.tam_usd = result.sam_usd * 3
    // Annotate the methodology note so users know this was corrected
    const correctionNote = ` [Note: original TAM source was scoped narrower than the bottom-up SAM; TAM scaled to 3× SAM for logical consistency. Re-check the source for the actual global niche size.]`
    result.methodology_note = (result.methodology_note || '') + correctionNote
  }
  if (result.som_usd && result.sam_usd && result.som_usd > result.sam_usd) {
    console.warn(`[analyzeMarket] SOM (${result.som_usd}) > SAM (${result.sam_usd}) — capping SOM at 5% of SAM.`)
    result.som_usd = Math.round(result.sam_usd * 0.05)
  }

  return {
    ...result,
    sector_multiples: sectorMultiplesData,
    blended_multiple: { low: blendedLow, mid: blendedMid, high: blendedHigh },
    revenue_base_usd: revenueBase,
    revenue_type: extraction.business_model,
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. INVESTOR FUZZY MATCH (replaces claude.ts version)
// ═══════════════════════════════════════════════════════════════
export async function fuzzyMatchInvestors(
  extractedNames: string[],
  dbNames: string[]
): Promise<Record<string, string>> {
  if (extractedNames.length === 0) return {}
  const prompt = `Match these investor names from a pitch deck to the closest names in our database.
Deck names: ${JSON.stringify(extractedNames)}
Database names: ${JSON.stringify(dbNames.slice(0, 200))}
Return JSON: { "deck_name": "database_name" } for each match found. Only include confident matches.`

  try {
    const text = await callGemini(prompt, 2048)
    return parseJSON<Record<string, string>>(text)
  } catch {
    return {}
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. COMBINED ANALYSIS RUNNER
// ═══════════════════════════════════════════════════════════════
export interface FullAnalysis {
  extraction: DeckExtraction
  deck_analysis: DeckAnalysis | null
  market_analysis: MarketAnalysis | null
  competitive_analysis: CompetitiveAnalysis | null
}

export async function runFullAnalysis(
  deckBase64: string,
  raiseTargetUsd: number,
  topInvestorNames: string[] = [],
  mimeType = 'application/pdf',
  // Form values override extraction for stage + sector. The founder explicitly
  // selected these — they know their own raise stage, the AI may misread the deck
  // (especially when traction is low, Gemini tends to classify it as Seed even when
  // the founder is intentionally raising as Pre-Series A or Series A).
  formOverrides?: { stage?: string; sector?: string }
): Promise<FullAnalysis> {
  // Step 1: Extract (sequential — others depend on this)
  const rawExtraction = await extractFromDeck(deckBase64, mimeType)

  // Apply form overrides on top of extraction BEFORE the 3 analyses run, so that
  // deck-score weights (stage-adapted), market sizing (stage + sector specific),
  // and competitive analysis (sector context) all use the founder-stated values.
  const extraction: DeckExtraction = {
    ...rawExtraction,
    stage:  formOverrides?.stage  || rawExtraction.stage,
    sector: formOverrides?.sector || rawExtraction.sector,
  }
  if (formOverrides?.stage && rawExtraction.stage && formOverrides.stage !== rawExtraction.stage) {
    console.log(`[runFullAnalysis] form stage "${formOverrides.stage}" overrides extracted "${rawExtraction.stage}"`)
  }
  if (formOverrides?.sector && rawExtraction.sector && formOverrides.sector !== rawExtraction.sector) {
    console.log(`[runFullAnalysis] form sector "${formOverrides.sector}" overrides extracted "${rawExtraction.sector}"`)
  }

  // Steps 2-4: Run in parallel, but tolerate individual failures.
  // A failure in (say) analyzeDeck should not wipe out market + competitive results.
  const [deckRes, marketRes, compRes] = await Promise.allSettled([
    analyzeDeck(extraction),
    analyzeMarket(extraction, raiseTargetUsd),
    analyzeCompetitors(extraction, topInvestorNames),
  ])

  const unwrap = <V>(label: string, r: PromiseSettledResult<V>): V | null => {
    if (r.status === 'fulfilled') return r.value
    console.error(`[runFullAnalysis] ${label} failed:`, r.reason)
    return null
  }

  return {
    extraction,
    deck_analysis:        unwrap('analyzeDeck',        deckRes),
    market_analysis:      unwrap('analyzeMarket',      marketRes),
    competitive_analysis: unwrap('analyzeCompetitors', compRes),
  }
}
