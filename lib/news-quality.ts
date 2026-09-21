import type { NewsSource } from './news-sources'

export type QualitySignals = {
  category?: string | null
  company_name?: string | null
  country?: string | null
  sector?: string | null
  ai_summary?: string | null
  ai_why_it_matters?: string | null
  confidence?: number | null
  evidence_quality?: string | null
}

export type PublicationDecision = {
  action: 'approved' | 'skip'
  confidence: number
  reason: string | null
}

function normalizeConfidence(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0
  const n = Number(value)
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n))
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120)
}

const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on',
  'the', 'to', 'with', 'will', 'its', 'is', 'after', 'new', 'says', 'report',
])

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter(token => token.length > 1 && !TITLE_STOP_WORDS.has(token)),
  )
}

export function isNearDuplicateTitle(title: string, comparisonTitles: string[]): boolean {
  const left = titleTokens(title)
  if (left.size < 3) return comparisonTitles.some(other => normalizeTitle(other) === normalizeTitle(title))

  for (const other of comparisonTitles) {
    const right = titleTokens(other)
    if (right.size < 3) continue
    let overlap = 0
    for (const token of left) if (right.has(token)) overlap++
    const union = new Set([...left, ...right]).size
    const similarity = union > 0 ? overlap / union : 0
    const containment = overlap / Math.min(left.size, right.size)
    if (overlap >= 4 && (similarity >= 0.6 || containment >= 0.5)) return true
  }
  return false
}

/**
 * Fully autonomous publish-or-skip gate:
 * - complete, well-supported records publish immediately;
 * - everything else is skipped and may be rediscovered from a better source.
 *
 * There is intentionally no "pending" outcome. Operators edit or delist
 * published stories; they never have to clear an approval queue.
 */
export function decidePublication(
  item: QualitySignals,
  source: Pick<NewsSource, 'kind' | 'tier'>,
): PublicationDecision {
  const confidence = normalizeConfidence(item.confidence)
  const missing: string[] = []
  const analysisText = `${item.ai_summary || ''} ${item.ai_why_it_matters || ''}`.toLowerCase()

  if (/\b(not relevant|irrelevant|no meaningful (?:sea|southeast asia)|unrelated to (?:sea|southeast asia))\b/.test(analysisText)) {
    return { action: 'skip', confidence, reason: 'explicitly_not_relevant' }
  }

  if (!item.ai_summary?.trim()) missing.push('summary')
  if (!item.ai_why_it_matters?.trim()) missing.push('why_it_matters')
  if (!item.country?.trim()) missing.push('country')
  if (!item.sector?.trim()) missing.push('sector')
  if (item.category === 'fundraising' && !item.company_name?.trim()) missing.push('company_name')

  if (missing.length > 0) {
    return {
      action: 'skip',
      confidence,
      reason: `missing:${missing.join(',')}`,
    }
  }

  const trustedDirect = source.kind === 'direct' && source.tier !== 'aggregator'
  const autoApproveAt = trustedDirect ? 0.68 : 0.75
  const evidenceStrong = item.evidence_quality === 'strong' || item.evidence_quality === 'moderate'

  if (confidence >= autoApproveAt && evidenceStrong) {
    return { action: 'approved', confidence, reason: null }
  }
  return {
    action: 'skip',
    confidence,
    reason: !evidenceStrong ? 'weak_evidence' : 'confidence_below_publish_threshold',
  }
}
