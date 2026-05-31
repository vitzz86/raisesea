'use client'

// ═══════════════════════════════════════════════════════════════
// components/landing/LandingMockups.tsx
//
// All landing-page mockups in one file. Each is a stylized
// representation of what the actual product produces. Mockups
// animate on scroll-into-view (once) — score circles draw, bars
// fill, numbers tick up, cards stagger in.
//
// Mockups:
//   • HeroDashboardPreview — hero-area "all features at a glance"
//   • DeckAnalysisMockup   — /match/[id] overview
//   • MockPitchMockup      — /mock-pitch/debrief score breakdown
//   • InvestorMatchMockup  — investor cards
//   • CrmMockup            — CRM board with stages
//   • NewsMockup           — weekly news digest (NEW chunk 12.7.1)
//   • CalculatorMockup     — SAFE calculator (NEW chunk 12.7.1)
//   • JourneyArc           — Assess → Prepare → Execute
//
// Animation approach: useInView hook + Tailwind transitions. No
// keyframes, no GIFs — keeps the bundle tiny and respects
// prefers-reduced-motion.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { TrendingUp, Mic, Building2, MessageSquare, Target, Calculator, Newspaper, BarChart3, Briefcase } from 'lucide-react'
import { useInView, CountUp } from './ScrollReveal'

// ─── HERO DASHBOARD PREVIEW (NEW) ──────────────────────────────────
// Hero-area "product surface" preview. Shows all 6 features as mini
// cards in a stylized dashboard. Cards fade in sequentially.

export function HeroDashboardPreview() {
  const [ref, inView] = useInView<HTMLDivElement>()

  const features = [
    { icon: BarChart3,  label: 'Deck Analysis',  value: '78/100',     accent: 'success' },
    { icon: Mic,        label: 'Mock Pitch',     value: '82/100',     accent: 'brand' },
    { icon: Building2,  label: 'SEA Investors',  value: '34 matched', accent: 'success' },
    { icon: Briefcase,  label: 'Active CRM',     value: '12 in pipe', accent: 'brand' },
    { icon: Newspaper,  label: 'SEA Intel',      value: 'Weekly',     accent: 'neutral' },
    { icon: Calculator, label: 'SAFE Calc',      value: '$8M cap',    accent: 'neutral' },
  ]

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      {/* Window chrome */}
      <div className="bg-surface-muted border-b border-border-muted px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="ml-3 text-[11px] text-text-tertiary font-medium">RaiseSEA · Your fundraise dashboard</span>
        <span className="ml-auto text-[11px] text-text-tertiary">techcorp.sg</span>
      </div>

      <div className="p-5 md:p-7">
        {/* Header strip */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">Welcome back, Sarah</h3>
            <p className="text-xs text-text-tertiary mt-0.5">Series A · SaaS · Singapore</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Runway</div>
            <div className="text-sm font-semibold text-text-primary">11 months</div>
          </div>
        </div>

        {/* 6-feature grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={i}
                className="bg-surface-muted/40 border border-border-muted rounded-lg p-3.5 transition-all duration-500"
                style={{
                  opacity:   inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(8px)',
                  transitionDelay: `${i * 90}ms`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                    f.accent === 'success' ? 'bg-success-bg text-success-text' :
                    f.accent === 'brand'   ? 'bg-brand-soft text-brand' :
                                             'bg-surface-sunken text-text-secondary'
                  }`}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] font-medium text-text-secondary">{f.label}</span>
                </div>
                <div className="text-base font-semibold text-text-primary">{f.value}</div>
              </div>
            )
          })}
        </div>

        {/* Pulsing "live" indicator */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-solid opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-solid"></span>
          </span>
          <span className="text-[11px] text-text-tertiary">Updated 2 minutes ago · 750+ SEA investors live</span>
        </div>
      </div>
    </div>
  )
}

// ─── 1. DECK ANALYSIS MOCKUP ───────────────────────────────────────

export function DeckAnalysisMockup() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const dims = [
    { name: 'Problem',       score: 85, color: 'success' },
    { name: 'Market sizing', score: 72, color: 'brand' },
    { name: 'Traction',      score: 91, color: 'success' },
    { name: 'Financials',    score: 58, color: 'warning' },
  ]

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      <MockChrome label="Deck Analysis · TechCorp" />

      <div className="p-5 space-y-4">
        {/* Top metric row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <MockMetric label="Deck score"   value={inView ? <><CountUp end={78} />/100</> : '0/100'} sub="Strong" accent="success" />
          <MockMetric label="Valuation"    value="$8M–$12M" sub="SEA seed" />
          <MockMetric label="Moat score"   value={inView ? <><CountUp end={7} />/10</> : '0/10'} sub="Solid" />
          <MockMetric label="Investors"    value={inView ? <><CountUp end={34} suffix=" matches" /></> : '0 matches'} sub="Top: Vertex" />
        </div>

        {/* Dimension breakdown — bars fill on scroll */}
        <div className="bg-surface-muted rounded-lg p-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">8 dimensions scored</div>
          {dims.map((d, i) => (
            <div key={d.name} className="flex items-center gap-3">
              <div className="text-[11px] text-text-secondary w-24 shrink-0">{d.name}</div>
              <div className="flex-1 h-1.5 bg-border-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    d.color === 'success' ? 'bg-success-solid' :
                    d.color === 'warning' ? 'bg-warning-solid' :
                                            'bg-brand'
                  }`}
                  style={{
                    width: inView ? `${d.score}%` : '0%',
                    transitionDelay: `${300 + i * 130}ms`,
                  }}
                />
              </div>
              <div className="text-[11px] font-medium text-text-primary w-8 text-right tabular-nums">
                {inView ? d.score : 0}
              </div>
            </div>
          ))}
        </div>

        {/* Priority fix card */}
        <div
          className="border-l-2 border-warning-solid bg-warning-bg/40 rounded-md px-3 py-2 flex items-start gap-3 transition-all duration-500"
          style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(6px)', transitionDelay: '900ms' }}
        >
          <Target className="w-3.5 h-3.5 text-warning-text mt-0.5 shrink-0" strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-text-primary">Fix: Financials need SEA-grounded benchmarks</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">Adding revenue multiples typical for SEA SaaS would boost score ~12 points.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. MOCK PITCH MOCKUP ──────────────────────────────────────────

export function MockPitchMockup() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const targetScore = 82
  const circumference = 264   // 2 * pi * 42
  const dashFull = (targetScore / 100) * circumference
  const slides = [
    { slide: 'Problem',  pace: 'good',   coverage: 92 },
    { slide: 'Solution', pace: 'silent', coverage: 64 },
    { slide: 'Market',   pace: 'good',   coverage: 88 },
    { slide: 'Team',     pace: 'fast',   coverage: 71 },
  ]

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      <MockChrome label="Mock Pitch Debrief · 3-min run" />

      <div className="p-5 space-y-4">
        {/* Hero score circle — strokeDashoffset animates */}
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-muted)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="var(--brand)" strokeWidth="6"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={inView ? `${circumference - dashFull}` : `${circumference}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1400ms cubic-bezier(0.16, 1, 0.3, 1)', transitionDelay: '200ms' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-semibold text-text-primary tabular-nums">
                {inView ? <CountUp end={targetScore} duration={1400} /> : 0}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Overall score</div>
            <div className="text-sm font-semibold text-text-primary mt-0.5">Investor-ready</div>
            <div className="text-[11px] text-text-tertiary mt-0.5">Above 80 = strong delivery</div>
          </div>
        </div>

        {/* Per-slide feedback — bars fill with stagger */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Slide-by-slide</div>
          {slides.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-[11px]">
              <div className="w-20 shrink-0 text-text-secondary">{s.slide}</div>
              <div className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                s.pace === 'good' ? 'bg-success-bg text-success-text' :
                s.pace === 'silent' ? 'bg-surface-muted text-text-tertiary' :
                'bg-warning-bg text-warning-text'
              }`}>{s.pace}</div>
              <div className="flex-1 h-1 bg-border-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    s.coverage >= 80 ? 'bg-success-solid' : s.coverage >= 60 ? 'bg-brand' : 'bg-warning-solid'
                  }`}
                  style={{
                    width: inView ? `${s.coverage}%` : '0%',
                    transitionDelay: `${500 + i * 120}ms`,
                  }}
                />
              </div>
              <div className="w-7 text-right text-text-tertiary tabular-nums">{inView ? s.coverage : 0}%</div>
            </div>
          ))}
        </div>

        {/* Suggested Q from investor — fades in last */}
        <div
          className="bg-brand-soft/40 border border-brand/20 rounded-md p-3 transition-all duration-500"
          style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(6px)', transitionDelay: '1100ms' }}
        >
          <div className="flex items-start gap-2.5">
            <MessageSquare className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wider text-brand">Likely Q from investor</div>
              <div className="text-[11px] text-text-primary mt-1 leading-relaxed">
                "Your CAC payback is 8 months — how does that compare to SEA SaaS benchmarks at your stage?"
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 3. INVESTOR MATCH MOCKUP ──────────────────────────────────────

export function InvestorMatchMockup() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const investors = [
    { name: 'Vertex Ventures SEA', type: 'VC',  stage: 'Seed–A',   city: 'Singapore', score: 94 },
    { name: 'East Ventures',       type: 'VC',  stage: 'Pre–Seed', city: 'Jakarta',   score: 91 },
    { name: 'Cocoon Capital',      type: 'VC',  stage: 'Seed',     city: 'Singapore', score: 88 },
    { name: 'Insignia Ventures',   type: 'VC',  stage: 'Seed–A',   city: 'Singapore', score: 84 },
  ]

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      <MockChrome label="Investor Matches · 34 of 750+ SEA funds" />

      <div className="p-5 space-y-2.5">
        {investors.map((inv, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 border border-border-muted rounded-lg hover:border-brand/30 transition-all duration-500"
            style={{
              opacity:   inView ? 1 : 0,
              transform: inView ? 'translateX(0)' : 'translateX(-8px)',
              transitionDelay: `${i * 120}ms`,
            }}
          >
            <div className="w-9 h-9 rounded-md bg-brand-soft flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-brand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-text-primary truncate">{inv.name}</div>
              <div className="text-[10px] text-text-tertiary mt-0.5">{inv.type} · {inv.stage} · {inv.city}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Match</div>
              <div className="text-sm font-semibold text-success-text tabular-nums">
                {inView ? <CountUp end={inv.score} duration={900} /> : 0}
              </div>
            </div>
          </div>
        ))}

        <div
          className="text-[10px] text-text-tertiary text-center pt-1 transition-opacity duration-500"
          style={{ opacity: inView ? 1 : 0, transitionDelay: '600ms' }}
        >
          + 30 more matches based on your sector + stage
        </div>
      </div>
    </div>
  )
}

// ─── 4. CRM MOCKUP ─────────────────────────────────────────────────

export function CrmMockup() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const stages = [
    { name: 'Researched',  count: 12, color: 'bg-surface-sunken' },
    { name: 'Contacted',   count: 8,  color: 'bg-brand-soft' },
    { name: 'In talks',    count: 4,  color: 'bg-success-bg' },
    { name: 'Term sheet',  count: 1,  color: 'bg-warning-bg' },
  ]

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      <MockChrome label="Investor CRM · TechCorp's raise" />

      <div className="p-5 space-y-4">
        {/* Pipeline stages — count up */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stages.map((s, i) => (
            <div
              key={i}
              className={`${s.color} rounded-lg p-3 transition-all duration-500`}
              style={{
                opacity:   inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(6px)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">{s.name}</div>
              <div className="text-lg font-semibold text-text-primary mt-1 tabular-nums">
                {inView ? <CountUp end={s.count} duration={800} /> : 0}
              </div>
            </div>
          ))}
        </div>

        {/* Sample contact cards */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">In talks</div>
          {[
            { name: 'Sarah Chen', firm: 'Vertex Ventures SEA', action: 'Follow up on financials deck', due: 'Tomorrow',  priority: 'high' },
            { name: 'Andre Liu',  firm: 'East Ventures',        action: 'Send Q3 traction update',     due: 'Mon Jun 3', priority: 'medium' },
          ].map((c, i) => (
            <div
              key={i}
              className="border border-border-muted rounded-lg p-3 transition-all duration-500"
              style={{
                opacity:   inView ? 1 : 0,
                transform: inView ? 'translateX(0)' : 'translateX(-8px)',
                transitionDelay: `${500 + i * 150}ms`,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-text-primary truncate">{c.name}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{c.firm}</div>
                </div>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                  c.priority === 'high' ? 'bg-danger-bg text-danger-text' : 'bg-surface-muted text-text-tertiary'
                }`}>
                  {c.priority}
                </span>
              </div>
              <div className="text-[11px] text-text-secondary">→ {c.action}</div>
              <div className="text-[10px] text-text-tertiary mt-1">Due: {c.due}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 5. NEWS INTELLIGENCE MOCKUP (NEW) ─────────────────────────────

export function NewsMockup() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const items = [
    {
      tag:        'Funding',
      tagColor:   'bg-success-bg text-success-text',
      title:      'Vertex Ventures SEA leads $14M Series A in Indonesian fintech Komunal',
      meta:       'TechInAsia · 2 hours ago · Singapore, Jakarta',
    },
    {
      tag:        'Mandate',
      tagColor:   'bg-brand-soft text-brand',
      title:      'Insignia Ventures opens new $200M fund focused on SEA SaaS',
      meta:       'DealStreetAsia · Yesterday · Singapore',
    },
    {
      tag:        'Sector',
      tagColor:   'bg-warning-bg text-warning-text',
      title:      'Indonesia logistics tech sees 217% YoY funding growth in Q2',
      meta:       'KrAsia · 3 days ago · Sector report',
    },
  ]

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      <MockChrome label="SEA News Intel · Week of May 24" />

      <div className="p-5 space-y-3">
        {/* Header strip — filters */}
        <div
          className="flex items-center gap-2 pb-3 border-b border-border-muted transition-all duration-500"
          style={{ opacity: inView ? 1 : 0, transitionDelay: '100ms' }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mr-1">Your filters:</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">SaaS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">Seed–A</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">SG · ID · VN</span>
        </div>

        {/* News items */}
        {items.map((item, i) => (
          <div
            key={i}
            className="border border-border-muted rounded-lg p-3 hover:border-brand/30 transition-all duration-500"
            style={{
              opacity:   inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(8px)',
              transitionDelay: `${250 + i * 150}ms`,
            }}
          >
            <div className="flex items-start gap-2 mb-1.5">
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.tagColor}`}>
                {item.tag}
              </span>
            </div>
            <h4 className="text-[12px] font-semibold text-text-primary leading-snug">{item.title}</h4>
            <p className="text-[10px] text-text-tertiary mt-1">{item.meta}</p>
          </div>
        ))}

        <div
          className="text-[10px] text-text-tertiary text-center pt-1 transition-opacity duration-500"
          style={{ opacity: inView ? 1 : 0, transitionDelay: '900ms' }}
        >
          + 17 more this week · email digest every Monday
        </div>
      </div>
    </div>
  )
}

// ─── 6. SAFE CALCULATOR MOCKUP (NEW) ───────────────────────────────

export function CalculatorMockup() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [activeTab, setActiveTab] = useState(0)

  // Auto-cycle through 3 tabs every 3.5s once in view
  useEffect(() => {
    if (!inView) return
    const interval = setInterval(() => {
      setActiveTab(prev => (prev + 1) % 3)
    }, 3500)
    return () => clearInterval(interval)
  }, [inView])

  const TABS = [
    { key: 'equity',      label: 'Equity',      sub: 'Priced rounds' },
    { key: 'debt',        label: 'Debt',        sub: 'Loans' },
    { key: 'convertible', label: 'SAFE / Note', sub: 'Convertibles' },
  ]

  const chromeLabel = activeTab === 0 ? 'Calculator · Equity · $1.5M on $8M pre-money'
                    : activeTab === 1 ? 'Calculator · Debt · $500k @ 8% over 36mo'
                                       : 'Calculator · SAFE · $500k on $8M cap'

  return (
    <div ref={ref} className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      <MockChrome label={chromeLabel} />

      <div className="p-5 space-y-4">
        {/* Tab strip — green active state matches real product */}
        <div className="bg-surface-page border border-border-muted rounded-lg p-1 inline-flex gap-1">
          {TABS.map((tab, i) => {
            const isActive = activeTab === i
            return (
              <div
                key={tab.key}
                className={`px-3 py-1.5 rounded-md transition-all duration-300 ${
                  isActive
                    ? 'bg-brand text-text-inverse shadow-subtle'
                    : 'text-text-tertiary'
                }`}
              >
                <div className="text-[11px] font-medium leading-tight">{tab.label}</div>
                <div className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'text-white/80' : 'opacity-70'}`}>{tab.sub}</div>
              </div>
            )
          })}
        </div>

        {/* Tab content — three variants */}
        {activeTab === 0 && <EquityTabContent inView={inView} />}
        {activeTab === 1 && <DebtTabContent   inView={inView} />}
        {activeTab === 2 && <SafeTabContent   inView={inView} />}

        {/* Bottom takeaway */}
        <div className="text-[10px] text-text-tertiary text-center">
          Equity · Debt · SAFE/Note — three calculators, SEA-benchmarked dilution insight
        </div>
      </div>
    </div>
  )
}

// ─── Equity sub-mockup: cap-table donut + dilution insight ─────────

function EquityTabContent({ inView }: { inView: boolean }) {
  const founderPct  = 84.21
  const investorPct = 15.79

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Pre-money', value: '$8M' },
          { label: 'Raise',     value: '$1.5M' },
          { label: 'Founder %', value: '100%' },
        ].map((field, i) => (
          <div
            key={i}
            className="bg-surface-muted rounded-md p-2.5 border border-border-muted transition-all duration-500"
            style={{
              opacity:   inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: `${i * 80}ms`,
            }}
          >
            <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">{field.label}</div>
            <div className="text-base font-semibold text-text-primary mt-0.5">{field.value}</div>
          </div>
        ))}
      </div>

      {/* Cap table bar */}
      <div className="bg-surface-muted rounded-lg p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Post-money cap table</div>
        <div className="flex h-7 rounded-md overflow-hidden border border-border-muted mb-2">
          <div
            className="bg-brand flex items-center justify-center text-[9px] font-semibold text-text-inverse transition-all duration-700"
            style={{ width: inView ? `${founderPct}%` : '100%' }}
          >
            {inView && `${Math.round(founderPct)}%`}
          </div>
          <div
            className="bg-blue-600 flex items-center justify-center text-[9px] font-semibold text-text-inverse transition-all duration-700"
            style={{ width: inView ? `${investorPct}%` : '0%' }}
          >
            {inView && `${Math.round(investorPct)}%`}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-brand" /><span className="text-text-secondary">Founders 84.21%</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-blue-600" /><span className="text-text-secondary">New investor 15.79%</span></span>
        </div>
      </div>

      {/* Dilution insight */}
      <div className="bg-success-bg border border-success-border rounded-lg p-2.5 flex items-start gap-2">
        <div className="w-3 h-3 rounded-full bg-success-solid shrink-0 mt-0.5" />
        <div className="text-[10px] text-success-text leading-relaxed">
          <strong>15.79% dilution — Sweet spot for SEA seed.</strong> Most investors will see this as fair. Source: Carta + Iconiq SEA data.
        </div>
      </div>
    </>
  )
}

// ─── Debt sub-mockup: monthly payment + mini schedule ─────────────

function DebtTabContent({ inView }: { inView: boolean }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Principal', value: '$500K' },
          { label: 'Rate',      value: '8% APR' },
          { label: 'Term',      value: '36 mo' },
        ].map((field, i) => (
          <div
            key={i}
            className="bg-surface-muted rounded-md p-2.5 border border-border-muted transition-all duration-500"
            style={{
              opacity:   inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: `${i * 80}ms`,
            }}
          >
            <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">{field.label}</div>
            <div className="text-base font-semibold text-text-primary mt-0.5">{field.value}</div>
          </div>
        ))}
      </div>

      {/* Outcome metrics */}
      <div className="bg-surface-muted rounded-lg p-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">Monthly</div>
          <div className="text-sm font-semibold text-brand tabular-nums mt-0.5">$15,668</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">Total interest</div>
          <div className="text-sm font-semibold text-warning-text tabular-nums mt-0.5">$64,055</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">Total paid</div>
          <div className="text-sm font-semibold text-text-primary tabular-nums mt-0.5">$564,055</div>
        </div>
      </div>

      {/* Mini amortization table */}
      <div className="bg-surface-muted rounded-lg overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-muted">
          <span>#</span>
          <span className="text-right">Principal</span>
          <span className="text-right">Interest</span>
          <span className="text-right">Balance</span>
        </div>
        {[
          { m: 1,  p: '$12,335', i: '$3,333', b: '$487,665' },
          { m: 12, p: '$13,180', i: '$2,488', b: '$359,929' },
          { m: 24, p: '$14,275', i: '$1,393', b: '$194,612' },
          { m: 36, p: '$15,564', i: '$104',   b: '$0' },
        ].map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 px-3 py-1.5 text-[10px] tabular-nums border-b border-border-muted last:border-b-0 transition-all duration-500"
            style={{ opacity: inView ? 1 : 0, transitionDelay: `${300 + i * 100}ms` }}
          >
            <span className="text-text-tertiary">{row.m}</span>
            <span className="text-right text-text-primary">{row.p}</span>
            <span className="text-right text-warning-text">{row.i}</span>
            <span className="text-right text-text-secondary">{row.b}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── SAFE sub-mockup: original donut + breakdown ──────────────────

function SafeTabContent({ inView }: { inView: boolean }) {
  const investorPct = 7.2
  const founderPct  = 60.5
  const poolPct     = 12.3
  const otherPct    = 20.0

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Investment', value: '$500K' },
          { label: 'Cap',        value: '$8M'   },
          { label: 'Discount',   value: '20%'   },
        ].map((field, i) => (
          <div
            key={i}
            className="bg-surface-muted rounded-md p-2.5 border border-border-muted transition-all duration-500"
            style={{
              opacity:   inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: `${i * 80}ms`,
            }}
          >
            <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">{field.label}</div>
            <div className="text-base font-semibold text-text-primary mt-0.5">{field.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5 bg-surface-muted rounded-lg p-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-muted)" strokeWidth="10" />
            {[
              { color: 'var(--brand)',          pct: investorPct, offset: 0 },
              { color: 'var(--text-secondary)', pct: founderPct,  offset: investorPct },
              { color: 'var(--warning-solid)',  pct: poolPct,     offset: investorPct + founderPct },
              { color: 'var(--border-strong)',  pct: otherPct,    offset: investorPct + founderPct + poolPct },
            ].map((seg, i) => {
              const circumference = 2 * Math.PI * 42
              const len = (seg.pct / 100) * circumference
              return (
                <circle
                  key={i}
                  cx="50" cy="50" r="42" fill="none"
                  stroke={seg.color}
                  strokeWidth="10"
                  strokeDasharray={`${inView ? len : 0} ${circumference}`}
                  strokeDashoffset={-(seg.offset / 100) * circumference}
                  style={{ transition: `stroke-dasharray 800ms ${i * 100}ms ease-out` }}
                />
              )
            })}
          </svg>
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          {[
            { color: 'var(--brand)',          label: 'New investor', value: `${investorPct}%` },
            { color: 'var(--text-secondary)', label: 'Founders',     value: `${founderPct}%` },
            { color: 'var(--warning-solid)',  label: 'Option pool',  value: `${poolPct}%` },
            { color: 'var(--border-strong)',  label: 'Other',        value: `${otherPct}%` },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-2 transition-all duration-500"
              style={{ opacity: inView ? 1 : 0, transitionDelay: `${700 + i * 80}ms` }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
              <span className="text-[10px] text-text-secondary flex-1 truncate">{row.label}</span>
              <span className="text-[10px] font-semibold text-text-primary tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── 7. JOURNEY ARC ────────────────────────────────────────────────

export function JourneyArc() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 })
  const stages = [
    { label: 'ASSESS',  title: 'Score your deck',  icon: TrendingUp, description: 'AI analyzes 8 dimensions in 60 seconds.' },
    { label: 'PREPARE', title: 'Drill your pitch', icon: Mic,        description: 'Practice out loud. AI scores delivery.' },
    { label: 'EXECUTE', title: 'Match & track',    icon: Building2,  description: '750+ SEA investors. Built-in CRM.' },
  ]

  return (
    <div ref={ref} className="grid md:grid-cols-3 gap-4 md:gap-0">
      {stages.map((s, i) => {
        const Icon = s.icon
        const isLast = i === stages.length - 1
        return (
          <div
            key={s.label}
            className="relative transition-all duration-700"
            style={{
              opacity:   inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(16px)',
              transitionDelay: `${i * 180}ms`,
            }}
          >
            {!isLast && (
              <div className="hidden md:block absolute top-12 left-full w-full h-px z-0 pointer-events-none" aria-hidden="true">
                <svg viewBox="0 0 100 10" className="w-full h-2.5 overflow-visible">
                  <line x1="-10" y1="5" x2="90" y2="5" stroke="var(--border-default)" strokeWidth="1.5" strokeDasharray="3 4" />
                  <polygon points="86,2 92,5 86,8" fill="var(--border-default)" />
                </svg>
              </div>
            )}

            <div className="relative z-10 bg-surface-card border border-border rounded-2xl p-6 h-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-brand-soft rounded-lg flex items-center justify-center text-brand">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">{s.label}</span>
              </div>
              <h3 className="text-lg font-semibold text-text-primary tracking-tight">{s.title}</h3>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed">{s.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared sub-components ─────────────────────────────────────────

function MockChrome({ label }: { label: string }) {
  return (
    <div className="bg-surface-muted border-b border-border-muted px-4 py-2.5 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-border-strong" />
      <span className="w-2 h-2 rounded-full bg-border-strong" />
      <span className="w-2 h-2 rounded-full bg-border-strong" />
      <span className="ml-3 text-[11px] text-text-tertiary font-medium truncate">{label}</span>
    </div>
  )
}

function MockMetric({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub: string; accent?: 'success' }) {
  return (
    <div className="bg-surface-muted rounded-lg p-2 sm:p-3 min-w-0 overflow-hidden">
      <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary truncate">{label}</div>
      <div className={`text-sm sm:text-base font-semibold mt-1 tabular-nums truncate ${accent === 'success' ? 'text-success-text' : 'text-text-primary'}`}>
        {value}
      </div>
      <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{sub}</div>
    </div>
  )
}
