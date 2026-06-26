// app/api/upload/signed-url/route.ts
//
// Generates a one-time signed URL for the client to upload the deck PDF
// DIRECTLY to Supabase Storage. This bypasses Vercel's 4.5MB serverless
// function body limit — the PDF never passes through our API.
//
// Flow:
//   1. Client calls THIS endpoint with file metadata (name, size, mime)
//   2. We generate a signed upload URL pointing at the correct storage path
//   3. Client PUTs the PDF bytes directly to that URL (browser → Supabase)
//   4. Client then calls /api/submit with the storage path (small JSON body)
//
// Storage path convention (unchanged from previous implementation):
//   pitch-decks/<user_id>/<slug>.pdf   (authenticated user)
//   pitch-decks/anonymous/<slug>.pdf   (anonymous submission)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { getSessionUser } from '@/lib/supabase-server'
import {
  FREE_DECK_ANALYSIS_MONTHLY_LIMIT,
  canBypassFreeLimits,
  currentUsageWindow,
  findExistingDeckAnalysis,
  getDeckAnalysisUsage,
  monthlyLimitMessage,
  normalizeSha256,
} from '@/lib/usage-limits'

const BUCKET = 'pitch-decks'
const MAX_DECK_BYTES = 25 * 1024 * 1024  // 25MB hard ceiling (matches lib/storage.ts)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as
      | { fileName?: string; fileSize?: number; mimeType?: string; deck_sha256?: string; deckSha256?: string }
      | null

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { fileName, fileSize, mimeType } = body
    const deckSha256 = normalizeSha256(body.deck_sha256 || body.deckSha256)

    // ── Validation ────────────────────────────────────────────
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 })
    }
    if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize required (positive integer)' }, { status: 400 })
    }
    if (fileSize > MAX_DECK_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_DECK_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      )
    }
    if (mimeType && mimeType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are accepted' },
        { status: 400 }
      )
    }
    // Filename sanity — only basename matters since we generate the storage path
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must have .pdf extension' },
        { status: 400 }
      )
    }

    // ── Generate storage path ─────────────────────────────────
    // Use service role to read session — same pattern as /api/submit
    const sessionUser = await getSessionUser()
    const userId = sessionUser?.id || null

    if (sessionUser && !(await canBypassFreeLimits(sessionUser))) {
      const usageWindow = currentUsageWindow()
      const usedDeckAnalyses = await getDeckAnalysisUsage(sessionUser.id, usageWindow)

      if (usedDeckAnalyses >= FREE_DECK_ANALYSIS_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: monthlyLimitMessage('deck', FREE_DECK_ANALYSIS_MONTHLY_LIMIT, usageWindow.resetLabel),
            code: 'MONTHLY_DECK_LIMIT',
            used: usedDeckAnalyses,
            limit: FREE_DECK_ANALYSIS_MONTHLY_LIMIT,
            reset_at: usageWindow.resetIso,
          },
          { status: 429 }
        )
      }

      if (deckSha256) {
        const { existing } = await findExistingDeckAnalysis(sessionUser.id, deckSha256)
        if (existing) {
          return NextResponse.json(
            {
              error: 'You already analyzed this deck. Open the existing analysis instead, or upload a revised deck.',
              code: 'DUPLICATE_DECK',
              existing_submission_id: existing.id,
              existing_slug: existing.unique_slug,
              existing_url: `/match/${existing.unique_slug}`,
            },
            { status: 409 }
          )
        }
      }
    }

    // Slug becomes the filename AND the public match page URL: /match/<slug>
    // Generated here (not in /api/submit) so client can pass it through.
    const slug = randomBytes(8).toString('hex')

    // Folder = user_id (for RLS "Users can read own decks") or 'anonymous'
    const folder = userId && /^[a-zA-Z0-9-]+$/.test(userId) ? userId : 'anonymous'
    const storagePath = `${folder}/${slug}.pdf`

    // ── Generate signed upload URL ────────────────────────────
    // createSignedUploadUrl returns a URL the browser can PUT to directly.
    // The URL is single-use and expires shortly after creation (~2 hours default).
    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('[upload/signed-url] createSignedUploadUrl failed:', error?.message)
      return NextResponse.json(
        { error: error?.message || 'Failed to generate upload URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      uploadUrl:   data.signedUrl,
      token:       data.token,
      storagePath: data.path,
      slug,                                // for the caller to reuse in /api/submit
      mimeType:    mimeType || 'application/pdf',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[upload/signed-url] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
