// app/api/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { downloadDeck } from '@/lib/storage'
import { runFullAnalysis, fuzzyMatchInvestors } from '@/lib/gemini'
import { runMatching, normalizeCountry } from '@/lib/matching'
import { getSessionUser } from '@/lib/supabase-server'
import type { Investor } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Route segment config — App Router way to set limits
export const maxDuration = 300  // 5 minutes for Gemini analysis (Vercel/Render)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Auth: middleware ensures user is logged in for /apply, but /api/submit
    // is callable directly. We treat unauthenticated submissions as legacy
    // (anonymous) so the route doesn't break, but we strongly prefer the
    // session user when present and use their email as authoritative.
    const sessionUser = await getSessionUser()

    // ── 1. Parse JSON body ──────────────────────────────────
    // (Previously this was FormData with the PDF file. The PDF is now
    // uploaded directly to Supabase via signed URL — see /api/upload/signed-url.
    // We receive just the storage path here and download it back for Gemini.)
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const companyName       = (body.company_name        as string) || ''
    const country           = (body.country             as string) || ''
    const stageRaw          = (body.stage               as string) || ''
    const sectorRaw         = (body.sector              as string) || ''
    const raiseTargetStr    = (body.raise_target_usd    as string) || ''
    const businessModel     = (body.business_model      as string) || ''
    const founderName       = (body.founder_name        as string) || ''
    // Authenticated user's email always wins. Body value used only when
    // there's no session (legacy/anonymous path).
    const founderEmail      = sessionUser?.email || ((body.founder_email as string) || '')
    const founderLinkedin   = (body.founder_linkedin    as string) || ''
    const currentInvestors  = (body.current_investors   as string) || ''
    const storagePath       = (body.storage_path        as string) || ''
    const uniqueSlug        = (body.slug                as string) || ''

    // Normalize stage + sector to canonical strings so all downstream lookups
    // (matching's STAGE_LEVEL, intelligence-db's VALUATION_BY_SECTOR/MARKET_SIZES) match.
    const stage  = canonicalStage(stageRaw)
    const sector = canonicalSector(sectorRaw)

    const raiseTarget = parseInt(raiseTargetStr || '0')

    if (!founderEmail || !companyName || !storagePath || !uniqueSlug) {
      return NextResponse.json(
        { error: 'Missing required fields: company_name, founder_email, storage_path, slug' },
        { status: 400 }
      )
    }

    // Validate slug + storagePath cross-consistency to prevent path manipulation
    // (e.g., client passing someone else's slug with own storage path).
    if (!/^[a-zA-Z0-9_-]+$/.test(uniqueSlug)) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 })
    }
    if (!storagePath.endsWith(`/${uniqueSlug}.pdf`)) {
      return NextResponse.json(
        { error: 'Storage path does not match slug' },
        { status: 400 }
      )
    }

    // ── 2. Download deck from Storage (uploaded by client via signed URL) ──
    // This adds a round-trip vs the old in-memory flow, but enables Vercel
    // deployment (file never passes through the API route's 4.5MB limit).
    const deckDownloadPromise = downloadDeck(storagePath)

    // ── 3. Get investor list (in parallel with deck download) ────────────
    const investorsPromise = supabase
      .from('investors')
      .select('id, name, invest_stages, invest_sectors, invest_countries, ticket_min_usd, ticket_max_usd, investment_thesis, business_model_pref, founder_preference, min_traction_stage, is_active, active_confidence, hq_in_sea, type, hq_country, hq_city, description, value_add, co_investors, notable_portfolio, invest_locations_detail, top_sectors_detail, investment_strategy, follow_on_investment, ownership_preference, investment_instrument, num_investments, leadership_name, leadership_title, leadership_linkedin, website, linkedin')
      .order('active_confidence', { ascending: false })

    const [deckResult, investorsResult] = await Promise.all([
      deckDownloadPromise,
      investorsPromise,
    ])

    if (deckResult.error || !deckResult.buffer) {
      console.error('[/api/submit] deck download failed:', deckResult.error)
      return NextResponse.json(
        { error: `Failed to read uploaded deck: ${deckResult.error}` },
        { status: 500 }
      )
    }

    const { data: investors, error: invErr } = investorsResult
    if (invErr) throw invErr

    const deckBase64 = deckResult.buffer.toString('base64')
    const mimeType   = 'application/pdf'

    // Supabase's .select() with a column list returns a partial shape;
    // cast back to Investor[] since we know which fields we asked for.
    const investorList = (investors || []) as unknown as Investor[]

    // ── 4. Run Gemini analysis (deck extract + 3 parallel analyses) ─
    // Pass canonicalized form stage/sector as overrides — these win over Gemini's
    // interpretation of the deck (founder knows their own stage).
    let fullAnalysis
    try {
      const topInvestorNames = investorList.slice(0, 100).map(i => i.name)
      fullAnalysis = await runFullAnalysis(
        deckBase64,
        raiseTarget,
        topInvestorNames,
        mimeType,
        { stage: stage || undefined, sector: sector || undefined },
      )
    } catch (err) {
      console.error('Gemini analysis failed:', err)
      // Continue with degraded mode — save what we have
      fullAnalysis = null
    }

    const extraction = fullAnalysis?.extraction

    // ── 6. Resolve "current investors" the founder typed into DB IDs ──
    // These get excluded from match results, and their co_investors become warm intros.
    const currentInvestorNames = (currentInvestors || '').split(',').map(s => s.trim()).filter(Boolean)
    let matchedCurrent: Array<{ id: string; name: string; co_investors: string }> = []

    if (currentInvestorNames.length > 0) {
      // Lightweight fuzzy match — substring both ways. Falls back to exact lowercase match.
      matchedCurrent = currentInvestorNames.map(input => {
        const inputLower = input.toLowerCase()
        const found = investorList.find(inv => {
          const n = inv.name.toLowerCase()
          return n === inputLower || n.includes(inputLower) || inputLower.includes(n)
        })
        return found ? { id: found.id, name: found.name, co_investors: (found as Investor & { co_investors?: string }).co_investors || '' } : null
      }).filter(Boolean) as Array<{ id: string; name: string; co_investors: string }>
    }

    const excludedIds = matchedCurrent.map(m => m.id)
    console.log(`[match] current investors typed: ${currentInvestorNames.length}, matched to DB: ${matchedCurrent.length}, will exclude: ${excludedIds.join(', ')}`)

    // ── 7. Investor matching ─────────────────────────────────────────
    // Convert "Singapore" → "SG" so we can compare against invest_countries (ISO codes).
    const countryISO = normalizeCountry(country)

    // Stage + sector: the form value WINS over extraction.
    // The founder explicitly selected these from a dropdown — they know their own raising
    // stage and sector classification. Gemini's deck extraction may downgrade Pre-Series A
    // to Seed when traction is low, or misclassify the sector. Form is authoritative;
    // extraction is the fallback only when form was empty for some reason.
    const finalSector = canonicalSector(sector || extraction?.sector || '')
    const finalStage  = canonicalStage(stage  || extraction?.stage  || '')
    if (extraction?.stage && extraction.stage !== finalStage) {
      console.log(`[match] form stage "${finalStage}" differs from extracted "${extraction.stage}" — using form value`)
    }
    if (extraction?.sector && canonicalSector(extraction.sector) !== finalSector) {
      console.log(`[match] form sector "${finalSector}" differs from extracted "${extraction.sector}" — using form value`)
    }

    const founderData = {
      company_name:       extraction?.company_name   || companyName,
      sector:             finalSector,
      sector_profile:     extraction?.sector_profile,
      stage:              finalStage,
      business_model:     extraction?.business_model || businessModel      || '',
      raise_target_usd:   raiseTarget,
      country:            countryISO,
      founder_profile:    extraction?.founder_profile                      || '',
      current_mrr_usd:    extraction?.current_mrr_usd    ?? 0,
      annual_revenue_usd: extraction?.annual_revenue_usd ?? 0,
      traction:           extraction?.traction                             || '',
      excluded_investor_ids: excludedIds,
    }

    // NOTE: runMatching takes (investors, founder) — order matters.
    const matchResults = runMatching(investorList, founderData)
    console.log(`[match] ${investorList.length} investors → ${matchResults.length} matches for ${countryISO} ${founderData.stage} ${founderData.sector}`)
    const topMatches   = matchResults.slice(0, 3)
    const topMatchNames = topMatches.map((m: { investor: { name: string } }) => m.investor.name)

    // ── 8. Fuzzy match any investor names found in deck ─────
    const deckInvestorNames = extraction?.traction?.match(/[A-Z][a-zA-Z]+\s+(?:Ventures|Capital|Partners|Fund|VC|Investments)/g) || []
    const investorNameMap   = deckInvestorNames.length > 0
      ? await fuzzyMatchInvestors(deckInvestorNames, investorList.map(i => i.name))
      : {}

    // ── 9. Warm intro network: ALL co-investors of current investors ──
    // (Not just those in top matches — surface the full co-invest network.)
    const warmIntros = buildCoInvestorNetwork(matchedCurrent, investorList, excludedIds)

    // Note: deck is already in storage (uploaded by client via signed URL before
    // calling this endpoint). We use `storagePath` directly as the deck_url.
    const deckUrl = storagePath

    // ── 10. Save to Supabase ────────────────────────────────
    // uniqueSlug was provided in the request body (generated by /api/upload/signed-url)
    // so the deck filename and the /match/<slug> URL use the same identifier.

    const { data: submission, error: subErr } = await supabase
      .from('submissions')
      .insert({
        unique_slug:            uniqueSlug,
        user_id:                sessionUser?.id || null,
        company_name:           extraction?.company_name   || companyName,
        country,
        stage:                  finalStage,
        raise_target_usd:       raiseTarget,
        sector:                 finalSector,
        business_model:         extraction?.business_model || businessModel,
        founder_name:           extraction?.founder_name   || founderName,
        founder_email:          founderEmail,
        founder_linkedin:       founderLinkedin,
        founder_profile:        extraction?.founder_profile || '',
        current_mrr_usd:        extraction?.current_mrr_usd ?? null,
        annual_revenue_usd:     extraction?.annual_revenue_usd ?? null,
        one_liner:              extraction?.one_liner || '',
        problem:                extraction?.problem || '',
        ai_description:         extraction?.solution || '',
        ai_traction:            extraction?.traction || '',
        ai_market_size:         extraction?.market_size || '',
        ai_team_summary:        extraction?.team_summary || '',
        current_investors:      currentInvestors || '',
        deck_url:               deckUrl,
        match_results:          JSON.stringify(matchResults.slice(0, 20)),
        top_match_name:         topMatches[0]?.investor?.name || null,
        top_match_score:        topMatches[0]?.score || null,
        warm_intros:            JSON.stringify(warmIntros),
        sector_profile:         JSON.stringify(extraction?.sector_profile || null),
        deck_analysis:          fullAnalysis?.deck_analysis ? JSON.stringify(fullAnalysis.deck_analysis) : null,
        market_analysis:        fullAnalysis?.market_analysis ? JSON.stringify(fullAnalysis.market_analysis) : null,
        competitive_analysis:   fullAnalysis?.competitive_analysis ? JSON.stringify(fullAnalysis.competitive_analysis) : null,
        analysis_status:        fullAnalysis ? 'complete' : 'failed',
        status:                 'matched',
      })
      .select('id, unique_slug')
      .single()

    if (subErr) throw subErr

    // ── 11. Feed the learning flywheel (non-blocking) ───────
    if (fullAnalysis?.deck_analysis) {
      supabase.from('submission_intelligence').insert({
        submission_id:              submission.id,
        sector:                     extraction?.sector,
        sub_sectors:                extraction?.sector_profile?.sub_categories || [],
        stage:                      extraction?.stage,
        country,
        raise_target_usd:           raiseTarget,
        deck_score:                 fullAnalysis.deck_analysis.overall_score,
        deck_scores_by_dimension:   JSON.stringify(fullAnalysis.deck_analysis.dimensions),
        missing_slides:             fullAnalysis.deck_analysis.missing_slides?.map(s => s.slide) || [],
        moat_score:                 fullAnalysis.competitive_analysis?.moat_scores?.overall || null,
        market_methodology:         fullAnalysis.market_analysis?.methodology_grade || null,
        revenue_type:               fullAnalysis.deck_analysis.revenue_metric_type || null,
      }).then(() => {}, (err: unknown) => console.error('submission_intelligence insert failed:', err))
    }

    return NextResponse.json({
      success: true,
      submission_id: submission.id,
      slug:          submission.unique_slug,
      redirect_url:  `/match/${submission.unique_slug}`,
      top_match:     topMatches[0]?.investor?.name || null,
      analysis_done: !!fullAnalysis,
    })

  } catch (err) {
    console.error('Submit error:', err)
    const msg = err instanceof Error ? err.message : 'Submission failed'

    // Detect the truncated-upload signature (user navigated away, network drop, etc.)
    // and return a human-friendly message instead of "TypeError: Failed to parse body as FormData".
    const isTruncatedUpload =
      msg.includes('Failed to parse body as FormData') ||
      msg.includes('no boundary found in multipart body') ||
      msg.includes('aborted') ||
      (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ECONNRESET')

    if (isTruncatedUpload) {
      return NextResponse.json(
        {
          error: 'Upload was interrupted before completing. This usually means the page was refreshed or the network dropped mid-upload. Please try again — if the deck is very large, a stable wifi connection helps.',
          code: 'UPLOAD_TRUNCATED',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}

// ── Co-investor network builder ──────────────────────────────
// Given the founder's existing investors (already matched to DB rows), walk each one's
// `co_investors` text field and surface every co-investor (deduplicated) — these are
// the warm-intro candidates. Each result tracks via_investors[] for the "via X, Y" UI.
// When the co-investor IS in our DB, we attach the FULL investor object so the UI
// can render a click-to-open popup identical to the regular match popup (no extra fetch).
function buildCoInvestorNetwork(
  currentInvestors: Array<{ id: string; name: string; co_investors: string }>,
  allInvestors: Investor[],
  excludedIds: string[]
) {
  const networkMap: Record<string, {
    investor: string                     // display name
    via: string                          // first via for back-compat with existing display
    via_investors: string[]              // full list of "via"s
    matched_id: string | null
    matched_in_db: boolean
    // Compact investor payload (only present when matched_in_db) — mirrors the
    // shape used by the InvestorDetailModal in components/results/InvestorsTab.tsx.
    investor_data?: {
      id: string; name: string; type?: string
      hq_city?: string; hq_country?: string; hq_in_sea?: boolean
      invest_stages?: string[]; invest_countries?: string[]; invest_sectors?: string[]
      ticket_min_usd?: number; ticket_max_usd?: number
      website?: string; linkedin?: string
      description?: string; investment_thesis?: string
      investment_strategy?: string; follow_on_investment?: string
      investment_instrument?: string; ownership_preference?: string
      min_traction_stage?: string; business_model_pref?: string; founder_preference?: string
      value_add?: string; notable_portfolio?: string; co_investors?: string
      top_sectors_detail?: string; invest_locations_detail?: string
      leadership_name?: string; leadership_title?: string; leadership_linkedin?: string
      active_confidence?: string; num_investments?: number
    }
  }> = {}

  for (const current of currentInvestors) {
    const coNames = (current.co_investors || '').split(',').map(s => s.trim()).filter(Boolean)
    for (const coName of coNames) {
      const key = coName.toLowerCase()
      const found = allInvestors.find(inv => {
        const n = inv.name.toLowerCase()
        return n === key || n.includes(key) || key.includes(n)
      })
      // Skip if this co-investor IS one of the founder's existing investors
      if (found && excludedIds.includes(found.id)) continue

      if (!networkMap[key]) {
        const entry: typeof networkMap[string] = {
          investor:      found?.name || coName,
          via:           current.name,
          via_investors: [current.name],
          matched_id:    found?.id || null,
          matched_in_db: !!found,
        }
        if (found) {
          // Cast through Investor type — Supabase row has all these fields
          const inv = found as Investor & {
            type?: string; description?: string; investment_thesis?: string
            investment_strategy?: string; follow_on_investment?: string
            investment_instrument?: string; ownership_preference?: string
            min_traction_stage?: string; business_model_pref?: string; founder_preference?: string
            value_add?: string; notable_portfolio?: string; co_investors?: string
            top_sectors_detail?: string; invest_locations_detail?: string
            leadership_name?: string; leadership_title?: string; leadership_linkedin?: string
            active_confidence?: string; num_investments?: number
            website?: string; linkedin?: string
          }
          entry.investor_data = {
            id: inv.id, name: inv.name, type: inv.type,
            hq_city: inv.hq_city, hq_country: inv.hq_country, hq_in_sea: inv.hq_in_sea,
            invest_stages: inv.invest_stages, invest_countries: inv.invest_countries, invest_sectors: inv.invest_sectors,
            ticket_min_usd: inv.ticket_min_usd, ticket_max_usd: inv.ticket_max_usd,
            website: inv.website, linkedin: inv.linkedin,
            description: inv.description, investment_thesis: inv.investment_thesis,
            investment_strategy: inv.investment_strategy, follow_on_investment: inv.follow_on_investment,
            investment_instrument: inv.investment_instrument, ownership_preference: inv.ownership_preference,
            min_traction_stage: inv.min_traction_stage, business_model_pref: inv.business_model_pref, founder_preference: inv.founder_preference,
            value_add: inv.value_add, notable_portfolio: inv.notable_portfolio, co_investors: inv.co_investors,
            top_sectors_detail: inv.top_sectors_detail, invest_locations_detail: inv.invest_locations_detail,
            leadership_name: inv.leadership_name, leadership_title: inv.leadership_title, leadership_linkedin: inv.leadership_linkedin,
            active_confidence: inv.active_confidence, num_investments: inv.num_investments,
          }
        }
        networkMap[key] = entry
      } else if (!networkMap[key].via_investors.includes(current.name)) {
        networkMap[key].via_investors.push(current.name)
      }
    }
  }
  return Object.values(networkMap)
}

// ─────────────────────────────────────────────────────────────
// Stage + sector normalization. The form sends UI-friendly strings
// like 'Pre-Series A' (capital S) and 'SaaS / B2B' (spaces around /),
// but the matching logic (STAGE_LEVEL), DB benchmarks (ROUND_BENCHMARKS,
// VALUATION_BY_SECTOR, MARKET_SIZES), and helper functions all expect
// canonical strings: 'Pre-series A', 'SaaS', 'Crypto/Web3'. Without
// these maps the lookups silently return null/undefined and the user
// gets a Seed-tier match for a Pre-Series A raise.
// ─────────────────────────────────────────────────────────────
function canonicalStage(s: string): string {
  if (!s) return ''
  const lower = s.toLowerCase().trim()
  const map: Record<string, string> = {
    'pre-seed':     'Pre-seed',
    'pre seed':     'Pre-seed',
    'preseed':      'Pre-seed',
    'seed':         'Seed',
    'pre-series a': 'Pre-series A',
    'pre series a': 'Pre-series A',
    'pre-a':        'Pre-series A',
    'series a':     'Series A',
    'series b':     'Series B',
    'series c':     'Series C+',
    'series c+':    'Series C+',
    'series d':     'Series C+',
    'bridge':       'Bridge',
    'grant':        'Grant',
  }
  return map[lower] || s   // fallback: keep whatever the user/AI provided
}

function canonicalSector(s: string): string {
  if (!s) return ''
  // Strip spaces around slashes so 'SaaS / B2B' → 'SaaS/B2B' and 'Crypto / Web3' → 'Crypto/Web3'
  const cleaned = s.replace(/\s*\/\s*/g, '/').trim()
  const lower = cleaned.toLowerCase()
  const map: Record<string, string> = {
    'ai/ml':         'AI/ML',
    'ai':            'AI/ML',
    'fintech':       'Fintech',
    'saas':          'SaaS',
    'saas/b2b':      'SaaS',          // form: 'SaaS / B2B' → canonical 'SaaS'
    'b2b saas':      'SaaS',
    'b2b':           'SaaS',
    'e-commerce':    'E-commerce',
    'ecommerce':     'E-commerce',
    'healthtech':    'Healthtech',
    'medtech':       'Healthtech',
    'logistics':     'Logistics',
    'edtech':        'Edtech',
    'agritech':      'Agritech',
    'cleantech':     'Cleantech',
    'climate tech':  'Cleantech',
    'deep tech':     'Deep Tech',
    'deeptech':      'Deep Tech',
    'consumer':      'Consumer',
    'cybersecurity': 'Cybersecurity',
    'security':      'Cybersecurity',
    'crypto/web3':   'Crypto/Web3',   // form: 'Crypto / Web3' → 'Crypto/Web3'
    'crypto':        'Crypto/Web3',
    'web3':          'Crypto/Web3',
    'blockchain':    'Crypto/Web3',
    'other':         'Other',
  }
  return map[lower] || cleaned  // fallback: keep the cleaned form (no spaces around /)
}
