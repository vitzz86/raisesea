// ═══════════════════════════════════════════════════════════════
// lib/debt-math.ts
//
// Standard amortization math for debt instruments. Given:
//   - Principal (loan amount)
//   - Annual interest rate (%)
//   - Term in months
//
// Computes:
//   - Monthly payment (fixed payment amortization formula)
//   - Total interest paid over the term
//   - Per-month breakdown: principal / interest / total / remaining balance
//
// Standard formula: M = P * [ r(1+r)^n / ((1+r)^n - 1) ]
//   where M = monthly payment, P = principal, r = monthly rate, n = term in months
//
// If rate is 0%, falls back to even principal repayment.
// ═══════════════════════════════════════════════════════════════

export interface DebtInputs {
  /** Principal amount in USD */
  principal:       number
  /** Annual interest rate as a percentage (e.g. 8 = 8%) */
  annualRatePct:   number
  /** Loan term in months */
  termMonths:      number
}

export interface AmortizationRow {
  month:           number    // 1-indexed
  principalPaid:   number    // amount of THIS payment that goes to principal
  interestPaid:    number    // amount of THIS payment that goes to interest
  totalPayment:    number    // principal + interest for this period
  remainingBalance: number   // balance after this payment
}

export interface DebtResult {
  monthlyPayment:     number
  totalInterestPaid:  number
  totalPaid:          number   // monthlyPayment * termMonths
  effectiveAprPct:    number   // for display — same as input annualRatePct
  schedule:           AmortizationRow[]
}

export function calculateDebt(input: DebtInputs): DebtResult {
  const { principal, annualRatePct, termMonths } = input

  // Guard against bad inputs
  if (principal <= 0 || termMonths <= 0) {
    return {
      monthlyPayment:    0,
      totalInterestPaid: 0,
      totalPaid:         0,
      effectiveAprPct:   annualRatePct,
      schedule:          [],
    }
  }

  const monthlyRate = (annualRatePct / 100) / 12
  let monthlyPayment: number

  if (monthlyRate === 0) {
    // 0% interest — just split principal evenly
    monthlyPayment = principal / termMonths
  } else {
    // Standard amortization formula
    const factor = Math.pow(1 + monthlyRate, termMonths)
    monthlyPayment = principal * (monthlyRate * factor) / (factor - 1)
  }

  // Build the schedule
  const schedule: AmortizationRow[] = []
  let balance = principal
  for (let m = 1; m <= termMonths; m++) {
    const interestPaid  = balance * monthlyRate
    const principalPaid = monthlyPayment - interestPaid
    balance = Math.max(0, balance - principalPaid)
    schedule.push({
      month:            m,
      principalPaid:    principalPaid,
      interestPaid:     interestPaid,
      totalPayment:     monthlyPayment,
      remainingBalance: balance,
    })
  }

  const totalPaid         = monthlyPayment * termMonths
  const totalInterestPaid = totalPaid - principal

  return {
    monthlyPayment,
    totalInterestPaid,
    totalPaid,
    effectiveAprPct: annualRatePct,
    schedule,
  }
}

// ─── Formatters ───────────────────────────────────────────────────

export function fmtUSDPrecise(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0)
}

export function fmtUSDCompact(n: number): string {
  if (!n || n === 0) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
