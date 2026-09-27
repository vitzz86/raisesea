// ═══════════════════════════════════════════════════════════════
// components/landing/LandingSections.tsx
//
// Presentational sections for the rebuilt landing page. Kept out of
// app/page.tsx so the page file stays a readable composition of the
// narrative rather than 900 lines of markup.
//
// Every section here is a server component — no hooks, no state — so
// the page's first paint contains the full story. The only client
// components on the page are the nav, the hero walkthrough, and the
// scroll-reveal wrappers.
//
// Visual rules applied throughout:
//   • Two corner radii only: 8px for content cards (rounded-card),
//     16px for product-screenshot frames (rounded-2xl) — a frame that
//     depicts an app window is a different object from a content card.
//   • Tabular numerals on every figure that sits in a column.
//   • No metric is ever rendered as 0 on first paint.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight, BarChart3, Mic, Building2, Briefcase, Calculator,
  Radar, Lock, Trash2, ServerCog, ShieldCheck, Sparkles, Globe2,
} from 'lucide-react'
import { ScrollReveal } from '@/components/landing/ScrollReveal'
import { RaiseSEALogo } from '@/components/brand/RaiseSEALogo'

// ─── Shared: section eyebrow + heading ────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="h-px w-6 bg-brand/40" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wider text-brand">{children}</span>
    </div>
  )
}

export function SectionHeading({
  label, title, lede, align = 'split',
}: {
  label: string
  title: string
  lede?: string
  align?: 'left' | 'center' | 'split'
}) {
  // Editorial split: heading anchored left, supporting copy set against it on
  // the right baseline. Reads as an article opener rather than a centred
  // marketing stack, and stops every section looking identical.
  if (align === 'split') {
    return (
      <ScrollReveal>
        <div className="grid gap-6 md:grid-cols-[1.05fr_1fr] md:items-end">
          <div>
            <SectionLabel>{label}</SectionLabel>
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-text-primary text-balance md:text-2xl">
              {title}
            </h2>
          </div>
          {lede && (
            <p className="text-base leading-relaxed text-text-secondary text-pretty md:pb-1">{lede}</p>
          )}
        </div>
      </ScrollReveal>
    )
  }

  const centered = align === 'center'
  return (
    <ScrollReveal>
      <div className={centered ? 'flex flex-col items-center text-center' : ''}>
        <SectionLabel>{label}</SectionLabel>
        <h2 className="text-xl font-semibold leading-tight tracking-tight text-text-primary text-balance md:text-2xl">
          {title}
        </h2>
        {lede && (
          <p className={`mt-4 max-w-2xl text-base leading-relaxed text-text-secondary text-pretty ${centered ? 'mx-auto' : ''}`}>
            {lede}
          </p>
        )}
      </div>
    </ScrollReveal>
  )
}

// ─── Section 1: immediate credibility strip ───────────────────────
// Capability claims, deliberately not a metrics banner. The investor
// count used to lead the page as "750+ funds" — which made database
// size the value proposition and invited a sourcing question the page
// could not answer. Coverage now lives in the Investor Intelligence
// section, where the matching method provides its own context.

const CREDIBILITY = [
  {
    icon: Building2,
    title: 'Active investor matching',
    body: 'Match with investors across the region who are deploying capital now.',
  },
  {
    icon: BarChart3,
    title: 'Fundraising readiness',
    body: 'Assess your deck across the dimensions investors actually score.',
  },
  {
    icon: Briefcase,
    title: 'End-to-end workflow',
    body: 'From deck preparation through to a managed investor pipeline.',
  },
  {
    icon: Radar,
    title: 'Regional intelligence',
    body: 'Insight grounded in how fundraising works in local markets.',
  },
]

export function CredibilityStrip() {
  return (
    <section aria-label="What RaiseSEA provides" className="px-6 pb-20 md:pb-28">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {CREDIBILITY.map(item => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="group surface-sheen p-6 transition-colors hover:bg-brand-pale/60"
                >
                  <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-input bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-text-inverse">
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-tertiary">{item.body}</p>
                </div>
              )
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ─── Section 2: the fundraising journey ───────────────────────────

const JOURNEY = [
  {
    stage: 'Assess',
    icon: BarChart3,
    title: 'Know how investors may see your raise.',
    body: 'Analyze your pitch deck and identify gaps across the dimensions that decide a round.',
    product: 'Deck Analysis',
    href: '/tools/calculator',
  },
  {
    stage: 'Prepare',
    icon: Mic,
    title: 'Prepare for the questions that matter.',
    body: 'Practise your pitch and rehearse investor-style questions before the real meeting.',
    product: 'AI Mock Pitch',
    href: '/mock-pitch',
  },
  {
    stage: 'Match',
    icon: Building2,
    title: 'Find investors that actually fit.',
    body: 'Discover investors by market, stage, sector, cheque size, geography and investment focus.',
    product: 'Investor Matching',
    href: '/login?next=/apply',
  },
  {
    stage: 'Execute',
    icon: Briefcase,
    title: 'Run your raise from one place.',
    body: 'Track investors, outreach, meetings and follow-ups through a single pipeline.',
    product: 'Investor CRM',
    href: '/crm',
  },
  {
    stage: 'Decide',
    icon: Calculator,
    title: 'Understand the economics before signing.',
    body: 'Model dilution and compare financing structures before you commit to terms.',
    product: 'Equity · SAFE / Note · Debt',
    href: '/tools/calculator',
  },
  {
    stage: 'Stay sharp',
    icon: Radar,
    title: 'See what is moving across APAC.',
    body: 'Follow funding activity, investor mandates, exits and regulation that affect your raise.',
    product: 'APAC Fundraising Intelligence',
    href: '/news',
  },
]

export function JourneySection() {
  return (
    <section id="journey" aria-labelledby="journey-heading" className="px-6 py-20 md:py-24 bg-surface-card border-y border-border">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center">
            <SectionLabel>The fundraising journey</SectionLabel>
            <h2 id="journey-heading" className="text-xl md:text-2xl font-semibold tracking-tight text-balance">
              From your first deck to the term sheet.
            </h2>
            <p className="text-base text-text-secondary mt-4 max-w-2xl mx-auto leading-relaxed text-pretty">
              Most fundraising tools cover one step. RaiseSEA runs the whole arc — so the work you do at
              each stage actually feeds the next one.
            </p>
          </div>
        </ScrollReveal>

        {/* The six stages, connected so they read as one arc rather than six
            unrelated utilities. */}
        <ScrollReveal delay={80}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
            {JOURNEY.map((step, i) => (
              <div key={step.stage} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-gradient-to-b from-white to-brand-pale/70 px-3.5 py-2 shadow-subtle">
                  <span className="text-xs font-semibold tabular-nums text-brand">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">{step.stage}</span>
                </span>
                {i < JOURNEY.length - 1 && (
                  <span aria-hidden="true" className="hidden h-px w-6 bg-gradient-to-r from-border-strong to-transparent sm:block" />
                )}
              </div>
            ))}
          </div>
        </ScrollReveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-12">
          {JOURNEY.map((step, i) => {
            const Icon = step.icon
            return (
              <ScrollReveal key={step.stage} delay={i * 60}>
                <div className="card-hover surface-sheen group flex h-full flex-col rounded-card border border-border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-input bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-text-inverse">
                      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-text-tertiary">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-text-primary">{step.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary text-pretty">{step.body}</p>
                  <div className="mt-5 border-t border-border-muted pt-4">
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{step.product}</span>
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Section 3: product walkthrough ───────────────────────────────
// Compact 2×2 grid. The previous page ran six full-width alternating
// sections, which is what pushed the homepage to 12 desktop / 17
// mobile viewports and made it read as a feature catalogue.

export function WalkthroughSection({ mockups }: { mockups: ReactNode[] }) {
  const STEPS = [
    {
      n: '01',
      title: 'Understand your fundraising readiness',
      body: 'Upload your deck and receive structured analysis across the dimensions investors score, benchmarked on regional raises.',
    },
    {
      n: '02',
      title: 'Discover relevant investors',
      body: 'Filter and match on market, stage, sector, investment focus and cheque size — with a stated reason for every match.',
    },
    {
      n: '03',
      title: 'Prepare for investor meetings',
      body: 'Rehearse with AI Mock Pitch, get scored on delivery, and walk into the room already having answered the hard questions.',
    },
    {
      n: '04',
      title: 'Manage your raise',
      body: 'Keep investors, outreach, meetings, follow-ups, notes and status in one pipeline instead of a spreadsheet.',
    },
  ]

  return (
    <section id="product" aria-labelledby="product-heading" className="px-6 py-20 md:py-24">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          label="Product walkthrough"
          title="See the product, not a promise."
          lede="Four workflows, taken straight from the real interface. No abstract illustrations."
        />

        <div className="grid lg:grid-cols-2 gap-6 mt-12">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.n} delay={i * 70}>
              <article className="card-hover surface-sheen flex h-full flex-col rounded-card border border-border p-5 md:p-6">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-xs font-semibold tabular-nums text-brand">{step.n}</span>
                  <h3 className="text-base font-semibold text-text-primary leading-snug text-balance">{step.title}</h3>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed mb-5 text-pretty">{step.body}</p>
                <div className="mt-auto">
                  {/* The mockups are illustrations of the real interface, and
                      they contain real <button> elements (Submit for analysis,
                      Filter, Add contact...) purely for visual fidelity. Those
                      are not controls — without this they sit in the tab order
                      and a keyboard or screen-reader user ends up walking
                      through a picture of an app. `inert` removes the whole
                      subtree from focus and assistive tech; the section copy
                      above already carries the meaning. */}
                  <div inert aria-hidden="true">
                    {mockups[i]}
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 4: why RaiseSEA ──────────────────────────────────────

const DIFFERENTIATORS = [
  {
    title: 'Market-specific intelligence',
    body: 'Investor expectations, valuations and fundraising norms differ across Asia Pacific. Advice benchmarked on US growth charts does not describe a seed round in Jakarta or Ho Chi Minh City.',
  },
  {
    title: 'Investor relevance',
    body: 'A directory of thousands of funds is not useful if none of them write your cheque size in your market. RaiseSEA optimises for mandate fit rather than list length.',
  },
  {
    title: 'One fundraising workflow',
    body: 'Preparation, investor discovery and execution in one place — instead of five disconnected tools that each hold a fragment of your raise.',
  },
]

export function WhySection() {
  return (
    <section id="why" aria-labelledby="why-heading" className="bg-brand-deep relative isolate overflow-hidden px-6 py-20 text-text-inverse md:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-70" />
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="grid gap-6 md:grid-cols-2 md:items-end">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-6 bg-white/30" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Why RaiseSEA</span>
              </div>
              <h2 id="why-heading" className="text-xl font-semibold leading-tight tracking-tight text-balance md:text-2xl">
                Fundraising is local. Your tools should be too.
              </h2>
            </div>
            <p className="text-base leading-relaxed text-white/85 text-pretty md:pb-1">
              RaiseSEA combines fundraising tools with regional investor and market intelligence, rather
              than generic global fundraising advice.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {DIFFERENTIATORS.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 70}>
              <div className="h-full rounded-card border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.09]">
                <span className="text-xs font-semibold tabular-nums text-white/60">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 text-base font-semibold leading-snug text-text-inverse">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85 text-pretty">{item.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 5: APAC coverage ─────────────────────────────────────
// Deliberately distinguishes depth from ambition. Every market is not
// presented as equally developed, because the datasets are not.

const DEEP_MARKETS = ['Indonesia', 'Singapore', 'Vietnam', 'Philippines', 'Malaysia', 'Thailand']
const EXPANDING_MARKETS = ['India', 'Australia', 'Japan', 'South Korea', 'Hong Kong', 'Taiwan', 'New Zealand']

export function CoverageSection() {
  return (
    <section id="coverage" aria-labelledby="coverage-heading" className="px-6 py-20 md:py-24">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          label="Market coverage"
          title="Built for fundraising across Asia Pacific."
          lede="RaiseSEA is building market-specific fundraising intelligence across APAC, starting from deep coverage of Southeast Asia. APAC is not one fundraising market, and the product does not treat it as one."
        />

        <div className="grid md:grid-cols-[1fr_1.4fr] gap-5 mt-12">
          <ScrollReveal>
            <div className="h-full rounded-card border border-brand/25 bg-brand-soft p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe2 className="w-4 h-4 text-brand" strokeWidth={2} aria-hidden="true" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand">Deep coverage</h3>
              </div>
              <p className="text-base font-semibold text-text-primary">Southeast Asia</p>
              <ul className="flex flex-wrap gap-2 mt-4">
                {DEEP_MARKETS.map(market => (
                  <li key={market} className="rounded-input border border-brand/20 bg-surface-card px-2.5 py-1 text-xs font-medium text-text-secondary">
                    {market}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div className="card-hover surface-sheen h-full rounded-card border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Radar className="w-4 h-4 text-text-tertiary" strokeWidth={2} aria-hidden="true" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Expanding</h3>
              </div>
              <p className="text-base font-semibold text-text-primary">Broader Asia Pacific</p>
              <ul className="flex flex-wrap gap-2 mt-4">
                {EXPANDING_MARKETS.map(market => (
                  <li key={market} className="rounded-input border border-border bg-surface-page px-2.5 py-1 text-xs font-medium text-text-secondary">
                    {market}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-tertiary mt-5 leading-relaxed">
                Coverage depth varies by market and is being extended deliberately. Where the underlying
                dataset is thinner, the product says so rather than implying equal depth.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

// ─── Section 6: investor intelligence ─────────────────────────────

const MATCH_INPUTS = [
  { label: 'Market',       value: 'Indonesia' },
  { label: 'Stage',        value: 'Seed' },
  { label: 'Sector',       value: 'Climate tech' },
  { label: 'Target round', value: 'US$500K – US$1.5M' },
  { label: 'Focus',        value: 'Early-stage climate / energy' },
]

const MATCH_RESULTS = [
  { name: 'Regional climate fund', meta: 'Seed · Jakarta & Singapore', score: 94, why: 'Mandate covers early-stage climate in Indonesia.' },
  { name: 'Sector-agnostic seed VC', meta: 'Pre-seed – Seed · SEA', score: 88, why: 'Cheque size and stage both sit in range.' },
  { name: 'Corporate venture arm',   meta: 'Series A · Regional',   score: 81, why: 'Strategic fit, though stage is later than you are raising.' },
]

export function InvestorIntelligenceSection() {
  return (
    <section id="investors" aria-labelledby="investors-heading" className="px-6 py-20 md:py-24 bg-surface-card border-y border-border">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          label="Investor intelligence"
          title="Find capital that fits your raise."
          lede="Match on the criteria that actually decide a meeting: market, stage, sector, cheque size, geographic mandate and thesis."
        />

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 mt-12 items-start">
          <ScrollReveal>
            <div className="rounded-card border border-border bg-surface-page p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-5">Your raise</h3>
              <dl className="space-y-4">
                {MATCH_INPUTS.map(input => (
                  <div key={input.label} className="flex items-baseline justify-between gap-4 border-b border-border-muted pb-3 last:border-0 last:pb-0">
                    <dt className="text-xs font-medium uppercase tracking-wider text-text-tertiary shrink-0">{input.label}</dt>
                    <dd className="text-sm font-medium text-text-primary text-right tabular-nums">{input.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Relevant investor matches</h3>
                <span className="text-xs font-medium text-brand">Relevance over volume</span>
              </div>
              <ul className="space-y-3">
                {MATCH_RESULTS.map(result => (
                  <li key={result.name} className="surface-sheen rounded-card border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{result.name}</p>
                        <p className="text-xs text-text-tertiary mt-1">{result.meta}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Match</div>
                        <div className="text-base font-semibold text-success-text tabular-nums">{result.score}</div>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary mt-3 leading-relaxed">{result.why}</p>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-tertiary mt-5 leading-relaxed">
                Matching is a research aid, not a verified directory. RaiseSEA helps you identify investors
                worth approaching — it does not make introductions or guarantee a fund&apos;s current mandate.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

// ─── Section 7: privacy & trust ───────────────────────────────────
// The highest-value section on the page. The primary CTA asks a founder
// to hand over a confidential pitch deck; previously the words
// "encrypted", "private" and "never shared with investors" appeared
// nowhere on the page, and there was no privacy or terms link at all.

const TRUST_POINTS = [
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Your deck and analysis live inside your account. Nothing is shared with investors, mentors or anyone else unless you deliberately share it.',
  },
  {
    icon: ServerCog,
    title: 'How documents are processed',
    body: 'Decks are encrypted in transit and at rest, and are processed to produce your analysis. Access is limited to your account.',
  },
  {
    icon: Sparkles,
    title: 'AI usage',
    body: 'Your documents are not used to train public or shared models. Analysis is generated for you, and used for you.',
  },
  {
    icon: Trash2,
    title: 'Your control',
    body: 'You can delete your documents and account data. Once deleted, they are removed from the active product.',
  },
]

export function TrustSection() {
  return (
    <section id="trust" aria-labelledby="trust-heading" className="px-6 py-20 md:py-24">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          label="Privacy & trust"
          title="Your fundraising materials stay yours."
          lede="Founders are asked for confidential information to use this product. That deserves a straight answer, in plain language, before you upload anything."
        />

        <div className="grid sm:grid-cols-2 gap-5 mt-12">
          {TRUST_POINTS.map((point, i) => {
            const Icon = point.icon
            return (
              <ScrollReveal key={point.title} delay={i * 60}>
                <div className="card-hover surface-sheen group h-full rounded-card border border-border p-6">
                  <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-input bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-text-inverse">
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary text-pretty">{point.body}</p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal delay={120}>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors">
              Read the Privacy Policy
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link href="/terms" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors">
              Read the Terms of Service
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
            <a href="mailto:hello@raisesea.com" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              Ask us directly
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ─── Section 8: pricing / beta ────────────────────────────────────

export function PricingSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="px-6 py-20 md:py-24 bg-surface-card border-y border-border">
      <div className="max-w-3xl mx-auto text-center">
        <ScrollReveal>
          <div className="flex flex-col items-center">
            <SectionLabel>Pricing</SectionLabel>
            <h2 id="pricing-heading" className="text-xl md:text-2xl font-semibold tracking-tight text-balance">
              Free for founders during beta.
            </h2>
            <p className="text-base text-text-secondary mt-4 leading-relaxed max-w-2xl text-pretty">
              RaiseSEA is in active beta while the regional datasets deepen. Founders get the full platform
              at no cost, and early users will receive advance notice before any pricing changes.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={signedIn ? '/apply' : '/login?next=/apply'}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-input bg-brand px-6 text-base font-medium text-text-inverse hover:bg-brand-hover transition-colors"
              >
                Start your raise
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-text-tertiary mt-5">
              <ShieldCheck className="w-4 h-4 text-success-text" strokeWidth={1.75} aria-hidden="true" />
              No credit card. No trial timer.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ─── Section 9: for accelerators & programs ───────────────────────

const PROGRAM_AUDIENCES = ['Accelerators', 'Incubators', 'Universities', 'Startup programmes', 'Ecosystem organisations']

export function ProgramsSection() {
  return (
    <section id="programs" aria-labelledby="programs-heading" className="px-6 py-20 md:py-24">
      <div className="max-w-6xl mx-auto">
        <div className="surface-sheen rounded-card border border-border p-8 md:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <ScrollReveal>
            <div>
              <SectionLabel>For programmes</SectionLabel>
              <h2 id="programs-heading" className="text-xl md:text-2xl font-semibold tracking-tight text-balance">
                Supporting founders at scale?
              </h2>
              <p className="text-base text-text-secondary mt-4 leading-relaxed text-pretty">
                Bring RaiseSEA into your accelerator, incubator, university or founder programme to
                strengthen fundraising readiness across your cohort.
              </p>
              <a
                href="mailto:hello@raisesea.com?subject=RaiseSEA%20for%20programmes"
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-input border border-brand px-5 text-sm font-medium text-brand hover:bg-brand-soft transition-colors"
              >
                Talk to us
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <ul className="flex flex-wrap gap-2 lg:justify-end">
              {PROGRAM_AUDIENCES.map(audience => (
                <li key={audience} className="rounded-input border border-border bg-surface-page px-3 py-2 text-sm font-medium text-text-secondary">
                  {audience}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

// ─── Section 10: FAQ ──────────────────────────────────────────────
// Rewritten around the objections a founder actually has. Answers are
// limited to what the product and policy pages support today.

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What is RaiseSEA?',
    a: 'RaiseSEA is a fundraising intelligence and execution platform for founders across Asia Pacific. It combines deck assessment, pitch preparation, investor matching, a fundraising pipeline, financing calculators and regional market intelligence in one place.',
  },
  {
    q: 'Who is RaiseSEA built for?',
    a: 'Founders from pre-seed through Series B who are preparing or running a round, typically in the next zero to six months. It is most useful before you have a term sheet — though the pipeline and pitch practice remain useful after one.',
  },
  {
    q: 'Which APAC markets does RaiseSEA cover?',
    a: 'Southeast Asia has the deepest coverage today: Indonesia, Singapore, Vietnam, the Philippines, Malaysia and Thailand. India, Australia, Japan, South Korea, Hong Kong, Taiwan and New Zealand are being extended deliberately. We would rather tell you where coverage is thin than imply every market is equally developed.',
  },
  {
    q: 'How does the deck analysis work?',
    a: 'You upload your deck and receive structured analysis across the dimensions investors commonly score — problem, market, traction, team, financials, go-to-market, business model and competition — with the gaps ranked by impact rather than generic advice.',
  },
  {
    q: 'How does investor matching work?',
    a: 'You describe your raise — market, stage, sector, target round and focus — and RaiseSEA surfaces investors whose mandate fits those criteria, with a stated reason for each match. It optimises for relevance rather than presenting the largest possible directory.',
  },
  {
    q: 'Where does RaiseSEA\u2019s investor information come from?',
    a: 'Investor profiles are compiled from public fund and firm information together with the regional fundraising activity our intelligence pipeline tracks. Treat them as a research starting point rather than a verified directory, and confirm a fund\u2019s current mandate before you rely on it.',
  },
  {
    q: 'How often is investor information updated?',
    a: 'The fundraising intelligence behind RaiseSEA is refreshed continuously as new regional activity is captured. Individual fund profiles are revisited as new information is published about them, so a given profile is a snapshot rather than a live guarantee.',
  },
  {
    q: 'Is my pitch deck private?',
    a: 'Yes. Your deck is stored privately in your account so you can return to your analysis. It is not shared with investors, mentors or other users unless you explicitly share it, and you can delete your documents and account data.',
  },
  {
    q: 'Does RaiseSEA use uploaded documents to train AI models?',
    a: 'No. Your documents are not used to train public or shared models.',
  },
  {
    q: 'Can RaiseSEA introduce me directly to investors?',
    a: 'No. RaiseSEA helps you identify investors worth approaching and run the process well, but outreach is yours. We do not broker introductions or guarantee meetings.',
  },
  {
    q: 'Is RaiseSEA free?',
    a: 'RaiseSEA is free for founders during beta. Early users will receive advance notice before any pricing changes.',
  },
]

export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="surface-sheen group rounded-card border border-border transition-colors hover:border-border-strong open:border-brand/30">
      <summary className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 px-5 py-4 list-none">
        <h3 className="text-base font-medium text-text-primary text-pretty">{q}</h3>
        <span className="shrink-0 text-text-tertiary transition-transform group-open:rotate-45" aria-hidden="true">
          <svg viewBox="0 0 12 12" className="w-3 h-3">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <p className="text-sm text-text-secondary leading-relaxed px-5 pb-5 text-pretty">{a}</p>
    </details>
  )
}

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="px-6 py-20 md:py-24 bg-surface-card border-y border-border">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <div className="text-center flex flex-col items-center">
            <SectionLabel>Common questions</SectionLabel>
            <h2 id="faq-heading" className="text-xl md:text-2xl font-semibold tracking-tight text-balance">
              Straight answers.
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          {/* Two columns on desktop — 11 answers stacked single-file added
              ~1,100px of height for content most visitors scan, not read. */}
          <div className="mt-10 grid gap-3 lg:grid-cols-2 lg:items-start">
            {FAQ_ITEMS.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ─── Section 11: final CTA ────────────────────────────────────────

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="final-cta-heading" className="bg-brand-deep relative isolate overflow-hidden px-6 py-24 text-text-inverse md:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-70" />
      <div className="max-w-3xl mx-auto text-center">
        <ScrollReveal>
          {/* The transparent white variant, used where the manifest says it
              belongs: on a dark green band. */}
          <div className="mb-8 flex justify-center">
            <RaiseSEALogo variant="onDark" height={30} />
          </div>
          <h2 id="final-cta-heading" className="text-xl font-semibold leading-tight tracking-tight text-balance md:text-2xl">
            Ready to make your raise investor-ready?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/85 text-pretty">
            Prepare, find relevant capital, and manage your fundraising journey with RaiseSEA.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={signedIn ? '/apply' : '/login?next=/apply'}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-input bg-surface-card px-7 text-base font-medium text-brand transition-colors hover:bg-brand-soft sm:w-auto"
            >
              Start your raise
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <a
              href="#journey"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-input border border-white/25 px-7 text-base font-medium text-text-inverse transition-colors hover:border-white/50 hover:bg-white/10 sm:w-auto"
            >
              Explore RaiseSEA
            </a>
          </div>
          <p className="mt-6 text-sm text-white/70">Free for founders during beta.</p>
        </ScrollReveal>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Fundraising journey', href: '#journey' },
      { label: 'Product walkthrough', href: '#product' },
      { label: 'Investor intelligence', href: '#investors' },
      { label: 'Calculators', href: '/tools/calculator' },
    ],
  },
  {
    title: 'Intelligence',
    links: [
      { label: 'APAC news', href: '/news' },
      { label: 'News archive', href: '/news/history' },
      { label: 'Glossary', href: '/glossary' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'For programmes', href: '#programs' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Contact', href: 'mailto:hello@raisesea.com' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-card">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="inline-flex min-h-[44px] items-center rounded-input">
              <RaiseSEALogo variant="primary" height={34} />
            </Link>
            <p className="text-sm text-text-tertiary mt-3 leading-relaxed max-w-xs">
              Fundraising intelligence and execution for founders across Asia Pacific.
            </p>
          </div>

          {FOOTER_COLUMNS.map(column => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{column.title}</h2>
              <ul className="mt-4 space-y-1">
                {column.links.map(link => (
                  <li key={link.label}>
                    {link.href.startsWith('#') || link.href.startsWith('mailto:') ? (
                      <a href={link.href} className="inline-flex min-h-[44px] items-center text-sm text-text-secondary hover:text-text-primary transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="inline-flex min-h-[44px] items-center text-sm text-text-secondary hover:text-text-primary transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-text-tertiary">© 2026 RaiseSEA. Built for founders raising across Asia Pacific.</p>
          <p className="text-xs text-text-tertiary">Private by default. Your deck stays in your account.</p>
        </div>
      </div>
    </footer>
  )
}
