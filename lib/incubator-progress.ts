import { supabaseAdmin } from './supabase'

type AuthUser = {
  id: string
  email?: string | null
}

type DeckDimension = {
  score?: number
  max_score?: number
}

type DeckAnalysisLike = {
  overall_score?: number
  dimensions?: Record<string, DeckDimension>
  priority_fixes?: Array<{ title?: string; description?: string; priority?: string }>
  investor_readiness?: string
}

type IncubatorStartupPayload = {
  institutionSlug: string
  startupId?: string
  name: string
  founderName?: string
  founderEmail?: string
  faculty?: string
  cohort?: string
  sector?: string
  stage?: string
  status?: string
  mentorName?: string
  oneLiner?: string
  createdBy?: string
}

type ExistingIncubatorVersion = {
  id: string
  version: number
  score: number | null
  submission_id: string
  dimension_scores: Record<string, number> | null
}

export type IncubatorDeckProgressResult = {
  startupId: string
  version: number
  previousSubmissionId: string | null
  score: number | null
  previousScore: number | null
  scoreDelta: number | null
  dimensionDeltas: Record<string, number>
}

export function parseIncubatorPayload(body: Record<string, unknown>, user: AuthUser | null): IncubatorStartupPayload | null {
  const institutionSlug = stringValue(body.institution_slug || body.incubator_institution_slug)
  const startupId = stringValue(body.incubator_startup_id)
  if (!institutionSlug && !startupId) return null

  const name = stringValue(body.incubator_startup_name || body.company_name)
  if (!name && !startupId) {
    throw new Error('Missing incubator startup name')
  }

  return {
    institutionSlug: institutionSlug || 'unpad',
    startupId,
    name,
    founderName: stringValue(body.incubator_founder_name || body.founder_name),
    founderEmail: stringValue(body.incubator_founder_email || body.founder_email),
    faculty: stringValue(body.incubator_faculty),
    cohort: stringValue(body.incubator_cohort) || 'Unpad 2026 Batch A',
    sector: stringValue(body.sector),
    stage: stringValue(body.stage),
    status: stringValue(body.incubator_status) || 'Applied',
    mentorName: stringValue(body.incubator_mentor_name),
    oneLiner: stringValue(body.incubator_one_liner),
    createdBy: user?.id,
  }
}

export async function resolveIncubatorStartup(payload: IncubatorStartupPayload): Promise<string> {
  const base = {
    institution_slug: payload.institutionSlug,
    cohort: payload.cohort || 'Unpad 2026 Batch A',
    name: payload.name,
    founder_name: payload.founderName || null,
    founder_email: payload.founderEmail || null,
    faculty: payload.faculty || null,
    sector: payload.sector || null,
    stage: payload.stage || null,
    status: normalizeStatus(payload.status),
    mentor_name: payload.mentorName || null,
    one_liner: payload.oneLiner || null,
  }

  if (payload.startupId) {
    const updatePayload = Object.fromEntries(
      Object.entries(base).filter(([, value]) => value !== '' && value !== null)
    )
    const { data, error } = await supabaseAdmin
      .from('incubator_startups')
      .update(updatePayload)
      .eq('id', payload.startupId)
      .eq('institution_slug', payload.institutionSlug)
      .select('id')
      .single()

    if (error) throwIncubatorError(error)
    return data.id as string
  }

  const { data, error } = await supabaseAdmin
    .from('incubator_startups')
    .insert({
      ...base,
      created_by: payload.createdBy || null,
    })
    .select('id')
    .single()

  if (error) throwIncubatorError(error)
  return data.id as string
}

export async function findExistingIncubatorDeck(startupId: string, deckSha256: string | null): Promise<{ version: number; submissionSlug: string | null } | null> {
  if (!deckSha256) return null

  const { data, error } = await supabaseAdmin
    .from('incubator_deck_versions')
    .select('version, submission_id')
    .eq('startup_id', startupId)
    .eq('deck_sha256', deckSha256)
    .maybeSingle()

  if (error) throwIncubatorError(error)
  if (!data) return null

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select('unique_slug')
    .eq('id', data.submission_id)
    .maybeSingle()

  return {
    version: data.version as number,
    submissionSlug: (submission?.unique_slug as string | undefined) || null,
  }
}

export async function recordIncubatorDeckProgress({
  institutionSlug,
  startupId,
  submissionId,
  deckSha256,
  deckAnalysis,
  createdBy,
}: {
  institutionSlug: string
  startupId: string
  submissionId: string
  deckSha256: string | null
  deckAnalysis: DeckAnalysisLike | null | undefined
  createdBy?: string
}): Promise<IncubatorDeckProgressResult> {
  const { data: previousRows, error: previousError } = await supabaseAdmin
    .from('incubator_deck_versions')
    .select('id, version, score, submission_id, dimension_scores')
    .eq('startup_id', startupId)
    .order('version', { ascending: false })
    .limit(1)

  if (previousError) throwIncubatorError(previousError)

  const previous = ((previousRows || []) as ExistingIncubatorVersion[])[0] || null
  const version = previous ? previous.version + 1 : 1
  const score = typeof deckAnalysis?.overall_score === 'number' ? deckAnalysis.overall_score : null
  const previousScore = previous?.score ?? null
  const scoreDelta = score != null && previousScore != null ? score - previousScore : null
  const dimensionScores = extractDimensionScores(deckAnalysis)
  const dimensionDeltas = previous?.dimension_scores ? diffDimensions(dimensionScores, previous.dimension_scores) : {}
  const nextFocus = buildNextFocus(deckAnalysis, dimensionScores)
  const summary = buildSummary(version, score, previousScore, nextFocus)
  const mentorPrompt = buildMentorPrompt(nextFocus, dimensionScores)

  const { error: insertError } = await supabaseAdmin
    .from('incubator_deck_versions')
    .insert({
      institution_slug: institutionSlug,
      startup_id: startupId,
      submission_id: submissionId,
      previous_submission_id: previous?.submission_id || null,
      version,
      deck_sha256: deckSha256,
      score,
      previous_score: previousScore,
      score_delta: scoreDelta,
      dimension_scores: dimensionScores,
      dimension_deltas: dimensionDeltas,
      summary,
      next_focus: nextFocus,
      mentor_prompt: mentorPrompt,
      created_by: createdBy || null,
    })

  if (insertError) throwIncubatorError(insertError)

  const { error: startupUpdateError } = await supabaseAdmin
    .from('incubator_startups')
    .update({
      last_submission_id: submissionId,
      latest_score: score,
      previous_score: previousScore,
      latest_delta: scoreDelta,
      latest_version: version,
      latest_activity_at: new Date().toISOString(),
      status: version === 1 ? 'Screening' : 'Incubating',
    })
    .eq('id', startupId)

  if (startupUpdateError) throwIncubatorError(startupUpdateError)

  const { error: submissionUpdateError } = await supabaseAdmin
    .from('submissions')
    .update({
      institution_slug: institutionSlug,
      incubator_startup_id: startupId,
      deck_version: version,
      previous_submission_id: previous?.submission_id || null,
      deck_score_delta: scoreDelta,
      deck_dimension_deltas: dimensionDeltas,
    })
    .eq('id', submissionId)

  if (submissionUpdateError) throwIncubatorError(submissionUpdateError)

  return {
    startupId,
    version,
    previousSubmissionId: previous?.submission_id || null,
    score,
    previousScore,
    scoreDelta,
    dimensionDeltas,
  }
}

function extractDimensionScores(deckAnalysis: DeckAnalysisLike | null | undefined): Record<string, number> {
  const dimensions = deckAnalysis?.dimensions || {}
  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => {
        const score = typeof value?.score === 'number' ? value.score : null
        const maxScore = typeof value?.max_score === 'number' && value.max_score > 0 ? value.max_score : 100
        if (score == null) return null
        return [key, Math.round((score / maxScore) * 100)] as const
      })
      .filter((entry): entry is readonly [string, number] => entry != null)
  )
}

function diffDimensions(current: Record<string, number>, previous: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(current)
      .filter(([key]) => typeof previous[key] === 'number')
      .map(([key, value]) => [key, value - previous[key]])
  )
}

function buildNextFocus(deckAnalysis: DeckAnalysisLike | null | undefined, dimensions: Record<string, number>) {
  const firstFix = deckAnalysis?.priority_fixes?.[0]
  if (firstFix?.title) return firstFix.title

  const weakest = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0]
  if (!weakest) return 'Review full deck report and assign the next mentor action'
  return `Improve ${labelDimension(weakest[0])}`
}

function buildSummary(version: number, score: number | null, previousScore: number | null, nextFocus: string) {
  if (score == null) return `Deck v${version} was saved, but the AI score was unavailable. Review the analysis status before assigning mentor actions.`
  if (previousScore == null) return `Deck v${version} created the startup baseline at ${score}/100. Next focus: ${nextFocus}.`
  const delta = score - previousScore
  return `Deck v${version} scored ${score}/100, moving ${delta >= 0 ? '+' : ''}${delta} points from the previous upload. Next focus: ${nextFocus}.`
}

function buildMentorPrompt(nextFocus: string, dimensions: Record<string, number>) {
  const weakest = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0]
  return weakest
    ? `Mentor prompt: start with ${labelDimension(weakest[0])} and ask for one concrete proof point before the next deck upload.`
    : `Mentor prompt: review ${nextFocus.toLowerCase()} and assign one concrete improvement before the next upload.`
}

function labelDimension(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function normalizeStatus(value?: string) {
  const allowed = ['Applied', 'Screening', 'Accepted', 'Incubating', 'Demo Day Ready', 'Alumni']
  return allowed.includes(value || '') ? value : 'Applied'
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function throwIncubatorError(error: unknown): never {
  if (isMissingIncubatorSchema(error)) {
    throw new Error('Unpad incubator tables are not ready. Please run supabase/migrations/v22_incubator_unpad_workspace.sql in Supabase first.')
  }
  throw error
}

function isMissingIncubatorSchema(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string; hint?: string }
  const text = [err?.code, err?.message, err?.details, err?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    text.includes('incubator_startups') ||
    text.includes('incubator_deck_versions') ||
    text.includes('incubator_startup_id') ||
    text.includes('institution_slug') ||
    err?.code === '42P01' ||
    err?.code === '42703' ||
    err?.code === 'PGRST204'
  )
}
