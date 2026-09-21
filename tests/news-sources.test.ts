import test from 'node:test'
import assert from 'node:assert/strict'
import { selectBalancedCandidates, type BalancedCandidate, type NewsMarket, type NewsScope } from '../lib/news-sources'

type Fixture = { id: string }

function candidates(scope: NewsScope, market: NewsMarket, count: number, offset = 0): BalancedCandidate<Fixture>[] {
  return Array.from({ length: count }, (_, index) => ({
    value: { id: `${market}-${index}` },
    scope,
    market,
    pubMs: 10_000 - offset - index,
  }))
}

test('enforces 40/40/20 scope targets and 45/30/25 APAC targets', () => {
  const pool = [
    ...candidates('sea', 'sea', 80),
    ...candidates('apac', 'china', 80, 100),
    ...candidates('apac', 'japan', 80, 200),
    ...candidates('apac', 'south_korea', 80, 300),
    ...candidates('global', 'global', 80, 400),
  ]
  const selected = selectBalancedCandidates(pool, 100)

  assert.equal(selected.length, 100)
  assert.equal(selected.filter(item => item.scope === 'sea').length, 40)
  assert.equal(selected.filter(item => item.scope === 'apac').length, 40)
  assert.equal(selected.filter(item => item.scope === 'global').length, 20)
  assert.equal(selected.filter(item => item.market === 'china').length, 18)
  assert.equal(selected.filter(item => item.market === 'japan').length, 12)
  assert.equal(selected.filter(item => item.market === 'south_korea').length, 10)
})

test('backfills a quiet APAC market without exceeding the APAC envelope', () => {
  const pool = [
    ...candidates('sea', 'sea', 40),
    ...candidates('apac', 'china', 40, 100),
    ...candidates('apac', 'japan', 2, 200),
    ...candidates('apac', 'south_korea', 20, 300),
    ...candidates('global', 'global', 20, 400),
  ]
  const selected = selectBalancedCandidates(pool, 100)

  assert.equal(selected.filter(item => item.scope === 'apac').length, 40)
  assert.equal(selected.filter(item => item.market === 'japan').length, 2)
  assert.equal(selected.filter(item => item.market === 'china').length, 28)
  assert.equal(selected.filter(item => item.market === 'south_korea').length, 10)
})
