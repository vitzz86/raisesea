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
 * Download a deck from storage and return as a Buffer. Used by /api/submit
 * after the client has uploaded the PDF directly via signed URL — the server
 * fetches it back so Gemini can analyze.
 *
 * @param storagePath  e.g. "anonymous/abc123.pdf" or "<userId>/abc123.pdf"
 * @returns            { buffer, error } — never throws
 */
export async function downloadDeck(
  storagePath: string,
): Promise<{ buffer: Buffer | null; error: string | null }> {
  if (!storagePath) return { buffer: null, error: 'No storage path provided' }
  try {
    const { data, error } = await admin().storage.from(BUCKET).download(storagePath)
    if (error || !data) {
      console.error('[storage] download failed:', error?.message)
      return { buffer: null, error: error?.message || 'Download returned no data' }
    }
    // data is a Blob — convert to Buffer for Gemini base64 encoding
    const arrayBuffer = await data.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown download error'
    console.error('[storage] download threw:', msg)
    return { buffer: null, error: msg }
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
  // Storage paths look like "folder/file.pdf". Be forgiving about uppercase extensions,
  // extra path segments (folder/sub/file.pdf), and the underscore-or-hyphen char set.
  return /^[a-zA-Z0-9_./-]+\.(pdf|PDF)$/.test(s)
}

/**
 * Convert any deck_url into a URL that will actually render inside an iframe.
 *
 *  • Storage paths (e.g. "userid/slug.pdf") → signed Supabase URL (private bucket)
 *  • Google Drive "view" URLs → "/preview" form, which is the only one Drive
 *    explicitly allows to be embedded in an iframe (the others send
 *    X-Frame-Options: SAMEORIGIN and produce a blank frame).
 *  • Already-embeddable URLs (any https://) → returned as-is.
 *  • Null/empty → null (caller shows the placeholder).
 *
 * The second return value, `external`, is a separate URL the user can click
 * to open the deck in a new tab — useful when the iframe is blocked but the
 * PDF is reachable directly.
 */
export async function resolveDeckUrl(
  deckUrl: string | null | undefined,
  expirySeconds = 7200,
): Promise<{ embedUrl: string | null; external: string | null }> {
  if (!deckUrl) return { embedUrl: null, external: null }

  // Case 1: Supabase Storage path
  if (isStoragePath(deckUrl)) {
    const signed = await signedDeckUrl(deckUrl, expirySeconds)
    return { embedUrl: signed, external: signed }
  }

  // Case 2: Google Drive URL — convert to /preview form for embed
  // Recognises both /file/d/<ID>/... and ?id=<ID> patterns
  const driveMatch =
    deckUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    deckUrl.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/)
  if (driveMatch) {
    const id = driveMatch[1]
    return {
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      external: `https://drive.google.com/file/d/${id}/view`,
    }
  }

  // Case 3: any other https://… URL — try as-is, expose the same URL externally
  if (deckUrl.startsWith('http://') || deckUrl.startsWith('https://')) {
    return { embedUrl: deckUrl, external: deckUrl }
  }

  // Case 4: unrecognised
  return { embedUrl: null, external: null }
}
