// ═══════════════════════════════════════════════════════════════
// GET /api/cron/news
// Manual rollback/fallback endpoint. Hermes owns the production schedule;
// vercel.json intentionally does not register this route as a cron job.
// Auth via CRON_SECRET header check.
//
// On every run: fetches RSS + extracts via DeepSeek (idempotent — dedupes by URL)
// On Mondays at 09:00 SGT (01:00 UTC): also sends the weekly digest
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { runNewsPipeline } from '@/lib/news-pipeline'
import { sendWeeklyDigest } from '@/lib/digest-builder'
import { ensureEditorialContent } from '@/lib/editorial-autofill'

export const maxDuration = 300

export async function GET(req: Request) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const force = url.searchParams.get('force')   // for manual testing

  // Always run pipeline
  const pipelineResult = await runNewsPipeline()

  // Decide whether to send digest:
  // Monday 09:00 SGT = Monday 01:00 UTC
  // Run weekly digest if it's between 01:00 - 02:00 UTC on Monday
  // OR if force=digest is set (manual override for testing via cron path)
  const now = new Date()
  const isMondayMorningUtc = now.getUTCDay() === 1 && now.getUTCHours() === 1
  const shouldSendDigest = isMondayMorningUtc || force === 'digest'

  let digestResult = null
  const autofill = pipelineResult.approved > 0 || shouldSendDigest
    ? await ensureEditorialContent(now)
    : null
  if (shouldSendDigest) {
    digestResult = await sendWeeklyDigest({ triggeredBy: 'cron' })
  }

  return NextResponse.json({
    ok: true,
    pipeline: pipelineResult,
    autofill,
    digest: digestResult,
  })
}
