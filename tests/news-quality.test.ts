import test from 'node:test'
import assert from 'node:assert/strict'
import { decidePublication, isNearDuplicateTitle } from '../lib/news-quality'

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
  assert.equal(result.action, 'approved')
  assert.equal(result.reason, null)
})

test('skips incomplete records instead of creating an approval queue', () => {
  const result = decidePublication({ ...complete, company_name: null, confidence: 0.75 }, { kind: 'direct', tier: 'specialist' })
  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'missing:company_name')
})

test('skips weak records', () => {
  const result = decidePublication({ ...complete, confidence: 0.3, evidence_quality: 'weak' }, { kind: 'direct', tier: 'specialist' })
  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'weak_evidence')
})

test('rejects explicit irrelevance even when the model confidence is high', () => {
  const result = decidePublication({
    ...complete,
    confidence: 0.97,
    ai_why_it_matters: 'This sports result is not relevant to Southeast Asia startup founders.',
  }, { kind: 'direct', tier: 'specialist' })
  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'explicitly_not_relevant')
})

test('skips borderline discovery records without manual review', () => {
  const result = decidePublication({ ...complete, confidence: 0.71 }, { kind: 'discovery', tier: 'aggregator' })
  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'confidence_below_publish_threshold')
})

test('detects syndicated versions of the same company event', () => {
  assert.equal(isNearDuplicateTitle(
    'Grab takes majority stake in Atome Financial in $1.5 billion deal',
    ['Grab to acquire majority stake in Atome Financial, accelerating financial services growth'],
  ), true)
})

test('keeps different events from the same company', () => {
  assert.equal(isNearDuplicateTitle(
    'Grab launches merchant lending product in Indonesia',
    ['Grab to acquire majority stake in Atome Financial'],
  ), false)
})
