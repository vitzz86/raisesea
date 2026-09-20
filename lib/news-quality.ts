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
  action: 'approved' | 'pending' | 'skip'
  confidence: number
  reason: string | null
}

function normalizeConfidence(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0
  const n = Number(value)
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n))
}

/**
 * Human review is an exception path, not a pipeline gate:
 * - strong records publish immediately;
 * - ambiguous-but-usable records enter the non-blocking review queue;
 * - weak records are skipped and can be retried if a better source appears.
 */
export function decidePublication(
  item: QualitySignals,
  source: Pick<NewsSource, 'kind' | 'tier'>,
): PublicationDecision {
  const confidence = normalizeConfidence(item.confidence)
  const missing: string[] = []

  if (!item.ai_summary?.trim()) missing.push('summary')
  if (!item.ai_why_it_matters?.trim()) missing.push('why_it_matters')
  if (!item.country?.trim()) missing.push('country')
  if (!item.sector?.trim()) missing.push('sector')
  if (item.category === 'fundraising' && !item.company_name?.trim()) missing.push('company_name')

  if (missing.length > 0) {
    return {
      action: confidence >= 0.55 ? 'pending' : 'skip',
      confidence,
      reason: `missing:${missing.join(',')}`,
    }
  }

  const trustedDirect = source.kind === 'direct' && source.tier !== 'aggregator'
  const autoApproveAt = trustedDirect ? 0.72 : 0.8
  const evidenceStrong = item.evidence_quality === 'strong' || item.evidence_quality === 'moderate'

  if (confidence >= autoApproveAt && evidenceStrong) {
    return { action: 'approved', confidence, reason: null }
  }
  if (confidence >= 0.55) {
    return {
      action: 'pending',
      confidence,
      reason: confidence < autoApproveAt ? 'confidence_below_auto_publish' : 'weak_evidence',
    }
  }
  return { action: 'skip', confidence, reason: 'low_confidence' }
}
