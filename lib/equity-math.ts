// ═══════════════════════════════════════════════════════════════
// lib/equity-math.ts
//
// Priced-round equity math. Models a Series-style priced round
// against the user's existing cap table.
//
// Math is straightforward:
//   - New investor takes (raiseAmount / postMoney) of the post-money cap table
//   - Everyone else (founder, ESOP, existing investors) dilutes pro-rata
//     to make room. Their share-of-the-remaining stays the same; their
//     overall % drops because the cap table got bigger.
//
// No "option pool refresh" — this calculator uses your CURRENT cap
// table as-is (including any existing ESOP), and just models what the
// new investor's slice does to everyone else.
//
// Pure functions, no side effects.
// ═══════════════════════════════════════════════════════════════

export interface EquityInputs {
  preMoney:           number   // Pre-money valuation, USD
  raiseAmount:        number   // New money this round, USD

  // Current cap table (must sum to 100)
  founderPct:         number
  esopPct:            number   // Current ESOP / option pool
  existingInvestorPct: number  // Previous investors (angels, prior SAFE holders converted, prior VCs)
}

export interface CapTableState {
  founder:           number
  esop:              number
  existingInvestor:  number
  newInvestor:       number
}

export interface EquityResult {
  postMoney:           number
  pricePerShareImplied: number    // For display only — assumes 10M shares baseline

  before:              CapTableState
  after:               CapTableState

  /** Percentage-point change per holder (positive = lost, negative = gained) */
  dilution: {
    founder:          number
    esop:             number
    existingInvestor: number
  }

  /** True if inputs are valid and the result is meaningful */
  valid: boolean
  /** Validation error if any */
  validationError?: string
}

// ─── Core calculation ───────────────────────────────────────────

export function calculateEquity(inp: EquityInputs): EquityResult {
  const { preMoney, raiseAmount, founderPct, esopPct, existingInvestorPct } = inp

  // Validate current ownership sums to 100
  const totalBefore = founderPct + esopPct + existingInvestorPct
  if (Math.abs(totalBefore - 100) > 0.5) {
    return zeroResult(`Current ownership must sum to 100% (currently ${totalBefore.toFixed(1)}%)`)
  }

  if (preMoney <= 0 || raiseAmount <= 0) {
    return zeroResult('Pre-money and raise amount must be positive')
  }

  const postMoney      = preMoney + raiseAmount
  const newInvestorPct = (raiseAmount / postMoney) * 100

  // Everyone else dilutes pro-rata. Their fraction of the remaining slice
  // stays the same; their absolute % drops because the pie got bigger.
  const dilutionFactor = 1 - newInvestorPct / 100

  const founderAfterPct  = founderPct * dilutionFactor
  const esopAfterPct     = esopPct    * dilutionFactor
  const existingAfterPct = existingInvestorPct * dilutionFactor

  return {
    postMoney,
    pricePerShareImplied: preMoney / 10_000_000,
    before: {
      founder:          founderPct,
      esop:             esopPct,
      existingInvestor: existingInvestorPct,
      newInvestor:      0,
    },
    after: {
      founder:          founderAfterPct,
      esop:             esopAfterPct,
      existingInvestor: existingAfterPct,
      newInvestor:      newInvestorPct,
    },
    dilution: {
      founder:          founderPct - founderAfterPct,
      esop:             esopPct - esopAfterPct,
      existingInvestor: existingInvestorPct - existingAfterPct,
    },
    valid: true,
  }
}

function zeroResult(error: string): EquityResult {
  return {
    postMoney: 0,
    pricePerShareImplied: 0,
    before: { founder: 0, esop: 0, existingInvestor: 0, newInvestor: 0 },
    after:  { founder: 0, esop: 0, existingInvestor: 0, newInvestor: 0 },
    dilution: { founder: 0, esop: 0, existingInvestor: 0 },
    valid: false,
    validationError: error,
  }
}

// ─── Scenario analysis ──────────────────────────────────────────

export interface EquityScenario {
  label:               string
  preMoney:            number
  raiseAmount:         number
  postMoney:           number
  founderAfterPct:     number
  newInvestorPct:      number
  founderDilution:     number
  highlight?:          boolean
}

/**
 * Vary key terms around the user's inputs.
 * Shows how dilution responds to valuation + raise size.
 */
export function calculateEquityScenarios(inp: EquityInputs): EquityScenario[] {
  const variants: { label: string; preMoneyMult: number; raiseMult: number; highlight?: boolean }[] = [
    { label: 'Down 25% (tough market)',         preMoneyMult: 0.75, raiseMult: 1.0 },
    { label: 'Your terms',                       preMoneyMult: 1.0,  raiseMult: 1.0, highlight: true },
    { label: 'Up 25% (premium valuation)',       preMoneyMult: 1.25, raiseMult: 1.0 },
    { label: 'Raise less (50% of target)',       preMoneyMult: 1.0,  raiseMult: 0.5 },
    { label: 'Raise more (150% of target)',      preMoneyMult: 1.0,  raiseMult: 1.5 },
  ]

  return variants.map(v => {
    const scenarioInputs: EquityInputs = {
      ...inp,
      preMoney:    inp.preMoney * v.preMoneyMult,
      raiseAmount: inp.raiseAmount * v.raiseMult,
    }
    const r = calculateEquity(scenarioInputs)
    return {
      label:           v.label,
      preMoney:        scenarioInputs.preMoney,
      raiseAmount:     scenarioInputs.raiseAmount,
      postMoney:       r.postMoney,
      founderAfterPct: r.after.founder,
      newInvestorPct:  r.after.newInvestor,
      founderDilution: r.dilution.founder,
      highlight:       v.highlight,
    }
  })
}

// ─── Formatters ─────────────────────────────────────────────────

export function fmtUSD(n: number): string {
  if (!n || n === 0) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function fmtPct(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`
}

export function fmtComma(n: number): string {
  return n.toLocaleString('en-US')
}
