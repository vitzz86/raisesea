// ═══════════════════════════════════════════════════════════════
// app/glossary/page.tsx (chunk 12.7.4 redesign)
//
// Glossary of fundraising terms. Two modes:
//   • Signed-in: wrapped in DashboardShell, sits under "Learn" in sidebar
//   • Signed-out: standalone public page (linked from landing footer + tooltips)
//
// Layout: sticky category nav on left (desktop), terms in 2-col grid on right.
// Each term is a tight card — not a sprawling box.
// ═══════════════════════════════════════════════════════════════

import { GLOSSARY, CATEGORY_LABELS, groupByCategory } from '@/lib/glossary'
import { getSessionUser, createSupabaseServerClient } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import { BookOpen, ChevronRight, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Fundraising glossary — RaiseSEA',
  description: 'Plain-English definitions of every fundraising term you\'ll hear from investors. SAFE, MRR, TAM, cap tables, and more.',
}

export const dynamic = 'force-dynamic'

export default async function GlossaryPage() {
  const user = await getSessionUser()
  const groups = groupByCategory()

  // If signed-in, fetch the data DashboardShell needs
  let profile: { full_name: string | null; company_name: string | null; email: string | null; role: string | null; plan: string | null; submissions_count: number | null } | null = null
  let isAdmin = false
  let isExpert = false
  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, company_name, email, role, plan, submissions_count')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
    isAdmin = await isSuperAdmin(user)
    isExpert = await isApprovedExpert(user.id)
  }

  const content = <GlossaryContent groups={groups} />

  // ─── Signed-in: wrapped in DashboardShell ────────────────────
  if (user) {
    return (
      <DashboardShell
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        isApprovedExpert={isExpert}
        activePath="glossary"
      >
        {content}
      </DashboardShell>
    )
  }

  // ─── Signed-out: standalone public page ──────────────────────
  return (
    <div className="min-h-screen bg-surface-page">
      <header className="bg-surface-card border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            RaiseSEA
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-3.5 py-1.5 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        {content}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GLOSSARY CONTENT — shared between signed-in / signed-out modes
// ═══════════════════════════════════════════════════════════════

function GlossaryContent({ groups }: { groups: Record<string, typeof GLOSSARY> }) {
  const totalTerms = GLOSSARY.length
  const categoryEntries = Object.entries(groups)

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand mb-2">
          <BookOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
          Learn
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Fundraising glossary
        </h1>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-2xl">
          Plain-English definitions of every term you'll hear from investors. No jargon-on-jargon — just what you need to know to hold your own in a meeting.
        </p>
        <p className="text-xs text-text-tertiary mt-3">
          {totalTerms} terms · {categoryEntries.length} categories
        </p>
      </div>

      {/* Layout: sticky category nav on left (desktop), terms on right */}
      <div className="grid lg:grid-cols-[200px_1fr] gap-8">

        {/* Sticky category nav */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
            Categories
          </div>
          <ul className="space-y-1">
            {categoryEntries.map(([cat, terms]) => (
              <li key={cat}>
                <a
                  href={`#${cat}`}
                  className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
                >
                  <span className="truncate">
                    {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                  </span>
                  <span className="text-[10px] text-text-tertiary tabular-nums shrink-0">
                    {terms.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Term sections */}
        <main className="space-y-10 min-w-0">
          {categoryEntries.map(([cat, terms]) => (
            <section key={cat} id={cat} className="scroll-mt-6">
              <div className="border-b border-border pb-2 mb-4">
                <h2 className="text-base font-semibold text-text-primary tracking-tight">
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                </h2>
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  {terms.length} {terms.length === 1 ? 'term' : 'terms'}
                </p>
              </div>

              {/* 2-col grid of compact term cards */}
              <div className="grid md:grid-cols-2 gap-3">
                {terms.map(t => (
                  <article
                    key={t.term}
                    id={`term-${t.term.toLowerCase().replace(/\s+/g, '-')}`}
                    className="bg-surface-card border border-border rounded-lg p-4"
                  >
                    {/* Term name */}
                    <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-text-primary">{t.term}</h3>
                      {t.fullName && t.fullName !== t.term && (
                        <span className="text-[11px] text-text-tertiary font-normal italic">
                          {t.fullName}
                        </span>
                      )}
                    </div>

                    {/* Short definition (one-liner) */}
                    <p className="text-[13px] text-text-primary leading-relaxed mb-2">
                      {t.short}
                    </p>

                    {/* Long explanation */}
                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      {t.long}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>

      {/* Footer hint */}
      <div className="mt-12 pt-8 border-t border-border-muted text-center">
        <p className="text-xs text-text-tertiary mb-2">
          Missing a term? Found something confusing?
        </p>
        <a
          href="mailto:hello@raisesea.com?subject=Glossary%20feedback"
          className="text-xs font-medium text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1"
        >
          Send feedback
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
        </a>
      </div>
    </div>
  )
}
