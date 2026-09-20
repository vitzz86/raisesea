// ═══════════════════════════════════════════════════════════════
// lib/editorial-autofill.ts
// Monday "just-in-time" editorial generation for the autonomous Hermes flow.
//
// Strict ordering (generators read APPROVED items):
// News items are quality-gated during ingestion. Pending now means "ambiguous
// exception" and must never block the approved stream or be mass-approved.
//
// Everything is check-then-act so a double-delivered cron (Vercel can fire the
// same event twice) can't double-approve or create two takes.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from './supabase'
import { generateEditorsTake, generateTopStories } from './news-pipeline'
import { verifyTake, verifyTopStories } from './editorial-verify'

function mondayOf(now: Date): string {
  const m = new Date(now)
  m.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  m.setUTCHours(0, 0, 0, 0)
  return m.toISOString().slice(0, 10)
}

/**
 * Compatibility no-op retained for old callers. Hermes auto-publishes strong
 * items during ingestion; pending items are intentionally an exception queue.
 */
export async function autoApproveIfEmpty(): Promise<{ ran: boolean; approved: number }> {
  console.log('[autofill] pending items are an exception queue; no bulk approval performed')
  return { ran: false, approved: 0 }
}

/**
 * If there's no APPROVED take for THIS week (the most recent approved take is
 * stale or absent), generate one, verify it, and auto-approve it along with
 * cleaned top stories. If the take can't pass verification even after one
 * regenerate, it is NOT approved — the digest's safety floor then skips the
 * send and notifies the admin (hold-and-notify for a broken centerpiece).
 */
export async function autoGenerateTakeIfMissing(
  now: Date = new Date(),
): Promise<{ ran: boolean; created: boolean; issues: string[] }> {
  const monday = mondayOf(now)

  const { data: latest } = await supabaseAdmin
    .from('editors_takes')
    .select('id, week_starting')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)

  const hasThisWeek = !!latest?.[0] && String(latest[0].week_starting) >= monday
  if (hasThisWeek) return { ran: false, created: false, issues: [] }

  // Generate + verify (strict). Regenerate once on truncation/incompleteness.
  let take = await generateEditorsTake()
  let check = take ? verifyTake(take, { strict: true }) : { ok: false, issues: ['generation returned null'] }
  if (!check.ok) {
    console.warn(`[autofill] take failed verification, regenerating once: ${check.issues.join('; ')}`)
    take = await generateEditorsTake()
    check = take ? verifyTake(take, { strict: true }) : { ok: false, issues: ['regeneration returned null'] }
  }
  if (!take || !check.ok) {
    console.error(`[autofill] take still incomplete after retry — NOT auto-approving: ${check.issues.join('; ')}`)
    return { ran: true, created: false, issues: check.issues }
  }

  // Top stories: send-partial — drop any incomplete category, keep the rest.
  const rawTop = await generateTopStories()
  const { cleaned, issues: topIssues } = verifyTopStories(rawTop)

  // Re-check this-week guard right before insert (narrows the double-fire race).
  const { data: recheck } = await supabaseAdmin
    .from('editors_takes')
    .select('id, week_starting')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
  if (!!recheck?.[0] && String(recheck[0].week_starting) >= monday) {
    console.log('[autofill] a this-week take appeared concurrently — skipping insert')
    return { ran: true, created: false, issues: [] }
  }

  const { error } = await supabaseAdmin.from('editors_takes').insert({
    week_starting: monday,
    content:  take.content,
    headline: take.headline,
    body:     take.body,
    takeaway: take.takeaway,
    top_stories: cleaned,
    status: 'approved',
    generated_by: 'ai',
    approved_at: now.toISOString(),
    approved_by: null,
  })
  if (error) {
    console.error('[autofill] auto-approve take insert failed:', error.message)
    return { ran: true, created: false, issues: [error.message] }
  }

  console.log(`[autofill] auto-generated + approved editor's take for week ${monday}${topIssues.length ? ` (dropped top stories: ${topIssues.join('; ')})` : ''}`)
  return { ran: true, created: true, issues: topIssues }
}

/**
 * Generate the editorial artifact from items already auto-approved by Hermes.
 * Pending exceptions never gate this path.
 */
export async function ensureEditorialContent(
  now: Date = new Date(),
): Promise<{ approved: number; takeCreated: boolean; issues: string[] }> {
  const g = await autoGenerateTakeIfMissing(now)
  return { approved: 0, takeCreated: g.created, issues: g.issues }
}
