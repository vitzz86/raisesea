import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { questionCountForDuration, type Mode, type Question, PITCH_DURATIONS, QA_DURATIONS } from '@/lib/mock-pitch'
import { distillDeckAnalysis, businessProfileHeader, MONEY_FORMAT_INSTRUCTION } from '@/lib/mock-pitch-context'

export const maxDuration = 60
export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// POST /api/mock-pitch/start
// body: { submissionId: string, mode: 'pitch'|'qa', durationMin: number }
// returns: { sessionId, questions? }
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { submissionId?: string; mode?: Mode; durationMin?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const submissionId = body.submissionId
  const mode = body.mode
  const durationMin = body.durationMin
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
  if (mode !== 'pitch' && mode !== 'qa') return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  const validDurations = mode === 'pitch' ? PITCH_DURATIONS : QA_DURATIONS
  if (!validDurations.includes(durationMin as never)) {
    return NextResponse.json({ error: 'Invalid duration for mode' }, { status: 400 })
  }

  // Load the submission and confirm ownership
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('submissions')
    .select('id, user_id, company_name, stage, sector, business_model, one_liner, problem, deck_analysis, raise_target_usd')
    .eq('id', submissionId)
    .maybeSingle()
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
  if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  if (sub.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let questions: Question[] | null = null
  if (mode === 'qa') {
    const count = questionCountForDuration(durationMin!)
    try {
      questions = await generateQuestions(sub as SubmissionForPrompt, count)
    } catch (err) {
      console.error('[mock-pitch/start] question generation failed:', err)
      return NextResponse.json({ error: 'Failed to generate questions — please try again' }, { status: 500 })
    }
  }

  const { data: created, error: insErr } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .insert({
      user_id: user.id,
      submission_id: submissionId,
      mode,
      duration_min: durationMin,
      questions: questions ?? null,
      transcript: [],
      status: 'in_progress',
    })
    .select('id, questions')
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, sessionId: created.id, questions: created.questions || [] })
}

type SubmissionForPrompt = {
  company_name: string
  stage: string | null
  sector: string | null
  business_model: string | null
  one_liner: string | null
  problem: string | null
  raise_target_usd: number | null
  deck_analysis: unknown
}

async function generateQuestions(sub: SubmissionForPrompt, count: number): Promise<Question[]> {
  const profile = businessProfileHeader(sub)
  const deckDigest = distillDeckAnalysis(sub.deck_analysis)

  const prompt = `You are a tough, experienced Southeast Asia VC partner about to interview a founder. Your job is to ask the sharpest, most specific questions you would actually ask in a real partner meeting — pulling on the exact weak spots and unexplored corners the deck analysis already surfaced.

${profile}

${deckDigest}

GENERATE EXACTLY ${count} INTERVIEW QUESTIONS.

Rules for the questions:
- Each question is 1-2 sentences max, conversational tone (how a real partner talks, not interview-prep language).
- Use the company's OWN language and numbers from the deck digest above — name their product, mention their specific stage and ask, reference the dimensions where they scored low.
- Use the PRIMARY METRIC TYPE noted above. If they're contract-based / enterprise, ask about ACV, sales cycle, logo retention — NOT MRR. If they're subscription, ask about MRR, churn, NRR. If pre-revenue, ask about design partners, LOIs, user engagement.
- Cover different areas across the ${count} questions. Don't ask 4 traction questions; mix it up across: market timing, traction/metrics, team gaps, business model defensibility, the ask + use of funds.
- Reference SPECIFIC numbers/claims from the deck. Never generic "tell me about your TAM" — instead "Your deck claims an $XB SEA market — break down the addressable slice you'll realistically capture in 3 years."
- ${MONEY_FORMAT_INSTRUCTION}

For each question:
- "q" = the question itself, conversational
- "area" = one of: Market, Traction, Team, Business model, The ask
- "context" = 1 sentence on what you're testing / why this question (for the post-session debrief)

Return STRICTLY this JSON, no markdown fences, no preamble:
{
  "questions": [
    { "q": "...", "area": "Market", "context": "..." }
  ]
}`

  const text = await callGeminiText(prompt, { maxTokens: 4096, json: true })
  const parsed = safeParseQuestions(text)
  const out = (parsed.questions || []).slice(0, count).map(q => ({
    q: String(q.q || '').trim().slice(0, 500),
    area: String(q.area || 'General').trim().slice(0, 40),
    context: q.context ? String(q.context).trim().slice(0, 300) : undefined,
  })).filter(q => q.q.length > 5)
  if (out.length < count) {
    throw new Error(`Gemini returned ${out.length} valid questions, expected ${count}`)
  }
  return out
}

function safeParseQuestions(text: string): { questions?: Question[] } {
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
  console.error('[mock-pitch/start] unparseable Gemini text, first 300 chars:', text.slice(0, 300))
  throw new Error('Gemini response was not valid JSON — please try again')
}

async function callGeminiText(prompt: string, opts: { maxTokens: number; json: boolean }): Promise<string> {
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
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: opts.maxTokens,
              ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) {
          const t = await res.text()
          if ((res.status >= 500 || res.status === 429) && attempt < 3) {
            await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1)))
            lastErr = new Error(`Gemini ${res.status}: ${t.slice(0, 150)}`); continue
          }
          throw new Error(`Gemini ${res.status}: ${t.slice(0, 150)}`)
        }
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (!text) { lastErr = new Error('Empty response'); if (attempt < 3) continue }
        return text
      } catch (err) {
        lastErr = err
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1))); continue }
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini failed')
}
