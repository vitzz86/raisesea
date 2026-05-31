// ═══════════════════════════════════════════════════════════════
// /meet/preview/[meeting_request_id]
// Expert-facing brief view of the founder + their submission.
// Shows ONLY: company info, AI summary, deck download.
// Hides: deck scoring, critique, matched investors, etc.
// Available only to the VC the request is addressed to (or super admins).
// ═══════════════════════════════════════════════════════════════

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import { signedDeckUrl, isStoragePath } from '@/lib/storage'
import DashboardShell from '@/components/DashboardShell'
import { Card, Button, Badge } from '@/components/ui'
import { ArrowLeft, FileText, ExternalLink, MapPin, Rocket, Tag, Briefcase } from 'lucide-react'

export const dynamic = 'force-dynamic'

const GOAL_LABELS: Record<string, string> = {
  pitch_intro: 'Pitch / first intro',
  investment_discussion: 'Investment discussion',
  product_feedback: 'Product / deck feedback',
  market_advice: 'Market or strategy advice',
  intro_request: 'Request for introductions',
  other: 'Other',
}

function fmtUSD(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

export default async function MeetingPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id: meetingRequestId } = await params

  const { data: mr } = await supabaseAdmin
    .from('meeting_requests')
    .select(`
      id, status, meeting_goal, meeting_notes, key_questions,
      vc_profile_id, submission_id, founder_user_id, created_at
    `)
    .eq('id', meetingRequestId)
    .maybeSingle()

  if (!mr) notFound()

  const { data: vcProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('user_id')
    .eq('id', mr.vc_profile_id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  const isTargetVc = vcProfile?.user_id === user.id
  if (!isTargetVc && !admin) {
    notFound()
  }

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select(`
      id, unique_slug, company_name, country, stage, sector, business_model,
      raise_target_usd, current_mrr_usd, annual_revenue_usd,
      one_liner, problem, ai_description, ai_traction, ai_market_size, ai_team_summary,
      founder_name, founder_email, founder_linkedin, founder_profile, current_investors,
      deck_url, created_at
    `)
    .eq('id', mr.submission_id)
    .maybeSingle()

  if (!submission) notFound()

  let deckLink: string | null = null
  if (submission.deck_url && isStoragePath(submission.deck_url)) {
    deckLink = await signedDeckUrl(submission.deck_url, 3600)
  }

  // ── Load profile + expert status for the shell
  const supabase = await createSupabaseServerClient()
  const { data: userProfile } = await supabase
    .from('user_profiles').select('full_name, company_name').eq('id', user.id).maybeSingle()
  const isExpert = await isApprovedExpert(user.id)

  return (
    <DashboardShell user={user} profile={userProfile} isAdmin={admin} isApprovedExpert={isExpert} activePath="expert-meetings">
      <div className="max-w-5xl">
        <Link href="/experts/meetings" className="text-xs text-text-tertiary hover:text-text-primary inline-flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Back to meetings
        </Link>

        {/* Header */}
        <Card className="mt-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              {submission.company_name || 'Untitled'}
            </h1>
            <Badge tone={
              mr.status === 'pending' ? 'warning'
              : mr.status === 'confirmed' ? 'success'
              : 'default'
            }>
              {mr.status}
            </Badge>
          </div>
          {submission.one_liner && (
            <p className="text-sm text-text-secondary mb-3 leading-relaxed">{submission.one_liner}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-text-tertiary mb-4">
            {submission.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" strokeWidth={1.75} /> {submission.country}
              </span>
            )}
            {submission.stage && (
              <span className="inline-flex items-center gap-1">
                <Rocket className="w-3 h-3" strokeWidth={1.75} /> {submission.stage}
              </span>
            )}
            {submission.sector && (
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" strokeWidth={1.75} /> {submission.sector}
              </span>
            )}
            {submission.business_model && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="w-3 h-3" strokeWidth={1.75} /> {submission.business_model}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-3 border-t border-border-muted">
            {deckLink ? (
              <a href={deckLink} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" leftIcon={<FileText className="w-3.5 h-3.5" strokeWidth={1.75} />}>
                  Open pitch deck
                </Button>
              </a>
            ) : (
              <span className="text-xs text-text-tertiary">No deck on file</span>
            )}
            {submission.founder_linkedin && (
              <a href={submission.founder_linkedin} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" rightIcon={<ExternalLink className="w-3 h-3" strokeWidth={1.75} />}>
                  Founder LinkedIn
                </Button>
              </a>
            )}
          </div>
        </Card>

        {/* Meeting context */}
        <Section title="Meeting context">
          <div className="text-xs text-text-tertiary mb-1">Goal</div>
          <p className="text-sm text-text-primary font-medium mb-3">{GOAL_LABELS[mr.meeting_goal] || mr.meeting_goal}</p>
          <div className="text-xs text-text-tertiary mb-1">Note from founder</div>
          <p className="text-sm text-text-secondary whitespace-pre-wrap mb-3 leading-relaxed">{mr.meeting_notes}</p>
          {Array.isArray(mr.key_questions) && (mr.key_questions as string[]).length > 0 && (
            <>
              <div className="text-xs text-text-tertiary mb-1">Key questions</div>
              <ul className="text-sm text-text-secondary space-y-1">
                {(mr.key_questions as string[]).map((q, i) => <li key={i}>• {q}</li>)}
              </ul>
            </>
          )}
        </Section>

        {/* Founder */}
        <Section title="Founder">
          <Row label="Name"    value={submission.founder_name} />
          <Row label="Email"   value={submission.founder_email} />
          <Row label="Profile" value={submission.founder_profile} />
        </Section>

        {submission.problem && (
          <Section title="Problem">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{submission.problem}</p>
          </Section>
        )}
        {submission.ai_description && (
          <Section title="Solution">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{submission.ai_description}</p>
          </Section>
        )}
        {submission.ai_market_size && (
          <Section title="Market">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{submission.ai_market_size}</p>
          </Section>
        )}
        {submission.ai_traction && (
          <Section title="Traction">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{submission.ai_traction}</p>
          </Section>
        )}
        {submission.ai_team_summary && (
          <Section title="Team">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{submission.ai_team_summary}</p>
          </Section>
        )}

        <Section title="Fundraising">
          <Row label="Raise target" value={fmtUSD(submission.raise_target_usd)} />
          {submission.annual_revenue_usd != null && submission.annual_revenue_usd > 0 && (
            <Row label="Annual revenue" value={fmtUSD(submission.annual_revenue_usd)} />
          )}
          {submission.current_mrr_usd != null && submission.current_mrr_usd > 0 && (
            <Row label="Current MRR" value={fmtUSD(submission.current_mrr_usd)} />
          )}
          {submission.current_investors && (
            <Row label="Existing investors" value={submission.current_investors} />
          )}
        </Section>

        <p className="text-[11px] text-text-tertiary mt-4 text-center">
          This summary is generated from the founder&apos;s submission. AI scoring &amp; investor matches are not shown to experts.
        </p>
      </div>
    </DashboardShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-3" padding="default">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">{title}</h2>
      {children}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-text-primary text-right">{value}</span>
    </div>
  )
}
