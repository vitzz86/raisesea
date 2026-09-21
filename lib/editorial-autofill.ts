// ═══════════════════════════════════════════════════════════════
// lib/editorial-autofill.ts
// Continuously refreshed editorial generation for the autonomous Hermes flow.
//
// Strict ordering (generators read APPROVED items):
// News items are quality-gated during ingestion. New pipeline records are
// either approved or skipped; no manual approval queue gates publication.
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
 * Compatibility no-op retained for old callers. Hermes uses publish-or-skip,
 * so there is no approval queue to process.
 */
export async function autoApproveIfEmpty(): Promise<{ ran: boolean; approved: number }> {
  console.log('[autofill] publish-or-skip is active; no bulk approval is needed')
  return { ran: false, approved: 0 }
}

export type EditorialRefreshResult = {
  ran: boolean
  created: boolean
  updated: boolean
  preservedManual: boolean
  issues: string[]
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
): Promise<EditorialRefreshResult> {
  return refreshEditorialContent(now, false)
}

/**
 * Rebuild the current week's approved editorial artifact from the latest
 * approved stories. Daily Hermes runs call this with refreshExisting=true so
 * the public Weekly news page changes as soon as new stories are published.
 * A manually authored take is preserved and never overwritten by automation.
 */
export async function refreshEditorialContent(
  now: Date = new Date(),
  refreshExisting = true,
): Promise<EditorialRefreshResult> {
  const monday = mondayOf(now)

  const { data: latest } = await supabaseAdmin
    .from('editors_takes')
    .select('id, week_starting, generated_by')
    .eq('status', 'approved')
    .eq('week_starting', monday)
    .order('created_at', { ascending: false })
    .limit(1)

  const existing = latest?.[0] || null
  if (existing?.generated_by === 'manual') {
    return { ran: false, created: false, updated: false, preservedManual: true, issues: [] }
  }
  if (existing && !refreshExisting) {
    return { ran: false, created: false, updated: false, preservedManual: false, issues: [] }
  }

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
    return { ran: true, created: false, updated: false, preservedManual: false, issues: check.issues }
  }

  // Top stories: send-partial — drop any incomplete category, keep the rest.
  const rawTop = await generateTopStories()
  const { cleaned, issues: topIssues } = verifyTopStories(rawTop)

  const payload = {
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
  }

  const operation = existing
    ? supabaseAdmin.from('editors_takes').update(payload).eq('id', existing.id)
    : supabaseAdmin.from('editors_takes').insert(payload)
  const { error } = await operation
  if (error) {
    console.error('[autofill] editorial refresh failed:', error.message)
    return { ran: true, created: false, updated: false, preservedManual: false, issues: [error.message] }
  }

  console.log(`[autofill] ${existing ? 'refreshed' : 'created'} approved editor's take for week ${monday}${topIssues.length ? ` (dropped top stories: ${topIssues.join('; ')})` : ''}`)
  return {
    ran: true,
    created: !existing,
    updated: Boolean(existing),
    preservedManual: false,
    issues: topIssues,
  }
}

/**
 * Generate the editorial artifact from items already auto-approved by Hermes.
 * Pending exceptions never gate this path.
 */
export async function ensureEditorialContent(
  now: Date = new Date(),
): Promise<{ approved: number; takeCreated: boolean; takeUpdated: boolean; issues: string[] }> {
  const g = await refreshEditorialContent(now, true)
  return { approved: 0, takeCreated: g.created, takeUpdated: g.updated, issues: g.issues }
}
