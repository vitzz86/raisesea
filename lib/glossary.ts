// ═══════════════════════════════════════════════════════════════
// lib/glossary.ts
//
// Single source of truth for fundraising terms used across the app.
// Used by:
//   • <TermTooltip> component (inline tooltips on technical terms)
//   • /glossary page (full reference)
//
// Voice: Sharp Friend — plain English, no jargon-on-jargon, SEA-aware.
// ═══════════════════════════════════════════════════════════════

export interface GlossaryTerm {
  /** Canonical short form, e.g. "SAFE" */
  term:         string
  /** Full name expansion, e.g. "Simple Agreement for Future Equity" */
  fullName?:    string
  /** One-sentence plain-English definition (used in tooltips) */
  short:        string
  /** Longer explanation with example (used on glossary page) */
  long:         string
  /** Category for grouping on the glossary page */
  category:     'instruments' | 'metrics' | 'market_sizing' | 'cap_table' | 'rounds' | 'unit_economics'
  /** Aliases for matching/search */
  aliases?:     string[]
}

export const GLOSSARY: GlossaryTerm[] = [
  // ─── Instruments ─────────────────────────────────────────────
  {
    term: 'SAFE',
    fullName: 'Simple Agreement for Future Equity',
    short: 'A founder-friendly contract that lets investors put in money now and convert to equity later (at the next priced round).',
    long: 'A SAFE is an investment instrument popularized by Y Combinator. The investor wires money today; equity gets allocated later — usually at the next priced round, with either a valuation cap, a discount, or both. No interest, no maturity date, no debt. SAFEs are common for pre-seed and seed rounds in SEA because they\'re fast to close and don\'t require setting a valuation.',
    category: 'instruments',
  },
  {
    term: 'Convertible note',
    fullName: 'Convertible note',
    short: 'A short-term loan that converts into equity at the next priced round — like a SAFE, but with interest and a maturity date.',
    long: 'A convertible note is debt that converts to equity at the next priced round. Unlike a SAFE, it accrues interest (typically 4-8%) and has a maturity date (12-24 months) — if no priced round happens by then, the note matures and must be repaid or renegotiated. More common in markets where SAFEs aren\'t legally enforceable.',
    category: 'instruments',
  },
  {
    term: 'Valuation cap',
    short: 'The maximum company valuation at which a SAFE or note will convert into shares.',
    long: 'When you raise on a SAFE with a $10M cap and later raise a priced round at $20M, the SAFE investor converts as if the company were worth $10M — meaning they get twice as many shares. Caps protect early investors who took risk before the valuation got high.',
    category: 'instruments',
    aliases: ['cap', 'val cap'],
  },

  // ─── Cap table & dilution ────────────────────────────────────
  {
    term: 'Cap table',
    fullName: 'Capitalization table',
    short: 'A spreadsheet showing who owns what percentage of your company.',
    long: 'The cap table lists every shareholder (founders, employees with options, investors) and their ownership percentage. It updates every time you raise, issue options, or convert SAFEs. A clean, well-maintained cap table is a sign of a fundable company.',
    category: 'cap_table',
  },
  {
    term: 'Dilution',
    short: 'How much your ownership percentage drops when new shares are issued (typically to new investors).',
    long: 'If you own 100% of a company and sell 20% to an investor, you\'re now diluted to 80%. Dilution is the cost of capital — you trade ownership for money. Founders usually end up with 30-60% by Series B.',
    category: 'cap_table',
  },
  {
    term: 'Pro-rata',
    short: 'The right of existing investors to maintain their ownership percentage by investing in future rounds.',
    long: 'If an investor owns 10% of your company and you raise a new round, their pro-rata right lets them buy enough new shares to stay at 10%. Most VCs ask for pro-rata rights to protect their position in winning companies.',
    category: 'cap_table',
    aliases: ['pro rata', 'prorata'],
  },
  {
    term: 'Liquidation preference',
    short: 'How much an investor gets paid back FIRST when the company is sold — before founders see anything.',
    long: 'A 1x liquidation preference means investors get their money back before anyone else gets a cent. 2x means they get double. "Participating" preferences mean they also get their share of what\'s left. Stick to 1x non-participating — anything more is investor-unfriendly to founders.',
    category: 'cap_table',
    aliases: ['liq pref', 'lp'],
  },

  // ─── Metrics ─────────────────────────────────────────────────
  {
    term: 'MRR',
    fullName: 'Monthly Recurring Revenue',
    short: 'Predictable revenue you collect every month from subscriptions or contracts.',
    long: 'MRR is the holy metric for SaaS. If you have 100 customers paying $50/month, your MRR is $5,000. Investors love MRR because it\'s predictable — unlike one-time transactions. Annualize by multiplying by 12 to get ARR.',
    category: 'metrics',
  },
  {
    term: 'ARR',
    fullName: 'Annual Recurring Revenue',
    short: 'MRR × 12. Your subscription revenue annualized.',
    long: 'ARR is MRR × 12. It\'s a snapshot of your run-rate revenue if everything stayed constant for a year. SaaS valuations are typically expressed as multiples of ARR (e.g., "5x ARR" means a company with $1M ARR is valued at $5M).',
    category: 'metrics',
  },
  {
    term: 'ACV',
    fullName: 'Annual Contract Value',
    short: 'The average dollar value of a customer contract, per year.',
    long: 'If you have 10 customers and total annual contracted revenue is $500k, your ACV is $50k. ACV tells you whether you\'re selling to enterprises (high ACV, slow sales cycles) or SMBs (low ACV, fast volume).',
    category: 'metrics',
  },
  {
    term: 'NRR',
    fullName: 'Net Revenue Retention',
    short: 'Revenue from existing customers a year later — including expansion, downgrades, and churn.',
    long: 'NRR > 100% means existing customers are net-expanding (upgrades + new modules outweigh churn + downgrades). Best-in-class SaaS hits 120-130%. Investors care about NRR because it tells you whether your product is sticky.',
    category: 'metrics',
  },

  // ─── Market sizing ───────────────────────────────────────────
  {
    term: 'TAM',
    fullName: 'Total Addressable Market',
    short: 'The total revenue opportunity if you captured 100% of your market — globally and forever.',
    long: 'TAM is the maximum possible revenue if everyone who could ever use your product did so. Investors want to see TAM > $1B for venture-scale outcomes. Don\'t inflate it — sophisticated investors smell it immediately.',
    category: 'market_sizing',
  },
  {
    term: 'SAM',
    fullName: 'Serviceable Addressable Market',
    short: 'The slice of TAM you can realistically reach — usually filtered by geography, segment, or channel.',
    long: 'SAM = TAM, but realistic. If your TAM is "all SaaS spend globally" ($500B), your SAM might be "SaaS spend in SEA, mid-market" ($5B). SAM tells investors you understand who you actually sell to.',
    category: 'market_sizing',
  },
  {
    term: 'SOM',
    fullName: 'Serviceable Obtainable Market',
    short: 'The piece of SAM you can capture in 3-5 years — the size of the opportunity in YOUR roadmap.',
    long: 'SOM is what you\'ll actually capture given your competition, sales team, and timeline. Usually 1-10% of SAM. SOM should justify the size of round you\'re raising — if SOM is $50M and you\'re raising $20M, the math doesn\'t work.',
    category: 'market_sizing',
  },

  // ─── Unit economics ──────────────────────────────────────────
  {
    term: 'CAC',
    fullName: 'Customer Acquisition Cost',
    short: 'How much you spend on sales + marketing to land one new customer.',
    long: 'CAC = (sales + marketing spend) / customers acquired. If you spent $100k last quarter and got 50 new customers, CAC is $2k. Lower CAC is better, but CAC alone is meaningless — you need to compare it to LTV.',
    category: 'unit_economics',
  },
  {
    term: 'LTV',
    fullName: 'Lifetime Value',
    short: 'How much revenue you expect from a customer over their entire relationship with you.',
    long: 'LTV = (avg revenue per customer) × (avg customer lifespan). If customers pay $1k/year and stick around 3 years, LTV is $3k. LTV / CAC ratio matters — anything above 3x is healthy SaaS unit economics.',
    category: 'unit_economics',
  },
  {
    term: 'Burn rate',
    short: 'How much cash you lose per month (revenue minus expenses).',
    long: 'If you spend $200k/month and earn $50k, your burn is $150k. Burn comes in flavors: gross burn (just expenses), net burn (expenses minus revenue). Investors care about net burn because it tells them how long your runway is.',
    category: 'unit_economics',
    aliases: ['burn'],
  },
  {
    term: 'Runway',
    short: 'How many months you have before you run out of cash, at current burn rate.',
    long: 'Runway = (cash in bank) / (monthly net burn). If you have $1.2M and burn $100k/month, you have 12 months of runway. Investors expect 18-24 months of runway from a fresh round. Plan your next raise to start when you have 6+ months left.',
    category: 'unit_economics',
  },

  // ─── Round terminology ───────────────────────────────────────
  {
    term: 'Bridge round',
    short: 'A small interim raise to extend runway between major priced rounds — usually on a SAFE or note.',
    long: 'You raised a seed 14 months ago, you\'re not ready for Series A, but cash is getting tight. A bridge round (typically $500k-$2M) extends runway by 6-12 months. Often led by existing investors. Useful but a yellow flag if it happens repeatedly.',
    category: 'rounds',
    aliases: ['bridge', 'extension'],
  },
  {
    term: 'Pre-money valuation',
    short: 'What investors think your company is worth BEFORE they put their money in.',
    long: 'Pre-money is the agreed company value before the new investment. Post-money = pre-money + amount raised. If you raise $2M on a $8M pre-money, your post-money is $10M — and the new investor owns 20%.',
    category: 'rounds',
    aliases: ['pre-money', 'pre money'],
  },
  {
    term: 'Post-money valuation',
    short: 'Pre-money valuation PLUS the new money raised. The total value of the company after the round closes.',
    long: 'If you raise $2M on $8M pre-money, post-money is $10M. Investors who put in $2M own 20% (2 / 10). Always check whether a quoted valuation is pre or post — it changes your dilution math significantly.',
    category: 'rounds',
    aliases: ['post-money', 'post money'],
  },
  {
    term: 'ESOP',
    fullName: 'Employee Stock Option Plan',
    short: 'A pool of company shares reserved to grant to current and future employees as part of their compensation.',
    long: 'ESOP gives employees the option to buy company stock at a fixed price, usually with a vesting schedule (e.g., 4 years with a 1-year cliff). Typical pool size is 10–20% of fully-diluted shares. VCs in priced rounds often require expanding the pool BEFORE pricing — which dilutes founders only. Negotiate this carefully.',
    category: 'cap_table',
    aliases: ['option pool', 'esop pool', 'employee stock option pool'],
  },
  {
    term: 'Amortization',
    short: 'Paying off a loan in equal monthly installments where each payment is partly principal + partly interest.',
    long: 'Standard amortization spreads your loan repayment evenly across the term. Early payments are mostly interest; later payments are mostly principal. A $500K loan at 8% over 36 months has monthly payments of $15,668 and you pay $64,054 in total interest. The full schedule shows exactly when each dollar shifts from interest to principal.',
    category: 'instruments',
    aliases: ['amortize', 'loan amortization'],
  },
  {
    term: 'APR',
    fullName: 'Annual Percentage Rate',
    short: 'The yearly cost of borrowing money, expressed as a percentage of the loan amount.',
    long: 'APR includes the interest rate plus any mandatory fees. For SEA debt: bank SME loans run 6–10% APR, venture debt 10–14%, revenue-based financing 12–24% effective. The "effective" APR matters more than the headline — a 12% rate with monthly compounding costs more than a flat 12%.',
    category: 'instruments',
    aliases: ['annual percentage rate', 'interest rate'],
  },
  {
    term: 'CAGR',
    fullName: 'Compound Annual Growth Rate',
    short: 'The average yearly growth rate of a market or revenue figure over multiple years, smoothed for compounding.',
    long: 'If a market grows from $1B to $2B over 5 years, the CAGR is roughly 15% (not 20%, because growth compounds). Investors look for SEA markets with 20%+ CAGR — anything below 10% is mature/slow, anything above 40% is hot but might be hype. Formula: (end ÷ start)^(1/years) − 1.',
    category: 'market_sizing',
    aliases: ['compound annual growth rate', 'compound growth rate'],
  },
  {
    term: 'EV/Revenue',
    fullName: 'Enterprise Value to Revenue multiple',
    short: 'A valuation ratio comparing the company\'s enterprise value to its annual revenue. Used to price companies vs comparable peers.',
    long: 'If a SaaS company has $5M ARR and trades at 8x EV/Revenue, its enterprise value is $40M. SEA multiples vary by sector — early-stage SaaS often 8–15x, marketplaces 2–5x, fintech 4–10x. Lower multiples than the US (where SaaS can hit 20x+) because SEA markets are smaller and less liquid.',
    category: 'market_sizing',
    aliases: ['ev/rev', 'enterprise value to revenue', 'revenue multiple'],
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────

const TERM_INDEX: Map<string, GlossaryTerm> = new Map()
for (const t of GLOSSARY) {
  TERM_INDEX.set(t.term.toLowerCase(), t)
  for (const alias of t.aliases || []) {
    TERM_INDEX.set(alias.toLowerCase(), t)
  }
}

/** Look up a glossary term by name or alias (case-insensitive). */
export function findTerm(query: string): GlossaryTerm | null {
  return TERM_INDEX.get(query.toLowerCase().trim()) || null
}

/** Group glossary terms by category for the glossary page. */
export function groupByCategory(): Record<GlossaryTerm['category'], GlossaryTerm[]> {
  const groups: Record<string, GlossaryTerm[]> = {}
  for (const t of GLOSSARY) {
    if (!groups[t.category]) groups[t.category] = []
    groups[t.category].push(t)
  }
  return groups as Record<GlossaryTerm['category'], GlossaryTerm[]>
}

export const CATEGORY_LABELS: Record<GlossaryTerm['category'], string> = {
  instruments:     'Investment instruments',
  cap_table:       'Cap table & ownership',
  metrics:         'Revenue metrics',
  market_sizing:   'Market sizing',
  unit_economics:  'Unit economics',
  rounds:          'Round terminology',
}
