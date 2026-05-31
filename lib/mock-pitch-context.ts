// ═══════════════════════════════════════════════════════════════
// lib/mock-pitch-context.ts
// Shared helpers for building business-aware Gemini prompts in
// the mock-pitch start + debrief routes. The goal is to feed the
// model the same intelligence the deck analysis already produced,
// so questions and feedback use metrics relevant to THIS company.
// ═══════════════════════════════════════════════════════════════

/**
 * Format a USD amount in natural founder-pitch notation.
 * Used to avoid awkward "$2000K" in Gemini outputs by feeding pre-formatted
 * strings (and instructing the model to mirror this notation).
 *   500     → "$500"
 *   12500   → "$12.5K"
 *   500000  → "$500K"
 *   2000000 → "$2M"
 *   2500000 → "$2.5M"
 *   1500000000 → "$1.5B"
 */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '(unspecified)'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${sign}$${abs}`
}

/**
 * Distill the (potentially huge) deck_analysis JSONB into a focused
 * digest that's safe to drop into a Gemini prompt. Includes:
 *   • Overall score + readiness label (calibration anchor)
 *   • Revenue metric type (so the model uses the right metric per company)
 *   • Per-dimension found/missing/best_practice (specific to this company)
 *   • Priority fixes already identified
 *   • Stage readiness gap if it exists
 *
 * Caps total output to ~3500 chars to keep room for transcript + instructions.
 */
export function distillDeckAnalysis(deckAnalysis: unknown): string {
  if (!deckAnalysis || typeof deckAnalysis !== 'object') {
    return '(no deck analysis available — score the answers on general merit)'
  }
  // The DB column may be a JSON string OR an already-parsed object. Defend both.
  let analysis: Record<string, unknown>
  if (typeof deckAnalysis === 'string') {
    try { analysis = JSON.parse(deckAnalysis) } catch { return '(deck analysis unparseable)' }
  } else {
    analysis = deckAnalysis as Record<string, unknown>
  }

  const lines: string[] = []

  // Headline calibration
  if (typeof analysis.overall_score === 'number')      lines.push(`DECK ANALYSIS OVERALL SCORE: ${analysis.overall_score}/100`)
  if (typeof analysis.investor_readiness === 'string') lines.push(`READINESS: ${analysis.investor_readiness}`)
  if (typeof analysis.stage === 'string')              lines.push(`STAGE: ${analysis.stage}`)

  // Revenue metric type — biggest single signal of "which metrics matter for THIS company"
  const revType = String(analysis.revenue_metric_type || '').trim()
  if (revType && revType !== 'unknown') {
    const human: Record<string, string> = {
      subscription_mrr: 'subscription MRR/ARR — track monthly recurring revenue, churn, NRR',
      contract_acv:     'enterprise contract value (ACV) — track contract value, sales cycle, logo retention, not MRR',
      project_revenue:  'project-based revenue — track project size, repeat rate, gross margin',
      pre_revenue:      'pre-revenue — track user engagement, design partners, LOIs, not financials',
    }
    lines.push(`PRIMARY METRIC TYPE: ${human[revType] || revType}`)
  }

  // Stage readiness gap (if the deck analysis flagged it)
  const sr = analysis.stage_readiness as Record<string, unknown> | undefined
  if (sr && typeof sr === 'object') {
    const verdict = sr.verdict ? `Verdict: ${sr.verdict}` : ''
    const gap = sr.gap_summary ? ` | ${String(sr.gap_summary).slice(0, 300)}` : ''
    if (verdict || gap) lines.push(`STAGE READINESS — ${verdict}${gap}`)
  }

  // Per-dimension findings (the meat — what the deck analysis already concluded
  // about each area for this specific company)
  const dims = analysis.dimensions as Record<string, unknown> | undefined
  if (dims && typeof dims === 'object') {
    lines.push('\nKEY DIMENSION FINDINGS:')
    for (const [name, raw] of Object.entries(dims)) {
      if (!raw || typeof raw !== 'object') continue
      const d = raw as Record<string, unknown>
      const score = typeof d.score === 'number' ? d.score : null
      const found = Array.isArray(d.found) ? (d.found as string[]).slice(0, 2).join('; ') : ''
      const missing = Array.isArray(d.missing) ? (d.missing as string[]).slice(0, 2).join('; ') : ''
      const parts: string[] = [`${name}${score != null ? ` (${score}/100)` : ''}`]
      if (found)   parts.push(`✓ ${found.slice(0, 200)}`)
      if (missing) parts.push(`⚠ ${missing.slice(0, 200)}`)
      lines.push(`  • ${parts.join(' — ')}`)
    }
  }

  // Priority fixes the deck analysis already flagged
  const fixes = analysis.priority_fixes as Array<Record<string, unknown>> | undefined
  if (Array.isArray(fixes) && fixes.length > 0) {
    lines.push('\nDECK PRIORITY FIXES (from deck analysis):')
    for (const fix of fixes.slice(0, 4)) {
      const pri = fix.priority ? `[${fix.priority}] ` : ''
      const title = fix.title || ''
      const desc = fix.description ? ` — ${String(fix.description).slice(0, 180)}` : ''
      lines.push(`  • ${pri}${title}${desc}`)
    }
  }

  const out = lines.join('\n')
  // Hard cap on size — generous but bounded
  return out.length > 3500 ? out.slice(0, 3500) + '\n…(truncated)' : out
}

/**
 * One-line business profile header. Cheap to embed in every prompt.
 */
export function businessProfileHeader(sub: {
  company_name?: string | null
  stage?: string | null
  sector?: string | null
  business_model?: string | null
  one_liner?: string | null
  problem?: string | null
  raise_target_usd?: number | null
}): string {
  const bm = sub.business_model ? ` · ${sub.business_model}` : ''
  return [
    `COMPANY: ${sub.company_name || '(unknown)'}`,
    `STAGE: ${sub.stage || '?'}  SECTOR: ${sub.sector || '?'}${bm}`,
    `ASK: ${formatMoney(sub.raise_target_usd)}`,
    `ONE-LINER: ${sub.one_liner || '(not provided)'}`,
    `PROBLEM: ${sub.problem || '(not provided)'}`,
  ].join('\n')
}

/**
 * Standard money-formatting instruction we attach to every prompt
 * to stop Gemini producing "$2000K" instead of "$2M".
 */
export const MONEY_FORMAT_INSTRUCTION = `When you mention money amounts, use natural pitch notation: "$500K" (not "$0.5M"), "$2M" (not "$2000K"), "$1.5M" (not "$1,500K"), "$10M" (not "$10000K"). Match how a real founder or VC would say it.`
