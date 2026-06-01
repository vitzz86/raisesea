// ═══════════════════════════════════════════════════════════════
// lib/editorial-verify.ts
// Completeness / truncation checks for AI editorial content, so a
// half-generated Editor's Take or top story never reaches founders.
//
// Two strictness levels on purpose:
//   • STRICT (generation time) — also flags missing terminal punctuation
//     and short length, the cheap-but-reliable signals that Gemini's output
//     was cut off. A strict failure triggers a regenerate (cheap if wrong).
//   • LENIENT (final send gate) — presence + minimum length only. Never
//     blocks a legitimate take just because it ends on a number or a URL,
//     so it can't regress sends that previously went out.
// ═══════════════════════════════════════════════════════════════

import { TOP_STORY_CATEGORIES, type CategorizedTopStories } from './news-clustering'

export type TakeShape = {
  headline?: string | null
  body?: string | null
  takeaway?: string | null
  content?: string | null
}

// Sentence-ending punctuation (covers quotes/brackets/ellipsis).
const TERMINAL = /[.!?…"'’)\]]$/

function endsCleanly(s: string): boolean {
  const t = s.trim()
  return t.length > 0 && TERMINAL.test(t)
}

export function verifyTake(take: TakeShape, opts?: { strict?: boolean }): { ok: boolean; issues: string[] } {
  const strict = opts?.strict ?? true
  const issues: string[] = []
  const headline = (take.headline || '').trim()
  const body = (take.body || take.content || '').trim()
  const takeaway = (take.takeaway || '').trim()

  // Presence (both levels)
  if (!headline) issues.push('headline empty')
  else if (headline.length > 200) issues.push('headline too long')

  if (!body) issues.push('body empty')
  else if (body.length < 40) issues.push('body far too short (likely truncated)')

  if (!takeaway) issues.push('takeaway empty')

  // Truncation signals (strict only — sentences should end with punctuation)
  if (strict) {
    if (body && body.length < 80) issues.push('body too short')
    if (body && !endsCleanly(body)) issues.push('body not terminated (likely truncated)')
    if (takeaway && takeaway.length < 12) issues.push('takeaway too short')
    if (takeaway && !endsCleanly(takeaway)) issues.push('takeaway not terminated (likely truncated)')
  }

  return { ok: issues.length === 0, issues }
}

/**
 * Verify categorized top stories. Send-partial policy: any incomplete category
 * is DROPPED (not blocked) and the rest are kept. Returns a cleaned copy.
 */
export function verifyTopStories(
  stories: CategorizedTopStories | null | undefined,
): { cleaned: CategorizedTopStories | null; issues: string[]; kept: number } {
  if (!stories) return { cleaned: null, issues: [], kept: 0 }

  const issues: string[] = []
  const cleaned: CategorizedTopStories = { fundraising: null, tech: null, policy: null, exit: null }
  let kept = 0

  for (const cat of TOP_STORY_CATEGORIES) {
    const s = stories[cat]
    if (!s) continue
    const probs: string[] = []
    const headline = (s.headline || '').trim()
    const why = (s.why || '').trim()

    if (!headline) probs.push('headline empty')
    else if (headline.length > 200) probs.push('headline too long')
    if (!why) probs.push('why empty')
    else if (why.length < 15 || !endsCleanly(why)) probs.push('why too short or truncated')
    if (!s.source_url) probs.push('missing source_url')
    if (!s.sources || s.sources.length === 0) probs.push('no sources')

    if (probs.length === 0) {
      cleaned[cat] = s
      kept++
    } else {
      issues.push(`${cat}: ${probs.join(', ')}`)
    }
  }

  return { cleaned: kept > 0 ? cleaned : null, issues, kept }
}
