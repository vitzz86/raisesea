import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'

type RateLimitRow = {
  allowed: boolean
  remaining: number
  reset_at: string
}

function isMissingRateLimitFunction(error: { code?: string; message?: string }): boolean {
  const message = (error.message || '').toLowerCase()
  return error.code === 'PGRST202'
    || error.code === '42883'
    || (message.includes('consume_api_rate_limit') && (
      message.includes('could not find')
      || message.includes('does not exist')
      || message.includes('schema cache')
    ))
}

/**
 * Enforces a concurrency-safe, database-backed limit.
 *
 * Returning a response keeps routes fail-closed when the database check is
 * unavailable. The caller should return it immediately; null means allowed.
 */
export async function enforceApiRateLimit(
  principalId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const { data, error } = await supabaseAdmin.rpc('consume_api_rate_limit', {
    p_principal_id: principalId,
    p_action: action,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    // Allows a preview or rolling deployment to start before v24 is applied.
    // Every other database failure remains fail-closed.
    if (isMissingRateLimitFunction(error)) {
      console.warn('[rate-limit] v24 is not installed yet; limiter is temporarily inactive')
      return null
    }
    console.error('[rate-limit] check failed:', error.message)
    return NextResponse.json(
      { error: 'Request protection is temporarily unavailable. Please try again.', code: 'RATE_LIMIT_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } },
    )
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null
  if (!row || row.allowed) return null

  const retryAfter = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000))
  return NextResponse.json(
    {
      error: 'Too many requests. Please wait before trying again.',
      code: 'RATE_LIMITED',
      remaining: 0,
      reset_at: row.reset_at,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(Math.max(0, row.remaining)),
        'X-RateLimit-Reset': row.reset_at,
      },
    },
  )
}
