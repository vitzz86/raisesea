import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import { NewsSignupPrompt } from '@/components/landing/NewsSignupPrompt'
import NewsFeed from './NewsFeed'
import {
  NEWS_JSON_PATH,
  NEWS_MARKDOWN_PATH,
  NEWS_RSS_PATH,
  NEWS_TEXT_ALIAS_PATH,
  NEWS_TEXT_PATH,
  buildNewsJsonLd,
  escapeJsonForHtml,
  getCurrentPublicNewsDigest,
  getPublicBaseUrl,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Weekly SEA Fundraising News | RaiseSEA',
  description: 'A weekly digest of Southeast Asia startup fundraising, tech, policy, exits, investor moves, and market signals for founders raising capital.',
  openGraph: {
    title: 'Weekly SEA Fundraising News | RaiseSEA',
    description: 'Read RaiseSEA’s weekly digest of SEA startup fundraising, tech, policy, and investor signals.',
    url: 'https://www.raisesea.com/news',
    siteName: 'RaiseSEA',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.raisesea.com/news',
    types: {
      'text/plain': 'https://www.raisesea.com/ai-news.txt',
      'text/markdown': 'https://www.raisesea.com/news/latest.md',
      'application/json': 'https://www.raisesea.com/news.json',
      'application/rss+xml': 'https://www.raisesea.com/news/rss.xml',
    },
  },
}

type NewsProfile = {
  full_name: string | null
  company_name: string | null
  news_sectors: string[] | null
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sectors?: string }>
}) {
  const user = await getSessionUser()
  let profile: NewsProfile | null = null
  let admin = false
  let isExpert = false

  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, company_name, news_sectors')
      .eq('id', user.id)
      .maybeSingle()
    profile = data as NewsProfile | null
    admin = await isSuperAdmin(user)
    isExpert = await isApprovedExpert(user.id)
  }

  const digest = await getCurrentPublicNewsDigest()
  const baseUrl = getPublicBaseUrl()
  const jsonLd = buildNewsJsonLd(digest, baseUrl)
  const machineLinks = (
    <div className="mb-5 rounded-xl border border-border bg-white px-4 py-3 text-xs text-text-tertiary">
      <span className="font-medium text-text-primary">Crawler-friendly full digest:</span>{' '}
      <a href={NEWS_TEXT_PATH} className="text-brand hover:underline">Plain text</a>
      {' · '}
      <a href={NEWS_MARKDOWN_PATH} className="text-brand hover:underline">Markdown</a>
      {' · '}
      <a href={NEWS_JSON_PATH} className="text-brand hover:underline">JSON</a>
      {' · '}
      <a href={NEWS_RSS_PATH} className="text-brand hover:underline">RSS</a>
      {' · '}
      <a href={NEWS_TEXT_ALIAS_PATH} className="text-brand hover:underline">AI alias</a>
      <span className="block mt-1">
        These files include every approved story, summary, why-it-matters note, source, category, sector, country, and publish date from this page.
      </span>
    </div>
  )

  const feed = (
    <>
      {machineLinks}
      <NewsFeed
        items={digest.items}
        userSectors={profile?.news_sectors || []}
        editorsTake={digest.editorsTake}
        trending={digest.trending}
        topStories={digest.topStories}
        categorizedTopStories={digest.categorizedTopStories}
        glance={digest.glance}
        dateRange={digest.dateRange}
        weekStats={digest.weekStats}
        publicMode={!user}
        className={user ? 'max-w-5xl' : 'max-w-5xl mx-auto'}
        loginHref="/login?redirectTo=/news"
      />
      <script
        id="raisesea-news-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapeJsonForHtml(jsonLd) }}
      />
    </>
  )

  if (!user) {
    return (
      <main className="min-h-screen bg-surface-page text-text-primary">
        <NewsSignupPrompt
          signedIn={false}
          trigger="immediate"
          storageKey="raisesea_public_news_prompt_seen"
          eyebrow="Weekly digest"
          title="Try the full RaiseSEA experience."
          body="Sign in with Google to receive weekly SEA fundraising news, plus deck analysis, mock pitch practice, investor matching, and CRM."
          ctaLabel="Sign in with Google"
          href="/login?redirectTo=/news"
        />
        <nav className="sticky top-0 z-40 bg-surface-page/85 backdrop-blur border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold text-brand tracking-tight">RaiseSEA</Link>
            <div className="flex items-center gap-5">
              <Link href="/#features" className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">Features</Link>
              <Link href="/#why-sea" className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">Why SEA</Link>
              <Link href="/login?redirectTo=/news" className="text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-3.5 py-1.5 transition-colors">Sign in</Link>
            </div>
          </div>
        </nav>
        <section className="px-6 py-8 md:py-10">
          {feed}
        </section>
      </main>
    )
  }

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="news">
      {feed}
    </DashboardShell>
  )
}
