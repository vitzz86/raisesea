import { supabaseAdmin } from './supabase'
import { isSuperAdmin } from './super-admin'

type AuthUser = {
  id: string
  email?: string | null
}

export const FREE_DECK_ANALYSIS_MONTHLY_LIMIT = 2
export const FREE_MOCK_PITCH_MONTHLY_LIMIT = 2

export type UsageWindow = {
  startIso: string
  resetIso: string
  resetLabel: string
}

export type ExistingDeckAnalysis = {
  id: string
  unique_slug: string
  company_name: string | null
  analysis_status: string | null
  created_at: string
}

type SupabaseErrorLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export function currentUsageWindow(now = new Date()): UsageWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  return {
    startIso: start.toISOString(),
    resetIso: reset.toISOString(),
    resetLabel: reset.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  }
}

export function normalizeSha256(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null
}

export function isMissingDeckHashColumn(error: unknown): boolean {
  const err = error as SupabaseErrorLike
  const text = [err?.code, err?.message, err?.details, err?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return text.includes('deck_sha256') && (
    text.includes('does not exist') ||
    text.includes('could not find') ||
    err?.code === '42703' ||
    err?.code === 'PGRST204'
  )
}

export async function canBypassFreeLimits(user: AuthUser | null): Promise<boolean> {
  return isSuperAdmin(user)
}

export async function getDeckAnalysisUsage(userId: string, window = currentUsageWindow()): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('id, analysis_status')
    .eq('user_id', userId)
    .gte('created_at', window.startIso)
    .lt('created_at', window.resetIso)

  if (error) throw error

  return (data || []).filter(row => row.analysis_status !== 'failed').length
}

export async function getMockPitchUsage(userId: string, window = currentUsageWindow()): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', window.startIso)
    .lt('started_at', window.resetIso)

  if (error) throw error
  return count || 0
}

export async function findExistingDeckAnalysis(
  userId: string,
  deckSha256: string | null,
): Promise<{ existing: ExistingDeckAnalysis | null; columnAvailable: boolean }> {
  if (!deckSha256) return { existing: null, columnAvailable: true }

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('id, unique_slug, company_name, analysis_status, created_at')
    .eq('user_id', userId)
    .eq('deck_sha256', deckSha256)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    if (isMissingDeckHashColumn(error)) {
      console.warn('[usage-limits] deck_sha256 column is missing; duplicate deck gate is skipped until migration is applied.')
      return { existing: null, columnAvailable: false }
    }
    throw error
  }

  const existing = ((data || []) as ExistingDeckAnalysis[])
    .find(row => row.analysis_status !== 'failed') || null

  return { existing, columnAvailable: true }
}

export function monthlyLimitMessage(kind: 'deck' | 'mock', limit: number, resetLabel: string): string {
  const feature = kind === 'deck' ? 'deck analyses' : 'mock pitch sessions'
  return `Free accounts can use ${limit} ${feature} each month. Your limit resets on ${resetLabel}.`
}
