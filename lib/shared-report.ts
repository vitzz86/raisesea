// Explicit allowlist: new database columns must not silently become public.
const REPORT_FIELDS = [
  'company_name', 'country', 'stage', 'raise_target_usd', 'sector',
  'business_model', 'annual_revenue_usd', 'current_mrr_usd', 'sector_profile',
  'match_results', 'warm_intros', 'deck_analysis', 'market_analysis',
  'competitive_analysis',
] as const

export function toSharedReport(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(REPORT_FIELDS.map(field => [field, row[field] ?? null]))
}
