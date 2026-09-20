import test from 'node:test'
import assert from 'node:assert/strict'
import { decidePublication } from '../lib/news-quality'

const complete = {
  category: 'fundraising',
  company_name: 'Example Labs',
  country: 'Indonesia',
  sector: 'Fintech',
  ai_summary: 'Example Labs raised a seed round for its payment platform.',
  ai_why_it_matters: 'The round shows specialist investors are still backing regulated payment infrastructure.',
  confidence: 0.86,
  evidence_quality: 'strong',
}

test('auto-publishes strong records from a specialist direct feed', () => {
  const result = decidePublication(complete, { kind: 'direct', tier: 'specialist' })
  assert.deepEqual(result, { action: 'approved', confidence: 0.86, reason: null })
})

test('requires higher confidence for discovery/aggregator records', () => {
  const result = decidePublication({ ...complete, confidence: 0.76 }, { kind: 'discovery', tier: 'aggregator' })
  assert.equal(result.action, 'pending')
  assert.equal(result.reason, 'confidence_below_auto_publish')
})

test('quarantines incomplete but plausible records without blocking the pipeline', () => {
  const result = decidePublication({ ...complete, company_name: null, confidence: 0.75 }, { kind: 'direct', tier: 'specialist' })
  assert.equal(result.action, 'pending')
  assert.equal(result.reason, 'missing:company_name')
})

test('skips weak records', () => {
  const result = decidePublication({ ...complete, confidence: 0.3, evidence_quality: 'weak' }, { kind: 'direct', tier: 'specialist' })
  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'low_confidence')
})
