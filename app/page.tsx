// ═══════════════════════════════════════════════════════════════
// app/page.tsx — Landing page (premium rebuild)
//
// Positioning shift: Southeast-Asia-only → "Fundraising intelligence
// built for Asia Pacific", with Southeast Asia kept as the honest
// depth qualifier rather than being swapped out word-for-word.
//
// Narrative order (deliberate — this is the page's argument):
//   hero → credibility → journey → walkthrough → why →
//   coverage → investor intelligence → APAC intelligence →
//   privacy & trust → pricing → programmes → FAQ → final CTA
//
// Two things this rebuild is explicit about:
//   1. Trust. The primary CTA asks for a confidential pitch deck, so
//      the privacy answer appears next to the CTA and then in full,
//      rather than being buried in a FAQ.
//   2. Restraint. Six full-width feature sections became one 2×2
//      walkthrough. The page argues a position instead of listing
//      capabilities.
//
// Architecture: server component. Only the nav, hero walkthrough and
// scroll-reveal wrappers are client components.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Lock, Newspaper } from 'lucide-react'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { ScrollReveal } from '@/components/landing/ScrollReveal'
import { HeroCinematic } from '@/components/landing/HeroCinematic'
import { LandingNav } from '@/components/landing/LandingNav'
import {
  CredibilityStrip,
  JourneySection,
  WalkthroughSection,
  WhySection,
  CoverageSection,
  InvestorIntelligenceSection,
  TrustSection,
  PricingSection,
  ProgramsSection,
  FaqSection,
  FinalCta,
  SiteFooter,
  SectionLabel,
} from '@/components/landing/LandingSections'
import {
  DeckAnalysisMockup,
  InvestorMatchMockup,
  MockPitchMockup,
  CrmMockup,
} from '@/components/landing/LandingMockups'
import type { CategorizedTopStories, TopStory, TopStoryCategory } from '@/lib/news-clustering'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'RaiseSEA | Fundraising Intelligence for APAC Founders',
  description:
    'Assess your raise, prepare for investors, discover relevant capital, and manage your fundraising with market-specific intelligence across Asia Pacific.',
  openGraph: {
    title: 'RaiseSEA | Fundraising Intelligence for APAC Founders',
    description:
      'Fundraising tools, relevant investor matching, and regional market intelligence for founders across Asia Pacific.',
    url: 'https://www.raisesea.com/',
    siteName: 'RaiseSEA',
    type: 'website',
  },
}

export default async function HomePage() {
  const [user, newsPreview] = await Promise.all([getSessionUser(), loadLandingNewsPreview()])
  const signedIn = !!user
  const hasCategorizedTopStories =
    !!newsPreview.categorizedTopStories && Object.values(newsPreview.categorizedTopStories).some(Boolean)

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      {/* Keyboard users land here first. Without it, reaching the page
          content means tabbing through the entire navigation. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-input focus:bg-brand focus:px-4 focus:text-sm focus:font-medium focus:text-text-inverse"
      >
        Skip to content
      </a>

      <LandingNav signedIn={signedIn} />

      <main id="main">
        {/* ═══════════════════════════════════════════════════════════
            HERO — outcome first, not a list of tools
            ═══════════════════════════════════════════════════════════ */}
        <section className="relative isolate overflow-hidden px-6 pb-16 pt-10 md:pb-24 md:pt-14">
          {/* Decorative light + texture. Both are aria-hidden and sit behind
              everything, so they add depth without entering the a11y tree. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-grid" />

          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-card/70 px-3.5 py-1.5 text-xs font-medium text-text-secondary backdrop-blur">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-solid opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-solid" />
              </span>
              Built for APAC founders · deep Southeast Asia coverage
            </p>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.03] tracking-tight text-balance md:text-7xl">
              <span className="text-gradient-brand">Raise smarter across Asia Pacific.</span>
            </h1>

            <p className="mt-5 text-lg font-medium text-text-secondary text-pretty md:text-xl">
              Fundraising intelligence built for APAC founders.
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary text-pretty">
              Assess your raise, prepare for investors, discover relevant capital, manage your fundraising
              pipeline, and stay ahead of market activity across Asia Pacific.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={signedIn ? '/apply' : '/login?next=/apply'}
                className="group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-input bg-gradient-to-b from-brand-muted to-brand px-7 text-base font-medium text-text-inverse shadow-glow transition-all hover:from-brand hover:to-brand-active hover:shadow-lift sm:w-auto"
              >
                Start your raise
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <a
                href="#journey"
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-input border border-border-strong bg-surface-card/70 px-7 text-base font-medium text-text-secondary backdrop-blur transition-colors hover:bg-surface-card hover:text-text-primary sm:w-auto"
              >
                See how it works
              </a>
            </div>

            {/* Privacy reassurance, at the point of decision. This is the
                single highest-value sentence on the page: the button above
                asks a founder to hand over a confidential pitch deck. */}
            <p className="mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-border bg-surface-card/70 px-4 py-2 text-sm text-text-secondary backdrop-blur">
              <Lock className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />
              <span>Private by default — your deck stays in your account and is never shared with investors.</span>
              <Link
                href="/privacy"
                className="inline-flex min-h-[44px] items-center font-medium text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:decoration-brand"
              >
                How we protect it
              </Link>
            </p>
          </div>

          {/* Hero product visual — the real interface, auto-looping through
              the five workflows, with a visible pause control. Framed by a
              soft brand bloom so it sits on the page rather than in it. */}
          <div className="relative mx-auto mt-10 max-w-5xl md:mt-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 -top-6 bottom-8 -z-10 rounded-[32px] bg-brand/15 blur-3xl"
            />
            <HeroCinematic />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            CREDIBILITY STRIP — capability, not vanity metrics
            ═══════════════════════════════════════════════════════════ */}
        <CredibilityStrip />

        {/* ═══════════════════════════════════════════════════════════
            THE FUNDRAISING JOURNEY
            ═══════════════════════════════════════════════════════════ */}
        <JourneySection />

        {/* ═══════════════════════════════════════════════════════════
            PRODUCT WALKTHROUGH — four workflows, real interface
            ═══════════════════════════════════════════════════════════ */}
        <WalkthroughSection
          mockups={[
            <DeckAnalysisMockup key="deck" />,
            <InvestorMatchMockup key="match" />,
            <MockPitchMockup key="pitch" />,
            <CrmMockup key="crm" />,
          ]}
        />

        {/* ═══════════════════════════════════════════════════════════
            WHY RAISESEA — the core positioning argument
            ═══════════════════════════════════════════════════════════ */}
        <WhySection />

        {/* ═══════════════════════════════════════════════════════════
            APAC COVERAGE — depth vs ambition, stated honestly
            ═══════════════════════════════════════════════════════════ */}
        <CoverageSection />

        {/* ═══════════════════════════════════════════════════════════
            INVESTOR INTELLIGENCE
            ═══════════════════════════════════════════════════════════ */}
        <InvestorIntelligenceSection />

        {/* ═══════════════════════════════════════════════════════════
            APAC FUNDRAISING INTELLIGENCE — live, public, crawlable
            ═══════════════════════════════════════════════════════════ */}
        <section id="intelligence" aria-labelledby="intelligence-heading" className="px-6 py-20 md:py-28">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div className="max-w-2xl">
                  <SectionLabel>APAC fundraising intelligence</SectionLabel>
                  <h2 id="intelligence-heading" className="text-xl md:text-2xl font-semibold tracking-tight text-balance">
                    Track where capital is actually moving.
                  </h2>
                  <p className="text-base text-text-secondary mt-4 leading-relaxed text-pretty">
                    Who is raising, who is investing, and what those signals mean for your own round —
                    across funding, investors, M&amp;A, exits, policy and sector shifts.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <Link
                    href={signedIn ? '/news' : '/login?redirectTo=/news'}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-input bg-brand px-5 text-sm font-medium text-text-inverse hover:bg-brand-hover transition-colors"
                  >
                    Explore APAC intelligence
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                  <Link
                    href="/news/history"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-input border border-border-strong px-5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    View archive
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <div className="grid lg:grid-cols-[1fr_1.15fr] gap-5 mt-10">
              <ScrollReveal delay={60}>
                {newsPreview.editorsTake && (newsPreview.editorsTake.headline || newsPreview.editorsTake.body) ? (
                  <article className="h-full rounded-card border border-brand/20 bg-gradient-to-br from-brand-pale to-white p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Newspaper className="w-4 h-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand">Editor&apos;s take</span>
                    </div>
                    {newsPreview.editorsTake.headline && (
                      <h3 className="text-lg font-semibold text-text-primary leading-snug text-balance">
                        {newsPreview.editorsTake.headline}
                      </h3>
                    )}
                    {newsPreview.editorsTake.body && (
                      <p className="text-sm text-text-secondary leading-relaxed mt-3 line-clamp-6 text-pretty">
                        {newsPreview.editorsTake.body}
                      </p>
                    )}
                    {newsPreview.editorsTake.takeaway && (
                      <p className="mt-4 rounded-input border-l-2 border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
                        {newsPreview.editorsTake.takeaway}
                      </p>
                    )}
                  </article>
                ) : (
                  <div className="h-full rounded-card border border-border bg-surface-card p-6 text-sm text-text-secondary">
                    The Editor&apos;s Take appears here once this week&apos;s digest is approved.
                  </div>
                )}
              </ScrollReveal>

              <ScrollReveal delay={120}>
                {hasCategorizedTopStories ? (
                  <LandingTopStories stories={newsPreview.categorizedTopStories} />
                ) : (
                  <div className="h-full rounded-card border border-warning-border bg-warning-bg p-6">
                    <h3 className="text-base font-semibold text-text-primary">Top stories this week</h3>
                    <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                      Editor picks by category appear here once this week&apos;s selections are approved.
                    </p>
                  </div>
                )}
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            PRIVACY & TRUST
            ═══════════════════════════════════════════════════════════ */}
        <TrustSection />

        {/* ═══════════════════════════════════════════════════════════
            PRICING / BETA
            ═══════════════════════════════════════════════════════════ */}
        <PricingSection signedIn={signedIn} />

        {/* ═══════════════════════════════════════════════════════════
            FOR ACCELERATORS & PROGRAMMES
            ═══════════════════════════════════════════════════════════ */}
        <ProgramsSection />

        {/* ═══════════════════════════════════════════════════════════
            FAQ
            ═══════════════════════════════════════════════════════════ */}
        <FaqSection />

        {/* ═══════════════════════════════════════════════════════════
            FINAL CTA
            ═══════════════════════════════════════════════════════════ */}
        <FinalCta signedIn={signedIn} />
      </main>

      <SiteFooter />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// News preview data + top-story rendering
// ═══════════════════════════════════════════════════════════════

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
  { key: 'fundraising', label: 'Top fundraising' },
  { key: 'tech',        label: 'Top tech & product' },
  { key: 'policy',      label: 'Top policy & economic' },
  { key: 'exit',        label: 'Top exit' },
]

function LandingTopStories({ stories }: { stories: CategorizedTopStories | null }) {
  const present = LANDING_TOP_STORY_ORDER.filter(c => stories?.[c.key])
  if (present.length === 0) return null

  return (
    <div className="h-full rounded-card border border-border bg-surface-card p-6">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 className="text-base font-semibold text-text-primary">Top stories this week</h3>
        <span className="text-xs text-text-tertiary">editor&apos;s pick by category</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {present.map(({ key, label }) => {
          const story = stories?.[key] as TopStory
          return (
            <article key={key} className="rounded-card border border-border bg-surface-page p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand mb-1.5">{label}</div>
              <h4 className="text-sm font-semibold text-text-primary leading-snug text-pretty">{story.headline}</h4>
              {story.why && (
                <p className="text-xs text-text-secondary leading-relaxed mt-2 line-clamp-3 text-pretty">{story.why}</p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                {story.sector && (
                  <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-text-tertiary">
                    {story.sector}
                  </span>
                )}
                {story.country && (
                  <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-text-tertiary">
                    {story.country}
                  </span>
                )}
              </div>
              {story.sources?.[0] && (
                <a
                  href={story.sources[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
                >
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
