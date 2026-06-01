import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Debrief, DimensionScore, PitchTurn, QATurn, Question, ContentDimension, QuestionBreakdown, SuggestedQuestion, PriorityFix } from '@/lib/mock-pitch'
import { distillDeckAnalysis, businessProfileHeader, MONEY_FORMAT_INSTRUCTION } from '@/lib/mock-pitch-context'

export const maxDuration = 120
export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const MAX_TRANSCRIPT_CHARS = 12000
const MAX_TOKENS_CORE = 16384
const MAX_TOKENS_SUGGESTED = 4096

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { sessionId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const { data: session, error: sErr } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .select('*, submissions(company_name, stage, sector, business_model, one_liner, problem, raise_target_usd, deck_analysis)')
    .eq('id', body.sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sub = (session as { submissions?: SubInfo }).submissions || {}
  let debrief: Debrief
  try {
    if (session.mode === 'pitch') {
      debrief = await generatePitchDebrief(session.transcript as PitchTurn[] || [], sub, session.duration_min)
    } else {
      debrief = await generateQADebrief(session.questions as Question[] || [], session.transcript as QATurn[] || [], sub)
    }
  } catch (err) {
    console.error('[debrief] gen failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate debrief' }, { status: 500 })
  }

  await supabaseAdmin
    .from('mock_pitch_sessions')
    .update({ debrief, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', body.sessionId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, debrief })
}

type SubInfo = {
  company_name?: string; stage?: string; sector?: string; business_model?: string;
  one_liner?: string; problem?: string; raise_target_usd?: number;
  deck_analysis?: unknown
}

// ─── Pitch debrief ─────────────────────────────────────────────────
async function generatePitchDebrief(turns: PitchTurn[], sub: SubInfo, durationMin: number): Promise<Debrief> {
  const bySlide: Record<number, { texts: string[]; seconds: number }> = {}
  let totalSeconds = 0
  for (const t of turns) {
    if (!bySlide[t.slide]) bySlide[t.slide] = { texts: [], seconds: 0 }
    bySlide[t.slide].texts.push(t.text)
    bySlide[t.slide].seconds += t.duration_seconds || 0
    totalSeconds += t.duration_seconds || 0
  }
  const slideLines = Object.entries(bySlide).map(([s, d]) => {
    return `Slide ${s} (~${Math.round(d.seconds)}s): ${d.texts.join(' ').slice(0, 600) || '(silent)'}`
  }).join('\n').slice(0, MAX_TRANSCRIPT_CHARS)

  const profile = businessProfileHeader(sub)
  const deckDigest = distillDeckAnalysis(sub.deck_analysis)

  const prompt = `You are an experienced Southeast Asia VC partner who just listened to a founder's ${durationMin}-minute mock pitch. Give a brutally honest, specific debrief.

${profile}

${deckDigest}

THE FOUNDER'S ACTUAL PITCH (transcribed per slide):
${slideLines || '(no transcript captured — founder may have been silent)'}

Time speaking: ~${Math.round(totalSeconds)}s of ${durationMin * 60}s available.

Score 0-100 (consistent with deck analysis). Use SPECIFIC quotes from the transcript. Use the PRIMARY METRIC TYPE from the deck analysis above — judge their pitch against the metrics that actually matter for THIS company (e.g. don't penalize a B2B SaaS founder for not mentioning MAU). Don't be generic.

${MONEY_FORMAT_INSTRUCTION}

Investor readiness: Strong (80+), Good (65-79), Needs Work (45-64), Weak (<45).

Return STRICTLY this JSON, no markdown fences, no preamble. Keep each text field concise (bullets 1 sentence, best_practice 1-2 sentences):
{
  "overall_score": <0-100>,
  "investor_readiness": "Strong | Good | Needs Work | Weak",
  "summary": "<2-3 sentence takeaway>",
  "dimensions": {
    "opening":      { "score": <0-100>, "max_score": 100, "weight_pct": 15, "found": ["..."], "missing": ["..."], "best_practice": "...", "fix_effort": "low|medium|high", "score_impact": "+X points" },
    "storytelling": { "score": <0-100>, "max_score": 100, "weight_pct": 20, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "pacing":       { "score": <0-100>, "max_score": 100, "weight_pct": 15, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "clarity":      { "score": <0-100>, "max_score": 100, "weight_pct": 20, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "confidence":   { "score": <0-100>, "max_score": 100, "weight_pct": 15, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "coverage":     { "score": <0-100>, "max_score": 100, "weight_pct": 15, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." }
  },
  "content_dimensions": [
    { "key": "traction",       "label": "Traction",              "score": <0-100>, "slides": [<every slide # where addressed>], "found": ["<what they actually SAID, transcript-grounded>"], "missing": ["<what was weak or absent>"], "best_practice": "<sector-specific how to deliver this well>" },
    { "key": "problem",        "label": "Problem & opportunity", "score": <0-100>, "slides": [...], "found": [...], "missing": [...], "best_practice": "..." },
    { "key": "solution",       "label": "Solution & product",    "score": <0-100>, "slides": [...], "found": [...], "missing": [...], "best_practice": "..." },
    { "key": "team",           "label": "Team",                  "score": <0-100>, "slides": [...], "found": [...], "missing": [...], "best_practice": "..." },
    { "key": "market_size",    "label": "Market size",           "score": <0-100>, "slides": [...], "found": [...], "missing": [...], "best_practice": "..." },
    { "key": "business_model", "label": "Business model",        "score": <0-100>, "slides": [...], "found": [...], "missing": [...], "best_practice": "..." },
    { "key": "financials",     "label": "Financials & ask",      "score": <0-100>, "slides": [...], "found": [...], "missing": [...], "best_practice": "..." }
  ],
  "priority_fixes": [
    { "priority": "critical|high|polish", "title": "<short>", "description": "...", "score_impact": "+X points", "effort": "low|medium|high" }
  ],
  "actionable_next_steps": ["...", "..."]
}

Dimensions (DELIVERY — how they pitched, score 0-100):
- opening: hooked in 15s? Name+company+what+for-whom clear?
- storytelling: narrative arc vs facts? Pulled the listener in?
- pacing: time per slide, filler words, momentum (call out silent slides + slides that ran long)
- clarity: how clear the words, sentences, claims (flag transcription-suggestive ambiguity)
- confidence: declarative vs hedging — quote specific weak phrases ("we sort of think...")
- coverage: did they hit problem / solution / market / team / traction / ask?

content_dimensions (CONTENT — what they covered, scored like the deck analysis):
- Score EACH of the 7 dimensions 0-100 based on how well the founder addressed it IN THEIR SPOKEN PITCH (not the deck).
- "slides": list EVERY slide number where they touched this dimension. If they covered it across multiple slides, include ALL of them. If they never addressed it, use an empty array [] and score it low.
- "found": concrete things they actually said (transcript-grounded, paraphrase ≤12 words). Empty if absent.
- "missing": specific concrete items they should have said, phrased as nouns the founder can act on (sector-specific). 
- "best_practice": actionable, sector-specific guidance starting with a verb — what a strong founder pitching THIS company would say for this dimension. Not generic.
- Use the PRIMARY METRIC TYPE from the deck analysis — judge against the metrics that matter for THIS company.

Do NOT pad. Be specific and quote the founder. Score strictly — investors are not generous.`

  const text = await callGemini(prompt, MAX_TOKENS_CORE)
  return parsePitchDebrief(text)
}

// ─── Q&A debrief — NEW conversational dimensions, split into 2 calls ──
async function generateQADebrief(questions: Question[], turns: QATurn[], sub: SubInfo): Promise<Debrief> {
  const pairs = questions.map((q, i) => {
    const turn = turns.find(t => t.q === q.q) || turns[i]
    return `Q (${q.area}): ${q.q}\nA: ${(turn?.a || '(no answer captured)').slice(0, 800)}`
  }).join('\n\n').slice(0, MAX_TRANSCRIPT_CHARS)

  const profile = businessProfileHeader(sub)
  const deckDigest = distillDeckAnalysis(sub.deck_analysis)

  // ── Call 1: core debrief with CONVERSATIONAL dimensions ──
  const corePrompt = `You are an experienced Southeast Asia VC partner who just interviewed a founder. Give a brutally honest, specific debrief focused on HOW WELL they answered the questions they were actually asked — not on areas you didn't probe.

${profile}

${deckDigest}

THE INTERVIEW (your questions + founder's answers):
${pairs}

Score 0-100 (consistent with deck analysis). Use SPECIFIC quotes from the founder's answers. Reference the PRIMARY METRIC TYPE above — judge their answers against the metrics that matter for THIS company. Don't be generic.

${MONEY_FORMAT_INSTRUCTION}

Investor readiness: Strong (80+), Good (65-79), Needs Work (45-64), Weak (<45).

CRITICAL: The dimensions below score CONVERSATIONAL PERFORMANCE, not content coverage. A Q&A only covers 2-4 questions, so it's unfair to score "did they cover Market thoroughly?" when you never asked. Instead score: when they were asked something, did they answer it well?

Return STRICTLY this JSON, no markdown fences, no preamble. Keep each text field concise (bullets 1 sentence, best_practice 1-2 sentences):
{
  "overall_score": <0-100>,
  "investor_readiness": "Strong|Good|Needs Work|Weak",
  "summary": "<2-3 sentence takeaway>",
  "dimensions": {
    "relevance":    { "score": <0-100>, "max_score": 100, "weight_pct": 25, "found": ["<concrete with quote>"], "missing": ["..."], "best_practice": "...", "fix_effort": "low|medium|high", "score_impact": "+X points" },
    "specificity":  { "score": <0-100>, "max_score": 100, "weight_pct": 25, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "clarity":      { "score": <0-100>, "max_score": 100, "weight_pct": 15, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "confidence":   { "score": <0-100>, "max_score": 100, "weight_pct": 15, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "conciseness":  { "score": <0-100>, "max_score": 100, "weight_pct": 10, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." },
    "depth":        { "score": <0-100>, "max_score": 100, "weight_pct": 10, "found": [...], "missing": [...], "best_practice": "...", "fix_effort": "...", "score_impact": "..." }
  },
  "per_question": [
    {
      "q": "<exact question>",
      "area": "Market|Traction|Team|Business model|The ask",
      "score": <0-100>,
      "what_worked": ["<specific with quote>"],
      "what_was_missing": ["..."],
      "best_practice_answer": "<2-3 sentence concrete model answer using THIS company's specifics>",
      "how_to_be_better": "<tailored advice for what THIS founder said>",
      "follow_ups": [
        { "q": "<likely follow-up based on the answer>", "talking_points": ["...", "...", "..."] }
      ]
    }
  ],
  "priority_fixes": [
    { "priority": "critical|high|polish", "title": "<short>", "description": "...", "score_impact": "+X points", "effort": "low|medium|high" }
  ],
  "actionable_next_steps": ["...", "..."]
}

Dimensions (CONVERSATIONAL — score how they answered, not what topics weren't covered):
- relevance: Did the answer actually address what was asked? Or did they answer a different (easier) question? Quote where they hit or missed the actual question.
- specificity: Concrete numbers, names, examples vs vague hand-waving. "We have 12 paying customers including Acme and ContraCo" vs "we're getting traction."
- clarity: Could you follow the answer? Were sentences clean and logical, or rambling?
- confidence: Declarative ("we WILL hit $1M ARR by Q4 because...") vs hedging ("we sort of think maybe we could..."). Quote weak phrases.
- conciseness: Did they get to the point in 30-60s, or ramble / drop silent / start over?
- depth: When pushed, did they go beyond surface-level? Mention second-order effects, edge cases, the "why" behind their answer?

per_question: ONE entry per question asked (silent answers too). Each gets 1-2 follow_ups with 2-3 talking points each.
Be specific. Quote them. Don't pad.`

  const coreText = await callGemini(corePrompt, MAX_TOKENS_CORE)
  const core = parseQADebrief(coreText)

  // ── Call 2: suggested_questions (separate, lighter budget) ──
  try {
    const suggestedPrompt = `You are an experienced Southeast Asia VC partner. Based on this company's profile and what the deck analysis flagged, list 5 ADDITIONAL questions investors are very likely to ask in a real pitch meeting. Cover different areas: Market, Traction, Team, Business model, The ask.

${profile}

${deckDigest}

For each question:
- Make it specific to this company (reference their actual numbers, claims, gaps)
- Use the PRIMARY METRIC TYPE — don't ask about MRR if they're contract-based, etc.
- Provide 3-4 concrete talking points the founder should cover in a strong answer
- ${MONEY_FORMAT_INSTRUCTION}

Return STRICTLY this JSON, no markdown fences:
{
  "suggested_questions": [
    { "area": "Market|Traction|Team|Business model|The ask", "q": "<specific question>", "talking_points": ["...", "...", "..."] }
  ]
}

EXACTLY 5 questions, one per area where possible.`

    const suggestedText = await callGemini(suggestedPrompt, MAX_TOKENS_SUGGESTED)
    const parsed = safeParse(suggestedText)
    core.suggested_questions = validSuggested(parsed.suggested_questions)
  } catch (err) {
    console.warn('[debrief] suggested_questions call failed (non-fatal):', err)
  }

  return core
}

// ─── Parsers ───────────────────────────────────────────────────────
function parsePitchDebrief(text: string): Debrief {
  const parsed = safeParse(text)
  return {
    overall_score: clamp(parsed.overall_score, 0, 100),
    investor_readiness: validReadiness(parsed.investor_readiness),
    summary: String(parsed.summary || '').slice(0, 2000),
    dimensions: validDimensions(parsed.dimensions),
    content_dimensions: validContentDimensions(parsed.content_dimensions),
    priority_fixes: validPriorityFixes(parsed.priority_fixes),
    actionable_next_steps: validStrArr(parsed.actionable_next_steps, 8, 500),
  }
}

function parseQADebrief(text: string): Debrief {
  const parsed = safeParse(text)
  return {
    overall_score: clamp(parsed.overall_score, 0, 100),
    investor_readiness: validReadiness(parsed.investor_readiness),
    summary: String(parsed.summary || '').slice(0, 2000),
    dimensions: validDimensions(parsed.dimensions),
    per_question: validQuestions(parsed.per_question),
    priority_fixes: validPriorityFixes(parsed.priority_fixes),
    actionable_next_steps: validStrArr(parsed.actionable_next_steps, 8, 500),
  }
}

function safeParse(text: string): Record<string, unknown> {
  if (!text || text.trim().length === 0) throw new Error('Gemini returned empty response')
  try { return JSON.parse(text) } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { return JSON.parse(fenced[1]) } catch {}
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch {}
  }
  console.error('[debrief] unparseable Gemini text, first 300 chars:', text.slice(0, 300))
  throw new Error('Gemini response was not valid JSON — please regenerate')
}
function clamp(n: unknown, min: number, max: number): number {
  const v = Math.round(Number(n) || min)
  return Math.max(min, Math.min(max, v))
}
function validReadiness(v: unknown): Debrief['investor_readiness'] {
  const allowed: Debrief['investor_readiness'][] = ['Strong', 'Good', 'Needs Work', 'Weak']
  return allowed.includes(v as Debrief['investor_readiness']) ? v as Debrief['investor_readiness'] : 'Needs Work'
}
function validStrArr(v: unknown, max: number, perLen: number): string[] {
  if (!Array.isArray(v)) return []
  return v.map(s => String(s).slice(0, perLen)).slice(0, max)
}
function validDimensions(v: unknown): Record<string, DimensionScore> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, DimensionScore> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const d = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    out[k] = {
      score:         clamp(d.score, 0, 100),
      max_score:     clamp(d.max_score, 1, 100) || 100,
      weight_pct:    clamp(d.weight_pct, 0, 100),
      found:         validStrArr(d.found, 8, 400),
      missing:       validStrArr(d.missing, 8, 400),
      best_practice: String(d.best_practice || '').slice(0, 800),
      fix_effort:    String(d.fix_effort || 'medium').slice(0, 20),
      score_impact:  String(d.score_impact || '').slice(0, 200),
    }
  }
  return out
}
const CONTENT_DIM_LABELS: Record<string, string> = {
  traction:       'Traction',
  problem:        'Problem & opportunity',
  solution:       'Solution & product',
  team:           'Team',
  market_size:    'Market size',
  business_model: 'Business model',
  financials:     'Financials & ask',
}
function validContentDimensions(v: unknown): ContentDimension[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.map(raw => {
    const d = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const key = String(d.key || '')
    const label = CONTENT_DIM_LABELS[key] || String(d.label || key || 'Dimension').slice(0, 60)
    const slides = Array.isArray(d.slides)
      ? (d.slides as unknown[]).map(n => clamp(n, 1, 100)).filter((n, i, a) => a.indexOf(n) === i).slice(0, 50)
      : []
    return {
      key,
      label,
      score:         clamp(d.score, 0, 100),
      slides,
      found:         validStrArr(d.found, 8, 400),
      missing:       validStrArr(d.missing, 8, 400),
      best_practice: String(d.best_practice || '').slice(0, 800),
    }
  }).filter(d => CONTENT_DIM_LABELS[d.key]).slice(0, 7)
}
function validQuestions(v: unknown): QuestionBreakdown[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.map(raw => {
    const q = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      q:                    String(q.q || '').slice(0, 500),
      area:                 String(q.area || 'General').slice(0, 40),
      score:                clamp(q.score, 0, 100),
      what_worked:          validStrArr(q.what_worked, 6, 400),
      what_was_missing:     validStrArr(q.what_was_missing, 6, 400),
      best_practice_answer: String(q.best_practice_answer || '').slice(0, 1500),
      how_to_be_better:     String(q.how_to_be_better || '').slice(0, 800),
      follow_ups:           validFollowUps(q.follow_ups),
    }
  }).slice(0, 12)
}
function validFollowUps(v: unknown): { q: string; talking_points: string[] }[] {
  if (!Array.isArray(v)) return []
  return v.map(raw => {
    const f = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      q:              String(f.q || '').slice(0, 400),
      talking_points: validStrArr(f.talking_points, 6, 400),
    }
  }).filter(f => f.q.length > 0).slice(0, 4)
}
function validSuggested(v: unknown): SuggestedQuestion[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.map(raw => {
    const s = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      area:           String(s.area || 'General').slice(0, 40),
      q:              String(s.q || '').slice(0, 500),
      talking_points: validStrArr(s.talking_points, 6, 400),
    }
  }).filter(s => s.q.length > 0).slice(0, 8)
}
function validPriorityFixes(v: unknown): PriorityFix[] {
  if (!Array.isArray(v)) return []
  const allowedPri: PriorityFix['priority'][] = ['critical', 'high', 'polish']
  return v.map(raw => {
    const f = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const p = String(f.priority || 'high')
    return {
      priority:     allowedPri.includes(p as PriorityFix['priority']) ? p as PriorityFix['priority'] : 'high',
      title:        String(f.title || '').slice(0, 200),
      description:  String(f.description || '').slice(0, 800),
      score_impact: String(f.score_impact || '').slice(0, 200),
      effort:       String(f.effort || 'medium').slice(0, 40),
    }
  }).slice(0, 8)
}

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')
  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro']
  let lastErr: unknown = null
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok) {
          const t = await res.text()
          if ((res.status >= 500 || res.status === 429) && attempt < 3) {
            await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1)))
            lastErr = new Error(`Gemini ${res.status}`); continue
          }
          throw new Error(`Gemini ${res.status}: ${t.slice(0, 150)}`)
        }
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> }
        const cand = data.candidates?.[0]
        const text = cand?.content?.parts?.[0]?.text || ''
        if (cand?.finishReason === 'MAX_TOKENS' && !text.trim().endsWith('}')) {
          console.warn(`[debrief] ${model} hit MAX_TOKENS — JSON likely truncated`)
          if (attempt < 3) {
            lastErr = new Error('MAX_TOKENS truncation'); continue
          }
        }
        return text
      } catch (err) {
        lastErr = err
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1))); continue }
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini failed')
}
