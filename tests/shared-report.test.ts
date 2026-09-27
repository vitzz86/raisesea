import assert from 'node:assert/strict'
import test from 'node:test'
import { toSharedReport } from '../lib/shared-report'

test('shared reports keep analysis and exclude private and future database columns', () => {
  const report = toSharedReport({
    company_name: 'Example', deck_analysis: '{"overall_score":73}',
    founder_email: 'private@example.com', founder_linkedin: 'private-profile',
    user_id: 'owner-id', deck_url: 'private-deck', analysis_error: 'internal error',
    future_private_column: 'secret',
  })
  assert.equal(report.company_name, 'Example')
  assert.equal(report.deck_analysis, '{"overall_score":73}')
  for (const field of ['founder_email', 'founder_linkedin', 'user_id', 'deck_url', 'analysis_error', 'future_private_column']) {
    assert.equal(Object.hasOwn(report, field), false)
  }
  assert.equal(report.market_analysis, null)
})
