// ═══════════════════════════════════════════════════════════════
// lib/storage.ts — Supabase Storage helper for deck uploads
// ═══════════════════════════════════════════════════════════════
// Replaces lib/gdrive.ts for new submissions. Decks land in the
// `pitch-decks` bucket (Singapore region, private, RLS-protected).
//
// Path convention:
//   • Pre-auth (current state):  pitch-decks/anonymous/<slug>.pdf
//   • Post-auth (chunk 3+):      pitch-decks/<user_id>/<slug>.pdf
//
// The bucket is PRIVATE. We never expose direct URLs — instead we
// generate short-lived signed URLs on demand (signedDeckUrl helper)
// when the deck needs to be viewed/downloaded.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'pitch-decks'

let cached: SupabaseClient | null = null
function admin(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  }
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

/**
 * Upload a deck PDF to the pitch-decks bucket.
 *
 * @param buffer       Raw bytes of the PDF
 * @param slug         Unique submission slug (used as filename, no extension)
 * @param userId       Auth user_id when available; otherwise null → stored under 'anonymous/'
 * @param mimeType     Defaults to application/pdf
 * @returns            { storagePath, error } — storagePath is the key inside the bucket
 *
 * Designed to never throw. Returns { error } on any failure so the calling
 * route can continue without losing the submission entirely (deck URL is
 * stored as null and re-upload can be retried later by super admin).
 */
export async function uploadDeck(
  buffer: Buffer,
  slug: string,
  userId: string | null,
  mimeType = 'application/pdf',
): Promise<{ storagePath: string | null; error: string | null }> {
  if (!buffer || buffer.length === 0) {
    return { storagePath: null, error: 'Empty buffer' }
  }
  if (buffer.length > 25 * 1024 * 1024) {
    return { storagePath: null, error: 'Deck exceeds 25MB' }
  }
  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return { storagePath: null, error: 'Invalid slug' }
  }

  const folder = userId && /^[a-zA-Z0-9-]+$/.test(userId) ? userId : 'anonymous'
  const storagePath = `${folder}/${slug}.pdf`

  try {
    const { error } = await admin().storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true, // re-uploads (e.g., re-analysis) overwrite the same path
      cacheControl: '3600',
    })
    if (error) {
      console.error('[storage] upload failed:', error.message)
      return { storagePath: null, error: error.message }
    }
    return { storagePath, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown upload error'
    console.error('[storage] upload threw:', msg)
    return { storagePath: null, error: msg }
  }
}

/**
 * Generate a short-lived signed URL for downloading a deck.
 * Used by the match page, super admin panel, and PDF export.
 *
 * @param storagePath  The path returned by uploadDeck (e.g. "anonymous/abc123.pdf")
 * @param expiresInSec Default 1 hour. Match page may want shorter; super admin longer.
 * @returns            URL string or null if not found / error
 */
export async function signedDeckUrl(
  storagePath: string | null | undefined,
  expiresInSec = 3600,
): Promise<string | null> {
  if (!storagePath) return null
  try {
    const { data, error } = await admin().storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresInSec)
    if (error || !data?.signedUrl) {
      console.error('[storage] signed URL failed:', error?.message)
      return null
    }
    return data.signedUrl
  } catch (err) {
    console.error('[storage] signed URL threw:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Delete a deck from storage. Used when a submission is hard-deleted
 * by super admin or when GDPR delete is requested.
 */
export async function deleteDeck(storagePath: string | null | undefined): Promise<boolean> {
  if (!storagePath) return true
  try {
    const { error } = await admin().storage.from(BUCKET).remove([storagePath])
    if (error) {
      console.error('[storage] delete failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[storage] delete threw:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Check whether a storagePath looks like a Supabase Storage key (vs an
 * old Google Drive URL from pre-migration submissions). Useful while
 * migrating — old submissions still have full https://drive.google.com/...
 * URLs in deck_url, new ones have storage paths.
 */
export function isStoragePath(s: string | null | undefined): boolean {
  if (!s) return false
  if (s.startsWith('http://') || s.startsWith('https://')) return false
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.pdf$/.test(s)
}
