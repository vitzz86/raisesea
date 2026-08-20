import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDebt } from '../lib/debt-math'
import { calculateEquity } from '../lib/equity-math'
import { calculateConversion } from '../lib/safe-math'

test('priced equity round preserves a 100% cap table', () => {
  const result = calculateEquity({
    preMoney: 8_000_000,
    raiseAmount: 2_000_000,
    founderPct: 80,
    esopPct: 10,
    existingInvestorPct: 10,
  })
  assert.equal(result.valid, true)
  assert.equal(result.after.newInvestor, 20)
  const total = Object.values(result.after).reduce((sum, value) => sum + value, 0)
  assert.ok(Math.abs(total - 100) < 1e-9)
})
test('debt amortization ends at zero and principal plus interest reconciles', () => {
  const result = calculateDebt({ principal: 100_000, annualRatePct: 12, termMonths: 12 })
  assert.equal(result.schedule.length, 12)
  assert.ok(Math.abs(result.schedule.at(-1)!.remainingBalance) < 1e-6)
  assert.ok(Math.abs(result.totalPaid - 100_000 - result.totalInterestPaid) < 1e-6)
})

test('SAFE conversion preserves a 100% post-round cap table', () => {
  const result = calculateConversion({
    instrument: 'safe_post',
    investment: 500_000,
    valuationCap: 8_000_000,
    discountPct: 20,
    interestPct: 0,
    termMonths: 0,
    nextPreMoney: 12_000_000,
    newMoneyRaised: 3_000_000,
    founderPct: 100,
    optionPoolPct: 0,
    existingInvestorPct: 0,
  })
  assert.equal(result.conversionBasis, 'cap')
  const total = result.investorOwnershipPct + result.newInvestorOwnershipPct +
    result.founderOwnershipPct + result.optionPoolOwnershipPct + result.existingInvestorOwnershipPct
  assert.ok(Math.abs(total - 100) < 1e-9)
})
