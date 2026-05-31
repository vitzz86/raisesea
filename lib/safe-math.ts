// ═══════════════════════════════════════════════════════════════
// lib/safe-math.ts — SAFE & convertible note conversion math.
//
// Models how a SAFE or convertible note converts into equity at the
// next priced round, and the resulting dilution. Pure functions, no
// side effects — safe to call on every keystroke.
//
// Instruments:
//  - safe_post : post-money SAFE (YC 2018+). Ownership fixed at signing.
//  - safe_pre  : pre-money SAFE (older). SAFEs dilute each other + founder.
//  - note      : convertible note. Like a SAFE + interest accrual + maturity.
//
// Conversion rule (cap vs discount): the investor gets whichever gives
// them MORE shares (lower effective valuation). Discount only "wins" when
// the priced round prices BELOW the cap — otherwise the cap binds.
// (Confirmed: YC SAFE docs, Startup Law Review, Vault Catalyst 2026.)
// ═══════════════════════════════════════════════════════════════

export type Instrument = 'safe_post' | 'safe_pre' | 'note'

export type SafeInputs = {
  instrument: Instrument
  investment: number        // e.g. 500000
  valuationCap: number      // e.g. 8000000 (0 = no cap)
  discountPct: number       // e.g. 20 (percent; 0 = no discount)
  // Note-only:
  interestPct: number       // annual simple interest, e.g. 6
  termMonths: number        // months from investment to conversion, e.g. 18
  // Next priced round (the conversion trigger):
  nextPreMoney: number      // e.g. 20000000
  newMoneyRaised: number    // e.g. 5000000
  // Optional current cap table (for full before/after view):
  founderPct: number          // e.g. 100
  optionPoolPct: number       // e.g. 0
  existingInvestorPct: number // existing investors, e.g. 0
}

export type ConversionResult = {
  principalPlusInterest: number   // what converts (investment + accrued interest)
  principal: number               // original investment amount
  interestAccrued: number         // interest portion (notes only; 0 otherwise)
  capValuation: number | null     // the cap valuation used
  discountValuation: number | null// the discounted valuation used
  impliedPreMoneyCap: number | null   // cap expressed as a pre-money figure
  impliedPostMoneyCap: number | null  // cap expressed as a post-money figure
  conversionBasis: 'cap' | 'discount' | 'none'
  effectiveValuation: number      // valuation the SAFE investor effectively bought at
  // Post-round ownership split:
  investorOwnershipPct: number
  newInvestorOwnershipPct: number
  founderOwnershipPct: number
  optionPoolOwnershipPct: number
  existingInvestorOwnershipPct: number
  // Before (pre-conversion) ownership, for comparison:
  before: { founder: number; pool: number; existingInvestor: number }
  // Dilution deltas (before − after) for founder/pool/existing:
  dilution: { founder: number; pool: number; existingInvestor: number }
  explanation: string
  steps: { label: string; value: string }[]   // calculation breakdown
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

function accrued(inp: SafeInputs): { principal: number; interest: number; total: number } {
  const principal = inp.investment
  if (inp.instrument !== 'note') return { principal, interest: 0, total: principal }
  const years = (inp.termMonths || 0) / 12
  const interest = principal * (inp.interestPct / 100) * years
  return { principal, interest, total: principal + interest }
}

export function calculateConversion(inp: SafeInputs): ConversionResult {
  const { principal, interest, total: converting } = accrued(inp)
  const hasCap = inp.valuationCap > 0
  const hasDiscount = inp.discountPct > 0

  const capValuation = hasCap ? inp.valuationCap : Infinity
  const discountValuation = hasDiscount ? inp.nextPreMoney * (1 - inp.discountPct / 100) : Infinity

  let basis: 'cap' | 'discount' | 'none' = 'none'
  let effValuation = inp.nextPreMoney
  if (hasCap || hasDiscount) {
    if (capValuation <= discountValuation) { basis = 'cap'; effValuation = capValuation }
    else { basis = 'discount'; effValuation = discountValuation }
  }

  // Investor's fraction of the fully-diluted post-round cap table.
  // The instruments differ in HOW the cap relates to the round:
  //
  //  • POST-MONEY SAFE: the cap is a POST-money number that already includes
  //    the SAFE. When the cap binds, the investor's % is fixed at
  //    converting / cap (then diluted only by the NEW money + pool). This is
  //    the YC post-2018 promise: "% locked at signing."
  //
  //  • PRE-MONEY SAFE / NOTE: the cap is a PRE-money number. The SAFE and the
  //    new money both sit on top of it, so the denominator includes the SAFE
  //    itself: converting / (cap + converting + newMoney). More dilutive to
  //    the SAFE holder per dollar, and SAFEs dilute each other.
  let investorFrac: number
  let newInvestorFrac: number
  if (inp.instrument === 'safe_post' && basis === 'cap') {
    // Post-money: % fixed against the (post-money) cap, then new money dilutes everyone.
    const fracAtCap = converting / effValuation               // locked ownership at conversion
    const newFracOfPost = inp.newMoneyRaised / (effValuation + inp.newMoneyRaised)
    investorFrac = fracAtCap * (1 - newFracOfPost)             // diluted by the new round
    newInvestorFrac = newFracOfPost
  } else {
    // Pre-money SAFE, note, or discount/round-price path: SAFE sits on top of the valuation.
    const denom = effValuation + converting + inp.newMoneyRaised
    investorFrac = denom > 0 ? converting / denom : 0
    newInvestorFrac = denom > 0 ? inp.newMoneyRaised / denom : 0
  }

  const denom = effValuation + converting + inp.newMoneyRaised  // kept for the steps display

  const investorPct = clampPct(investorFrac * 100)
  const newInvestorPct = clampPct(newInvestorFrac * 100)

  // Existing holders (founder/pool/existing investors) share the remainder pro-rata.
  const remainingFrac = Math.max(0, 1 - investorFrac - newInvestorFrac)
  const bFounder = inp.founderPct > 0 ? inp.founderPct : 0
  const bPool = inp.optionPoolPct > 0 ? inp.optionPoolPct : 0
  const bExisting = inp.existingInvestorPct > 0 ? inp.existingInvestorPct : 0
  let priorTotal = bFounder + bPool + bExisting
  if (priorTotal === 0) { priorTotal = 100 }
  const beforeFounder = (bFounder || (bPool + bExisting === 0 ? 100 : 0))
  const beforeTotal = beforeFounder + bPool + bExisting || 100

  const founderPct = clampPct(remainingFrac * 100 * (beforeFounder / beforeTotal))
  const optionPoolPct = clampPct(remainingFrac * 100 * (bPool / beforeTotal))
  const existingInvestorPct = clampPct(remainingFrac * 100 * (bExisting / beforeTotal))

  const before = {
    founder: beforeFounder / beforeTotal * 100,
    pool: bPool / beforeTotal * 100,
    existingInvestor: bExisting / beforeTotal * 100,
  }
  const dilution = {
    founder: before.founder - founderPct,
    pool: before.pool - optionPoolPct,
    existingInvestor: before.existingInvestor - existingInvestorPct,
  }

  const explanation = buildExplanation(inp, basis, converting, investorPct, principal, interest)
  const steps = buildSteps(inp, basis, effValuation, converting, principal, interest, investorPct, denom)

  // Pre-money vs post-money cap, shown for clarity on every instrument.
  // For a post-money cap, the SAFE money is already inside the cap, so the
  // implied pre-money = cap − converting. For a pre-money cap, the cap is the
  // pre-money figure and post-money = cap + converting.
  let impliedPreMoneyCap: number | null = null
  let impliedPostMoneyCap: number | null = null
  if (hasCap) {
    if (inp.instrument === 'safe_post') {
      impliedPostMoneyCap = inp.valuationCap
      impliedPreMoneyCap = Math.max(0, inp.valuationCap - converting)
    } else {
      impliedPreMoneyCap = inp.valuationCap
      impliedPostMoneyCap = inp.valuationCap + converting
    }
  }

  return {
    principalPlusInterest: converting,
    principal, interestAccrued: interest,
    capValuation: hasCap ? capValuation : null,
    discountValuation: hasDiscount ? discountValuation : null,
    impliedPreMoneyCap, impliedPostMoneyCap,
    conversionBasis: basis,
    effectiveValuation: effValuation,
    investorOwnershipPct: investorPct,
    newInvestorOwnershipPct: newInvestorPct,
    founderOwnershipPct: founderPct,
    optionPoolOwnershipPct: optionPoolPct,
    existingInvestorOwnershipPct: existingInvestorPct,
    before, dilution, explanation, steps,
  }
}

export function fmtUSD(n: number): string {
  if (!isFinite(n)) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}

// Full number with thousands separators, e.g. 500000 -> "500,000"
export function fmtComma(n: number): string {
  if (!isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

function instrumentName(i: Instrument): string {
  return i === 'note' ? 'convertible note' : i === 'safe_post' ? 'post-money SAFE' : 'pre-money SAFE'
}

function buildExplanation(inp: SafeInputs, basis: 'cap' | 'discount' | 'none', converting: number, investorPct: number, principal: number, interest: number): string {
  const name = instrumentName(inp.instrument)
  const interestNote = inp.instrument === 'note' && interest > 0
    ? ` (your ${fmtUSD(principal)} principal grew to ${fmtUSD(converting)} after ${fmtUSD(interest)} interest)`
    : ''
  if (basis === 'cap') {
    return `Your next round (${fmtUSD(inp.nextPreMoney)} pre-money) is above your ${fmtUSD(inp.valuationCap)} cap, so the investor converts at the CAP${interestNote}. The cap gives them more shares than the discount would — normal when your value grows past the cap. They land at about ${investorPct.toFixed(2)}% on this ${name}.`
  }
  if (basis === 'discount') {
    return `Your round priced at or below the cap, so the DISCOUNT wins: the investor converts ${inp.discountPct}% below the round price${interestNote}, ending near ${investorPct.toFixed(2)}%. The cap didn't bind because your valuation stayed modest.`
  }
  return `With no cap or discount, the investor converts at the round price${interestNote} — the same terms as new investors, about ${investorPct.toFixed(2)}%.`
}

function buildSteps(inp: SafeInputs, basis: 'cap' | 'discount' | 'none', effVal: number, converting: number, principal: number, interest: number, investorPct: number, denom: number): { label: string; value: string }[] {
  const steps: { label: string; value: string }[] = []
  if (inp.instrument === 'note' && interest > 0) {
    steps.push({ label: 'Principal (your investment)', value: fmtUSD(principal) })
    steps.push({ label: `Interest (${inp.interestPct}% × ${(inp.termMonths / 12).toFixed(1)} yr, simple)`, value: `+ ${fmtUSD(interest)}` })
    steps.push({ label: 'Total converting', value: fmtUSD(converting) })
  } else {
    steps.push({ label: 'Amount converting', value: fmtUSD(converting) })
  }
  if (basis === 'cap') {
    steps.push({ label: 'Cap valuation', value: fmtUSD(inp.valuationCap) })
    if (inp.discountPct > 0) steps.push({ label: `Discount valuation (${fmtUSD(inp.nextPreMoney)} × ${100 - inp.discountPct}%)`, value: fmtUSD(inp.nextPreMoney * (1 - inp.discountPct / 100)) })
    steps.push({ label: 'Investor converts at (lower wins)', value: `${fmtUSD(effVal)} — cap` })
  } else if (basis === 'discount') {
    if (inp.valuationCap > 0) steps.push({ label: 'Cap valuation', value: fmtUSD(inp.valuationCap) })
    steps.push({ label: `Discount valuation (${fmtUSD(inp.nextPreMoney)} × ${100 - inp.discountPct}%)`, value: fmtUSD(effVal) })
    steps.push({ label: 'Investor converts at (lower wins)', value: `${fmtUSD(effVal)} — discount` })
  } else {
    steps.push({ label: 'Investor converts at round price', value: fmtUSD(effVal) })
  }
  // Final derivation differs by instrument + basis:
  //  • Post-money SAFE on the cap: % is LOCKED at converting/cap, then the new
  //    round dilutes it. Show that two-step derivation.
  //  • Everything else: SAFE sits on top → converting / (effVal + converting + newMoney).
  if (inp.instrument === 'safe_post' && basis === 'cap') {
    const lockedPct = (converting / effVal) * 100
    const postNew = effVal + inp.newMoneyRaised
    const newFracPct = postNew > 0 ? (inp.newMoneyRaised / postNew) * 100 : 0
    steps.push({ label: 'Locked % at cap (converting ÷ post-money cap)', value: `${fmtUSD(converting)} ÷ ${fmtUSD(effVal)} = ${lockedPct.toFixed(2)}%` })
    steps.push({ label: 'New round takes (new money ÷ (cap + new money))', value: `${newFracPct.toFixed(2)}%` })
    steps.push({ label: 'Investor % after new-round dilution', value: `${lockedPct.toFixed(2)}% × (1 − ${(newFracPct / 100).toFixed(3)}) = ${investorPct.toFixed(2)}%` })
  } else {
    steps.push({ label: 'Post-round total (eff. valuation + converting + new money)', value: fmtUSD(denom) })
    steps.push({ label: 'Investor % = converting ÷ total', value: `${fmtUSD(converting)} ÷ ${fmtUSD(denom)} = ${investorPct.toFixed(2)}%` })
  }
  return steps
}

// ─── Scenario comparison incl. a worst-case down round ─────────────
export type Scenario = {
  label: string
  sublabel: string
  nextPreMoney: number
  basis: 'cap' | 'discount' | 'none'
  investorPct: number
  founderPct: number
  isWorstCase?: boolean
}

export function calculateScenarios(inp: SafeInputs): Scenario[] {
  const mid = inp.nextPreMoney
  const out: Scenario[] = []

  // Worst case: a DOWN ROUND below the cap, so the discount path actually engages.
  // We price it at 50% of the cap (a real down round), which forces discount/round-price.
  const downPre = Math.max(1, Math.round((inp.valuationCap || mid) * 0.5))
  const downR = calculateConversion({ ...inp, nextPreMoney: downPre })
  out.push({
    label: 'Worst case', sublabel: 'Down round below your cap',
    nextPreMoney: downPre, basis: downR.conversionBasis,
    investorPct: downR.investorOwnershipPct, founderPct: downR.founderOwnershipPct,
    isWorstCase: true,
  })

  const points: { label: string; sublabel: string; mult: number }[] = [
    { label: 'Conservative', sublabel: 'Lower than expected', mult: 0.6 },
    { label: 'Expected', sublabel: 'Your input above', mult: 1.0 },
    { label: 'Optimistic', sublabel: 'Strong round', mult: 1.75 },
  ]
  for (const p of points) {
    const nextPreMoney = Math.round(mid * p.mult)
    const r = calculateConversion({ ...inp, nextPreMoney })
    out.push({
      label: p.label, sublabel: p.sublabel, nextPreMoney,
      basis: r.conversionBasis, investorPct: r.investorOwnershipPct, founderPct: r.founderOwnershipPct,
    })
  }
  return out
}

// ─── Per-instrument reference notes incl. worst-case mechanics ─────
export function instrumentNotes(instrument: Instrument): { title: string; points: string[]; worstCase: string } {
  if (instrument === 'safe_post') {
    return {
      title: 'Post-money SAFE',
      points: [
        'Investor ownership % is fixed the moment you sign: Investment ÷ post-money cap.',
        'Any SAFE you raise AFTER this one dilutes you (the founder), not this investor.',
        'At the priced round, the investor converts at the cap or the discount — whichever gives them more shares.',
        'The discount only matters if the round prices below the cap (uncommon in an up round).',
      ],
      worstCase: 'If your next round prices BELOW the cap (a down round), the cap no longer helps the investor — they convert on the discount instead, taking a bigger % of a smaller company, so your dilution is worse. If you are ACQUIRED before any priced round (a "Liquidity Event" in the YC SAFE), the post-money SAFE converts based on the ownership % implied by the cap (Investment ÷ cap), or pays back the investment — whichever the document specifies. Always check your SAFE\'s Liquidity Event clause.',
    }
  }
  if (instrument === 'safe_pre') {
    return {
      title: 'Pre-money SAFE',
      points: [
        'Conversion price is based on the cap measured BEFORE other SAFEs are counted.',
        'All SAFE holders dilute each other AND the founder — less predictable than post-money.',
        'You can keep raising on the same cap, stacking more convertibles on the same base.',
        'The next-round option pool increase also dilutes founders under this older structure.',
      ],
      worstCase: 'Because each new SAFE shares the same pre-money base, stacking several can dilute founders far more than expected — model every SAFE together, not one at a time. In a down round below the cap, the discount governs and the investor takes a larger slice. On an acquisition before a priced round, conversion follows the document\'s Liquidity Event terms (often cap-implied ownership or money back).',
    }
  }
  return {
    title: 'Convertible note',
    points: [
      'A note is DEBT: it accrues interest (here, simple interest) until it converts.',
      'At the priced round it converts like a SAFE — cap vs discount, whichever favors the investor — but on principal + accrued interest.',
      'It has a maturity date: a deadline by which it must convert, be repaid, or be extended.',
      'Interest increases the amount that converts, so the investor ends with slightly more than a same-terms SAFE.',
    ],
    worstCase: 'If MATURITY arrives and you have NOT raised a qualifying round, the note does not auto-convert — it becomes due as a debt. In practice the investor can (a) demand repayment of principal + accrued interest in cash, (b) agree to extend the maturity date, or (c) convert at the cap valuation or a pre-agreed price per the note terms. Repayment can be fatal for an early-stage startup with little cash, so the maturity clause and any "conversion at maturity" fallback are critical — read them carefully and negotiate a conversion (not repayment) default. In a down round, the discount governs as with a SAFE.',
  }
}
