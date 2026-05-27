// ═══════════════════════════════════════════════════════════════
// lib/token-storage.ts — Encrypted OAuth token storage
// ═══════════════════════════════════════════════════════════════
// Wraps the pgsodium-backed set_oauth_token / get_oauth_token SQL
// functions. Used by chunk 7 (Calendar) — kept generic so future
// providers (Drive, Sheets, etc.) reuse the same path.

import { supabaseAdmin } from './supabase'

export type OAuthProvider = 'google_calendar'

/**
 * Store an encrypted refresh token for a user/provider combo.
 * UPSERTs — re-calling replaces the previous token.
 */
export async function setOAuthToken(
  userId: string,
  provider: OAuthProvider,
  refreshToken: string,
  options: { scope?: string; expiresAt?: Date } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!refreshToken) return { ok: false, error: 'Empty token' }
  try {
    const { error } = await supabaseAdmin.rpc('set_oauth_token', {
      p_user_id: userId,
      p_provider: provider,
      p_token: refreshToken,
      p_scope: options.scope || null,
      p_expires_at: options.expiresAt?.toISOString() || null,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

/**
 * Decrypt and return a refresh token. Returns null if not found.
 */
export async function getOAuthToken(
  userId: string,
  provider: OAuthProvider,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_oauth_token', {
      p_user_id: userId,
      p_provider: provider,
    })
    if (error) {
      console.error('[token-storage] get failed:', error.message)
      return null
    }
    return (data as string) || null
  } catch (err) {
    console.error('[token-storage] get threw:', err)
    return null
  }
}

/**
 * Mark a token as revoked (e.g., when refresh fails permanently).
 * Doesn't delete — keeps the row for audit history.
 */
export async function revokeOAuthToken(
  userId: string,
  provider: OAuthProvider,
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('oauth_tokens')
      .update({ status: 'revoked' })
      .eq('user_id', userId)
      .eq('provider', provider)
    return !error
  } catch {
    return false
  }
}
