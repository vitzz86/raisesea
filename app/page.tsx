// ═══════════════════════════════════════════════════════════════
// app/page.tsx — Landing page (rebuilt chunk 12.7)
//
// Replaces the original landing page (256 lines of inline DM Serif
// styles) with a clean design-system-based rebuild.
//
// Voice: "Sharp Friend" (per VOICE_GUIDE.md)
// Hero copy: locked with user — Raise Smarter. Close Faster.
// Aesthetic family: Linear / Mercury / Stripe (subtle motion, real
// product visualization, ruthless positioning above the fold).
//
// Architecture:
//   • Server component (uses getSessionUser for nav CTA)
//   • All sub-components in components/landing/
//   • Inter font (already loaded globally), Tailwind only
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { ArrowRight, Sparkles, BarChart3, Mic, Building2, Briefcase, ShieldCheck, MapPin, Newspaper, Calculator } from 'lucide-react'
import { ScrollReveal, CountUp } from '@/components/landing/ScrollReveal'
import { HeroCinematic } from '@/components/landing/HeroCinematic'
import { MockPitchCinematic } from '@/components/landing/MockPitchCinematic'
import type { CategorizedTopStories, TopStory, TopStoryCategory } from '@/lib/news-clustering'
import {
  DeckAnalysisMockup,
  MockPitchMockup,
  InvestorMatchMockup,
  CrmMockup,
  NewsMockup,
  CalculatorMockup,
  JourneyArc,
} from '@/components/landing/LandingMockups'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [user, newsPreview] = await Promise.all([
    getSessionUser(),
    loadLandingNewsPreview(),
  ])
  const signedIn = !!user
  const hasCategorizedTopStories = !!newsPreview.categorizedTopStories && Object.values(newsPreview.categorizedTopStories).some(Boolean)

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">

      {/* ═══════════════════════════════════════════════════════════
          NAV
          ═══════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-40 bg-surface-page/85 backdrop-blur border-b border-transparent">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-brand tracking-tight">
            RaiseSEA
          </Link>
          <div className="flex items-center gap-6">
            <a href="#features"  className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">Features</a>
            <a href="#why-sea"   className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">Why SEA</a>
            <Link href="/news"   className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">News</Link>
            <a href="#faq"       className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">FAQ</a>
            {signedIn ? (
              <Link href="/dashboard" className="text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-3.5 py-1.5 transition-colors">
                Open dashboard
              </Link>
            ) : (
              <Link href="/login" className="text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-3.5 py-1.5 transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Small pill above hero */}
          <div className="inline-flex items-center gap-1.5 bg-brand-soft text-brand text-xs font-medium px-3 py-1 rounded-full mb-6">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            Built For SEA Founders
          </div>

          {/* The locked headline */}
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-text-primary leading-[1.05]">
            Raise Smarter.<br className="hidden sm:block" />{' '}Close Faster.
          </h1>

          <p className="text-lg md:text-xl text-text-secondary mt-5 font-medium">
            Built For SEA Founders Raising Their Round.
          </p>

          <p className="text-base text-text-tertiary mt-4 max-w-2xl mx-auto leading-relaxed">
            Score your deck. Drill your pitch. Match with active SEA investors. Track every conversation — all benchmarked on real SEA raises.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              href={signedIn ? '/apply' : '/login?next=/apply'}
              className="group inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-text-inverse font-medium text-base rounded-lg px-6 py-3 transition-all shadow-subtle hover:shadow-elevated"
            >
              Analyze your deck
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-base text-text-secondary hover:text-text-primary px-4 py-3 transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="text-xs text-text-tertiary mt-6">
            Free while we build. No credit card. 60 seconds from upload to analysis.
          </p>
        </div>

        {/* Hero product preview — cinematic auto-loop showing the full journey */}
        <div className="max-w-5xl mx-auto mt-14 md:mt-20">
          <HeroCinematic />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TRUST STRIP — the numbers (locked: show all current numbers)
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 pb-16 md:pb-20">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
              <Stat number={750} suffix="+" label="Active SEA investors" sub="Singapore · Indonesia · Vietnam · more" />
              <Stat number={8}            label="Deck dimensions" sub="Scored independently, 0–100" />
              <Stat number={60}  suffix="s" label="Analysis time" sub="From upload to full report" />
              <Stat number={6}            label="Tools in one"   sub="Analysis · Practice · Match · CRM · News · SAFE" />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          JOURNEY VISUALIZATION
          ═══════════════════════════════════════════════════════════ */}
      <section id="journey" className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand mb-3">The journey</div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                From your deck to your next round.
              </h2>
              <p className="text-base text-text-tertiary mt-3 max-w-2xl mx-auto leading-relaxed">
                Most fundraising tools cover one piece. RaiseSEA wires the whole arc together — so the work you do in one step actually feeds the next.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <JourneyArc />
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURE 1: DECK ANALYSIS
          ═══════════════════════════════════════════════════════════ */}
      <section id="features" className="px-6 py-20 bg-surface-card border-y border-border">
        <div className="max-w-6xl mx-auto">
          <FeatureSection
            kicker="ASSESS"
            kickerIcon={<BarChart3 className="w-4 h-4" strokeWidth={1.75} />}
            title="Know exactly where your deck stands."
            description="Upload your deck. In 60 seconds, you get a score out of 100 across 8 dimensions, market sizing benchmarked on SEA raises, a recommended valuation range, competitor moat analysis, and matched investors. No guesswork."
            bullets={[
              'Score breakdown by dimension (problem, market, traction, team, financials, GTM, business model, competition)',
              'SEA-grounded TAM/SAM/SOM and valuation benchmarks',
              'Priority fixes ranked by score impact, not generic "improve your deck"',
            ]}
            mockup={<DeckAnalysisMockup />}
            mockupRight
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURE 2: MOCK PITCH + Q&A
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <FeatureSection
            kicker="PREPARE"
            kickerIcon={<Mic className="w-4 h-4" strokeWidth={1.75} />}
            title="Practice the answers out loud — before the meeting."
            description="Most decks die in the first 60 seconds of investor review. Practice your delivery against an AI that listens, scores, and asks the same hard questions a real SEA investor would. Voice-based, not text. Muscle memory, not theory."
            bullets={[
              'Full pitch run-through or investor Q&A drill mode',
              'Per-slide pace + coverage feedback, scored per dimension',
              'AI generates the likely follow-up questions specific to YOUR deck',
            ]}
            mockup={<MockPitchCinematic />}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURE 3: INVESTOR MATCHING
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 bg-surface-card border-y border-border">
        <div className="max-w-6xl mx-auto">
          <FeatureSection
            kicker="MATCH"
            kickerIcon={<Building2 className="w-4 h-4" strokeWidth={1.75} />}
            title="The 750+ funds actually writing checks in SEA."
            description="Stop scrolling Crunchbase for six hours. Every match comes with a clear reason — sector fit, stage fit, geography fit — plus the warm-intro paths from your network. Built around how SEA fundraising actually works, where Singapore captures 90%+ of regional capital."
            bullets={[
              '750+ SEA-active VCs, angels, family offices, corporate venture',
              'Matched by stage, sector, geography, and check size',
              'Warm intro suggestions from your network',
            ]}
            mockup={<InvestorMatchMockup />}
            mockupRight
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURE 4: CRM
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <FeatureSection
            kicker="EXECUTE"
            kickerIcon={<Briefcase className="w-4 h-4" strokeWidth={1.75} />}
            title="Track every conversation. Stop using a spreadsheet."
            description="Built-in CRM purpose-made for fundraising. Stage every investor (Researched → Contacted → In talks → Term sheet), set next actions with dates, log notes after every call. No more babysitting a Notion table you forget to update."
            bullets={[
              'Pipeline stages tuned for fundraising (not generic sales)',
              'Per-contact next action + due date + timestamped notes log',
              'Filter by priority, source, stage, contact type, search',
            ]}
            mockup={<CrmMockup />}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURE 5: NEWS INTELLIGENCE
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 bg-surface-card border-y border-border">
        <div className="max-w-6xl mx-auto">
          <FeatureSection
            kicker="STAY SHARP"
            kickerIcon={<Newspaper className="w-4 h-4" strokeWidth={1.75} />}
            title="Know what's moving in SEA — without doomscrolling."
            description="A curated weekly digest of SEA fundraising news: new rounds, fund mandates, sector shifts. Filtered by your stage and sector — not infinite-scroll, not paywalled, not buried in five different newsletters. Delivered Monday morning. Read in 5 minutes."
            bullets={[
              'Weekly digest filtered by your sector + stage',
              'Funding rounds, investor mandates, sector trends',
              'Email-first, web archive for reference — your call how to consume it',
            ]}
            mockup={<NewsMockup />}
            mockupRight
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          LIVE NEWS PREVIEW — public + crawlable
          ═══════════════════════════════════════════════════════════ */}
      <section id="news" aria-labelledby="news-heading" className="px-6 py-20 bg-surface-page">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-brand-soft text-brand text-xs font-semibold uppercase tracking-normal px-3 py-1 rounded-full mb-4">
                  <Newspaper className="w-4 h-4" strokeWidth={1.75} />
                  SEA startup news
                </div>
                <h2 id="news-heading" className="text-3xl font-semibold tracking-normal">
                  This week in SEA fundraising.
                </h2>
                <p className="text-base text-text-tertiary mt-3 max-w-2xl leading-relaxed">
                  A quick taste of the weekly digest. Open News for the full searchable feed, filters, and member-only archive.
                </p>
              </div>
              <Link
                href={signedIn ? '/news' : '/login?redirectTo=/news'}
                className="inline-flex items-center justify-center gap-2 rounded-input bg-brand px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-brand-hover transition"
              >
                {signedIn ? 'Open full digest' : 'Login for weekly news'}
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-5">
            <ScrollReveal delay={80}>
              {newsPreview.editorsTake && (newsPreview.editorsTake.headline || newsPreview.editorsTake.body) ? (
                <div className="h-full rounded-card border border-brand/20 bg-gradient-to-br from-brand-pale to-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-normal text-brand mb-3">✍️ Editor&apos;s Take</div>
                  {newsPreview.editorsTake.headline && (
                    <h3 className="text-xl font-semibold text-text-primary leading-snug">{newsPreview.editorsTake.headline}</h3>
                  )}
                  {newsPreview.editorsTake.body && (
                    <p className="text-sm text-text-secondary leading-relaxed mt-3 line-clamp-6">{newsPreview.editorsTake.body}</p>
                  )}
                  {newsPreview.editorsTake.takeaway && (
                    <div className="mt-4 rounded-input border-l-2 border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
                      → {newsPreview.editorsTake.takeaway}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full rounded-card border border-border bg-white p-5 text-sm text-text-secondary">
                  Editor&apos;s Take will appear here after the weekly digest is approved.
                </div>
              )}
            </ScrollReveal>

            <ScrollReveal delay={140}>
              {hasCategorizedTopStories ? (
                <LandingTopStories stories={newsPreview.categorizedTopStories} />
              ) : (
                <div className="h-full rounded-card border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-sm text-text-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🔥</span>
                    <h3 className="text-base font-semibold text-text-primary">Top stories this week</h3>
                    <span className="text-xs text-text-tertiary">editor&apos;s pick per category</span>
                  </div>
                  Top stories will appear here after this week&apos;s editor picks are approved.
                </div>
              )}
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURE 6: SAFE CALCULATOR
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <FeatureSection
            kicker="DECIDE"
            kickerIcon={<Calculator className="w-4 h-4" strokeWidth={1.75} />}
            title="Three calculators. One question: what does this really cost you?"
            description="Every fundraise instrument hides its real impact behind jargon. RaiseSEA gives you three calculators — Equity, Debt, and SAFE/Note — to model exactly what you're signing. See your dilution, your repayment burden, your conversion math, all benchmarked against SEA stage norms."
            bullets={[
              'Equity: priced rounds with full cap-table modeling, scenario analysis, and SEA-benchmarked dilution insight',
              'Debt: standard amortization with monthly payment, total interest, and full per-month schedule',
              'SAFE / Note: post-money, pre-money, and convertible note — all three instruments, all three conversion paths',
            ]}
            mockup={<CalculatorMockup />}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          WHY SEA-FIRST (soft wedge)
          ═══════════════════════════════════════════════════════════ */}
      <section id="why-sea" className="px-6 py-24 bg-brand text-text-inverse">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-1.5 bg-white/10 text-text-inverse text-xs font-medium px-3 py-1 rounded-full mb-5">
                <MapPin className="w-3 h-3" strokeWidth={2} />
                SEA-First
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Built around how SEA fundraising actually works.
              </h2>
              <p className="text-base text-white/70 mt-4 max-w-2xl mx-auto leading-relaxed">
                Generic AI fundraising tools are trained on US data. That means US growth benchmarks, US valuations, US investors. RaiseSEA is the opposite.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-5">
            <SeaPoint
              title="SEA market benchmarks"
              body="Seed in SEA is $250K–$1.5M. We benchmark against actual SEA raises, not US Series A growth charts."
            />
            <SeaPoint
              title="Active SEA investors"
              body="750+ funds across Singapore, Indonesia, Vietnam, Thailand, Philippines, Malaysia. Filtered by who's actually writing checks now."
            />
            <SeaPoint
              title="SEA-specific Q&A"
              body="Practice for the questions SEA investors actually ask — regulatory navigation, cross-border expansion, Singapore routing."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          PRICING (soft)
          ═══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand mb-3">Pricing</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Free while we build.
            </h2>
            <p className="text-base text-text-tertiary mt-4 leading-relaxed max-w-2xl mx-auto">
              We're in our build phase and want SEA founders using RaiseSEA without thinking about pricing. When we launch paid plans, you'll get plenty of notice — and grandfathered pricing for early users.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 text-sm text-text-secondary">
              <ShieldCheck className="w-4 h-4 text-success-text" strokeWidth={1.75} />
              <span>No credit card. No trial timer. No "schedule a demo."</span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════════ */}
      <section id="faq" className="px-6 py-20 bg-surface-card border-y border-border">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand mb-3">Common questions</div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Honest answers.</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="space-y-3">
              <FaqItem
                q="What does RaiseSEA actually do?"
                a="Four things that work together: (1) deck analysis with SEA-benchmarked scoring, (2) AI mock pitch and Q&A practice with voice scoring, (3) matching with 750+ SEA-active investors, (4) a built-in CRM to track every conversation. Most tools do one of these. We do all four."
              />
              <FaqItem
                q="How is this different from Evalyze, Kydarin, or OpenVC?"
                a="Evalyze is US-trained on 8,000 US-skewed raises and lacks pitch practice. Kydarin only does pitch simulation. OpenVC is mostly a global investor database. None are SEA-native. RaiseSEA is the only platform combining all four capabilities AND benchmarked on SEA raises, where seed is $250K–$1.5M, not US's $2–5M."
              />
              <FaqItem
                q="Is my deck content stored or used to train AI?"
                a="Your deck is stored privately in your account so you can return to your analysis. We don't train models on your content. We don't share your deck with investors unless you explicitly do so."
              />
              <FaqItem
                q="What stage of company is this for?"
                a="Pre-seed through Series B. Most useful for founders preparing a raise in the next 0–6 months. If you already have term sheets, the CRM + pitch practice still help. If you haven't built a deck yet, build one first — we analyze decks, we don't generate them."
              />
              <FaqItem
                q="Who built this?"
                a="A founder who's raised in SEA, frustrated by tools built for the US market. RaiseSEA exists because the existing AI fundraising stack punishes SEA founders for being capital-efficient instead of capital-burning."
              />
              <FaqItem
                q="What if my company isn't in SEA?"
                a="The deck analysis and pitch practice still work well. The investor matching skews toward SEA-active funds (so it's less useful for non-SEA raises). If you're raising in SEA from anywhere — including diaspora-founded companies routing through Singapore — you're our target user."
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
              Your next round starts with the next 60 seconds.
            </h2>
            <p className="text-lg text-text-tertiary mt-5 max-w-xl mx-auto leading-relaxed">
              Upload your deck. See where you stand. Decide what's next.
            </p>
            <Link
              href={signedIn ? '/apply' : '/login?next=/apply'}
              className="group inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-text-inverse font-medium text-base rounded-lg px-7 py-3.5 transition-all shadow-subtle hover:shadow-elevated mt-8"
            >
              Analyze your deck
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Link>
            <p className="text-xs text-text-tertiary mt-6">Free. No credit card. No trial timer.</p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-surface-card">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-base font-semibold text-brand tracking-tight">RaiseSEA</Link>
            <span className="text-xs text-text-tertiary">© 2026 · Built for SEA founders</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-text-tertiary">
            <Link href="/glossary"  className="hover:text-text-primary transition-colors">Glossary</Link>
            <a href="#features"     className="hover:text-text-primary transition-colors">Features</a>
            <a href="#why-sea"      className="hover:text-text-primary transition-colors">Why SEA</a>
            <a href="#faq"          className="hover:text-text-primary transition-colors">FAQ</a>
          </div>
        </div>
      </footer>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Stat({ number, suffix = '', label, sub }: { number: number; suffix?: string; label: string; sub: string }) {
  return (
    <div className="bg-surface-card p-6 md:p-7 text-center">
      <div className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
        <CountUp end={number} suffix={suffix} />
      </div>
      <div className="text-sm font-medium text-text-primary mt-1.5">{label}</div>
      <div className="text-xs text-text-tertiary mt-1 leading-relaxed">{sub}</div>
    </div>
  )
}

function FeatureSection({
  kicker, kickerIcon, title, description, bullets, mockup, mockupRight = false
}: {
  kicker: string
  kickerIcon: React.ReactNode
  title: string
  description: string
  bullets: string[]
  mockup: React.ReactNode
  mockupRight?: boolean
}) {
  return (
    <div className={`grid md:grid-cols-2 gap-12 md:gap-16 items-center ${mockupRight ? '' : 'md:[&>*:first-child]:order-2'}`}>
      <ScrollReveal>
        <div className="inline-flex items-center gap-1.5 bg-brand-soft text-brand text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-5">
          {kickerIcon}
          {kicker}
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-base text-text-secondary mt-4 leading-relaxed">
          {description}
        </p>
        <ul className="mt-6 space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
              <span className="w-1 h-1 rounded-full bg-brand mt-2 shrink-0" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </ScrollReveal>

      <ScrollReveal delay={120}>
        {mockup}
      </ScrollReveal>
    </div>
  )
}

function SeaPoint({ title, body }: { title: string; body: string }) {
  return (
    <ScrollReveal>
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-base font-semibold text-text-inverse">{title}</h3>
        <p className="text-sm text-white/70 mt-2 leading-relaxed">{body}</p>
      </div>
    </ScrollReveal>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-surface-page border border-border rounded-xl p-5 open:bg-white transition-colors">
      <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
        <h3 className="text-base font-medium text-text-primary">{q}</h3>
        <span className="shrink-0 text-text-tertiary group-open:rotate-45 transition-transform">
          <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <p className="text-sm text-text-secondary mt-3 leading-relaxed">{a}</p>
    </details>
  )
}

type LandingEditorsTake = {
  headline: string | null
  body: string | null
  takeaway: string | null
}

async function loadLandingNewsPreview(): Promise<{
  editorsTake: LandingEditorsTake | null
  categorizedTopStories: CategorizedTopStories | null
}> {
  const { data: takes } = await supabaseAdmin
    .from('editors_takes')
    .select('headline, body, takeaway, content, top_stories')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(1)

  const t = takes?.[0]
  let editorsTake: LandingEditorsTake | null = null
  if (t) {
    let body = t.body || null
    if (!body && t.content) {
      body = t.content
      if (t.headline && body.startsWith(t.headline)) body = body.slice(t.headline.length).trim()
      if (t.takeaway && body.endsWith(t.takeaway)) body = body.slice(0, body.length - t.takeaway.length).trim()
      if (t.headline && body.startsWith(t.headline)) body = body.slice(t.headline.length).trim()
    }
    editorsTake = {
      headline: t.headline || null,
      body: body || null,
      takeaway: t.takeaway || null,
    }
  }

  return {
    editorsTake,
    categorizedTopStories: (t?.top_stories as CategorizedTopStories | null | undefined) || null,
  }
}

const LANDING_TOP_STORY_ORDER: { key: TopStoryCategory; label: string }[] = [
  { key: 'fundraising', label: '💰 Top fundraising' },
  { key: 'tech',        label: '⚡ Top tech & product' },
  { key: 'policy',      label: '🏛 Top policy & economic' },
  { key: 'exit',        label: '🚪 Top exit' },
]

function LandingTopStories({ stories }: { stories: CategorizedTopStories | null }) {
  const present = LANDING_TOP_STORY_ORDER.filter(c => stories?.[c.key])
  if (present.length === 0) return null

  return (
    <div className="h-full rounded-card border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🔥</span>
        <h3 className="text-base font-semibold text-text-primary">Top stories this week</h3>
        <span className="text-xs text-text-tertiary">editor&apos;s pick per category</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {present.map(({ key, label }) => {
          const story = stories?.[key] as TopStory
          return (
            <article key={key} className="rounded-card border border-amber-100 bg-white p-3.5">
              <div className="text-xs font-semibold uppercase tracking-normal text-amber-700 mb-1.5">{label}</div>
              <h4 className="text-sm font-semibold text-text-primary leading-snug">{story.headline}</h4>
              {story.why && <p className="text-xs text-text-secondary leading-relaxed mt-1.5 line-clamp-3">{story.why}</p>}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {story.sector && <span className="text-xs rounded-full border border-border bg-surface-muted px-2 py-0.5 text-text-tertiary">{story.sector}</span>}
                {story.country && <span className="text-xs rounded-full border border-border bg-surface-muted px-2 py-0.5 text-text-tertiary">📍 {story.country}</span>}
              </div>
              {story.sources?.[0] && (
                <a href={story.sources[0].url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-brand hover:text-brand-hover mt-2">
                  {story.sources[0].name} ↗
                </a>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
