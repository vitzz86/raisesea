import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import type { StartupStatus } from './data'

export const UNPAD_INSTITUTION_SLUG = 'unpad'

export type IncubatorStartupRow = {
  id: string
  created_at: string
  updated_at: string
  institution_slug: string
  cohort: string | null
  name: string
  founder_name: string | null
  founder_email: string | null
  faculty: string | null
  sector: string | null
  stage: string | null
  status: StartupStatus | null
  mentor_name: string | null
  one_liner: string | null
  last_submission_id: string | null
  latest_score: number | null
  previous_score: number | null
  latest_delta: number | null
  latest_version: number | null
  latest_activity_at: string | null
}

export type IncubatorDeckVersionRow = {
  id: string
  created_at: string
  startup_id: string
  submission_id: string
  previous_submission_id: string | null
  version: number
  deck_sha256: string | null
  score: number | null
  previous_score: number | null
  score_delta: number | null
  dimension_scores: Record<string, number> | null
  dimension_deltas: Record<string, number> | null
  summary: string | null
  next_focus: string | null
  mentor_prompt: string | null
}

export type SubmissionLinkRow = {
  id: string
  unique_slug: string
  created_at: string
  deck_analysis: unknown
}

export type IncubatorStartupView = {
  id: string
  name: string
  founder: string
  founderEmail: string
  faculty: string
  sector: string
  stage: string
  cohort: string
  status: StartupStatus
  mentor: string
  progressScore: number
  deckScore: number | null
  previousDeckScore: number | null
  latestDelta: number | null
  milestoneCompletion: number
  lastActivity: string
  lastActivityIso: string | null
  risk: 'Low' | 'Medium' | 'High'
  nextMilestone: string
  oneLiner: string
  latestVersion: number
}

export type IncubatorDeckVersionView = {
  id: string
  version: string
  versionNumber: number
  uploadedAt: string
  uploadedAtIso: string
  score: number | null
  previousScore: number | null
  scoreDelta: number | null
  focus: string
  summary: string
  mentorPrompt: string
  submissionId: string
  submissionSlug: string | null
  dimensionScores: Record<string, number>
  dimensionDeltas: Record<string, number>
}

export async function requireUnpadOperator(redirectTo = '/unpad') {
  const user = await getSessionUser()
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  const admin = await isSuperAdmin(user)
  if (!admin) redirect('/dashboard')
  return user
}

export async function fetchUnpadStartups(): Promise<{ startups: IncubatorStartupView[]; schemaReady: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('incubator_startups')
    .select('id, created_at, updated_at, institution_slug, cohort, name, founder_name, founder_email, faculty, sector, stage, status, mentor_name, one_liner, last_submission_id, latest_score, previous_score, latest_delta, latest_version, latest_activity_at')
    .eq('institution_slug', UNPAD_INSTITUTION_SLUG)
    .order('latest_activity_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return {
      startups: [],
      schemaReady: !isMissingIncubatorSchema(error),
      error: error.message,
    }
  }

  return {
    startups: ((data || []) as IncubatorStartupRow[]).map(mapStartupRow),
    schemaReady: true,
  }
}

export async function fetchUnpadStartup(id: string): Promise<{
  startup: IncubatorStartupView | null
  versions: IncubatorDeckVersionView[]
  schemaReady: boolean
  error?: string
}> {
  const { data: startupRow, error: startupError } = await supabaseAdmin
    .from('incubator_startups')
    .select('id, created_at, updated_at, institution_slug, cohort, name, founder_name, founder_email, faculty, sector, stage, status, mentor_name, one_liner, last_submission_id, latest_score, previous_score, latest_delta, latest_version, latest_activity_at')
    .eq('institution_slug', UNPAD_INSTITUTION_SLUG)
    .eq('id', id)
    .maybeSingle()

  if (startupError) {
    return {
      startup: null,
      versions: [],
      schemaReady: !isMissingIncubatorSchema(startupError),
      error: startupError.message,
    }
  }
  if (!startupRow) {
    return { startup: null, versions: [], schemaReady: true }
  }

  const { data: versionRows, error: versionError } = await supabaseAdmin
    .from('incubator_deck_versions')
    .select('id, created_at, startup_id, submission_id, previous_submission_id, version, deck_sha256, score, previous_score, score_delta, dimension_scores, dimension_deltas, summary, next_focus, mentor_prompt')
    .eq('startup_id', id)
    .order('version', { ascending: false })

  if (versionError) {
    return {
      startup: mapStartupRow(startupRow as IncubatorStartupRow),
      versions: [],
      schemaReady: !isMissingIncubatorSchema(versionError),
      error: versionError.message,
    }
  }

  const versions = (versionRows || []) as IncubatorDeckVersionRow[]
  const submissionIds = versions.map(version => version.submission_id).filter(Boolean)
  const submissionMap = new Map<string, SubmissionLinkRow>()

  if (submissionIds.length > 0) {
    const { data: submissionRows } = await supabaseAdmin
      .from('submissions')
      .select('id, unique_slug, created_at, deck_analysis')
      .in('id', submissionIds)

    ;((submissionRows || []) as SubmissionLinkRow[]).forEach(row => submissionMap.set(row.id, row))
  }

  return {
    startup: mapStartupRow(startupRow as IncubatorStartupRow),
    versions: versions.map(version => mapDeckVersionRow(version, submissionMap.get(version.submission_id))),
    schemaReady: true,
  }
}

export function mapStartupRow(row: IncubatorStartupRow): IncubatorStartupView {
  const score = row.latest_score
  const activityIso = row.latest_activity_at || row.updated_at || row.created_at
  return {
    id: row.id,
    name: row.name,
    founder: row.founder_name || 'Founder not set',
    founderEmail: row.founder_email || '',
    faculty: row.faculty || 'Faculty not set',
    sector: row.sector || 'Sector not set',
    stage: row.stage || 'Stage not set',
    cohort: row.cohort || 'Unpad cohort',
    status: row.status || 'Applied',
    mentor: row.mentor_name || 'Unassigned mentor',
    progressScore: score ?? 0,
    deckScore: score,
    previousDeckScore: row.previous_score,
    latestDelta: row.latest_delta,
    milestoneCompletion: score == null ? 0 : Math.max(10, Math.min(95, Math.round(score * 0.88))),
    lastActivity: formatDate(activityIso),
    lastActivityIso: activityIso,
    risk: riskFromScore(score, row.latest_delta),
    nextMilestone: score == null
      ? 'Upload the first deck to create a progress baseline'
      : row.latest_delta == null
        ? 'Review baseline deck and assign mentor focus'
        : row.latest_delta >= 8
          ? 'Convert improvement into mentor-approved demo day milestones'
          : 'Address the weakest deck dimension before the next upload',
    oneLiner: row.one_liner || 'No one-liner recorded yet.',
    latestVersion: row.latest_version || 0,
  }
}

function mapDeckVersionRow(row: IncubatorDeckVersionRow, submission?: SubmissionLinkRow): IncubatorDeckVersionView {
  return {
    id: row.id,
    version: `Deck v${row.version}`,
    versionNumber: row.version,
    uploadedAt: formatDate(row.created_at),
    uploadedAtIso: row.created_at,
    score: row.score,
    previousScore: row.previous_score,
    scoreDelta: row.score_delta,
    focus: row.next_focus || 'Review deck analysis and mentor notes',
    summary: row.summary || 'Deck analysis completed. Review full report for details.',
    mentorPrompt: row.mentor_prompt || 'Review the weakest deck dimension and assign a concrete next action.',
    submissionId: row.submission_id,
    submissionSlug: submission?.unique_slug || null,
    dimensionScores: row.dimension_scores || {},
    dimensionDeltas: row.dimension_deltas || {},
  }
}

export function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isMissingIncubatorSchema(error: unknown) {
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

function riskFromScore(score: number | null, delta: number | null): 'Low' | 'Medium' | 'High' {
  if (score == null) return 'Medium'
  if (score < 50) return 'High'
  if (score < 65 || (delta != null && delta < 3)) return 'Medium'
  return 'Low'
}
