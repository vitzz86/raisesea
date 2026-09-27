// ═══════════════════════════════════════════════════════════════
// components/landing/LegalPageShell.tsx
//
// Shared shell for /privacy and /terms so both documents sit inside
// the same navigation and footer a visitor arrives with.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import type { ReactNode } from 'react'
import { getSessionUser } from '@/lib/supabase-server'
import { LandingNav } from '@/components/landing/LandingNav'
import { SiteFooter } from '@/components/landing/LandingSections'

export async function LegalPageShell({
  title,
  intro,
  updated,
  children,
}: {
  title: string
  intro: string
  updated: string
  children: ReactNode
}) {
  const user = await getSessionUser()

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-input focus:bg-brand focus:px-4 focus:text-sm focus:font-medium focus:text-text-inverse"
      >
        Skip to content
      </a>

      <LandingNav signedIn={!!user} />

      <main id="main" className="px-6 py-16 md:py-20">
        <article className="max-w-3xl mx-auto">
          <Link href="/" className="text-sm text-text-tertiary hover:text-text-primary transition-colors">
            ← Back to RaiseSEA
          </Link>

          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-text-primary mt-6 text-balance">
            {title}
          </h1>
          <p className="text-base text-text-secondary mt-4 leading-relaxed text-pretty">{intro}</p>
          <p className="text-sm text-text-tertiary mt-4">Last updated: {updated}</p>

          {/* ── REVIEW NOTICE ──────────────────────────────────────────
              This document is a plain-language summary written to
              accompany the beta product. It is deliberately explicit
              about not being a substitute for a reviewed policy, and it
              makes no compliance or certification claims. Replace this
              block (and the document body) once legal review is done. */}
          <div className="mt-8 rounded-card border border-warning-border bg-warning-bg p-5">
            <h2 className="text-sm font-semibold text-text-primary">About this document</h2>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              This is a plain-language summary of how RaiseSEA handles founder information during the
              beta. It is written to answer the questions founders actually ask, and it is not a
              substitute for a formally reviewed policy. If anything here is unclear or looks wrong,
              contact us and we will correct it.
            </p>
          </div>

          <div className="mt-10 space-y-10">{children}</div>

          <div className="mt-12 rounded-card border border-border bg-surface-card p-6">
            <h2 className="text-base font-semibold text-text-primary">Questions or requests</h2>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              Email{' '}
              <a href="mailto:hello@raisesea.com" className="font-medium text-brand hover:text-brand-hover transition-colors">
                hello@raisesea.com
              </a>{' '}
              for access, correction or deletion requests, or with any question about this document.
            </p>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary tracking-tight text-balance">{heading}</h2>
      <div className="text-sm text-text-secondary leading-relaxed mt-3 space-y-3 text-pretty">{children}</div>
    </section>
  )
}
