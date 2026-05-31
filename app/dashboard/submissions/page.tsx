import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

type SubmissionRow = {
  id: string
  unique_slug: string
  company_name: string
  stage: string | null
  sector: string | null
  raise_target_usd: number | null
  analysis_status: string | null
  deck_analysis: string | null
  top_match_score: number | null
  created_at: string
  is_public: boolean | null
}

function fmtUSD(n: number | null): string {
  if (!n) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDeckScore(deckAnalysisJson: string | null): number | null {
  if (!deckAnalysisJson) return null
  try {
    const parsed = JSON.parse(deckAnalysisJson)
    return typeof parsed.overall_score === 'number' ? parsed.overall_score : null
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/dashboard')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name, email, role, plan, submissions_count')
    .eq('id', user.id)
    .maybeSingle()

  // Check expert application status (chunk 6)
  const { data: expertProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('id, application_status')
    .eq('user_id', user.id)
    .maybeSingle()

  // Pull user's submissions (service role — bypasses RLS for accurate count)
  const { data: rawSubs } = await supabaseAdmin
    .from('submissions')
    .select('id, unique_slug, company_name, stage, sector, raise_target_usd, analysis_status, deck_analysis, top_match_score, created_at, is_public')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const submissions = (rawSubs || []) as SubmissionRow[]
  const isAdmin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  // Aggregate stats
  const total = submissions.length
  const totalRaise = submissions.reduce((sum, s) => sum + (s.raise_target_usd || 0), 0)
  const scores = submissions.map(s => getDeckScore(s.deck_analysis)).filter((x): x is number => x != null)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const topScore = scores.length > 0 ? Math.max(...scores) : null
  const lastSubmissionDate = submissions[0]?.created_at

  return (
    <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="submissions">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          Deck Analysis Results
        </h1>
        <p className="text-sm text-text-tertiary mt-1">
          {total === 0
            ? 'Upload your first deck to get an AI analysis and matched to SEA investors.'
            : `${total} submission${total === 1 ? '' : 's'} on file. Click any one to view its full analysis.`}
        </p>
      </div>

      {/* Expert application status banner */}
      {expertProfile?.application_status === 'pending' && (
        <div className="mb-5 bg-warning-bg border border-warning-border rounded-xl p-4 flex items-start gap-3">
          <span className="text-warning-text text-lg">⏳</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-text">Your expert application is pending review</p>
            <p className="text-xs text-warning-text mt-0.5">We typically respond within 5 business days. <Link href="/experts/apply" className="underline">View status</Link></p>
          </div>
        </div>
      )}
      {expertProfile?.application_status === 'active' && (
        <div className="mb-5 bg-success-bg border border-success-border rounded-xl p-4 flex items-start gap-3">
          <span className="text-success-text text-lg">✓</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">Your expert profile is live</p>
            <p className="text-xs text-success-text mt-0.5">Founders can find you in the <Link href="/meet" className="underline">directory</Link>. <Link href="/experts/apply" className="underline">View profile</Link></p>
          </div>
        </div>
      )}
      {expertProfile?.application_status === 'rejected' && (
        <div className="mb-5 bg-danger-bg border border-danger-border rounded-xl p-4 flex items-start gap-3">
          <span className="text-danger-text text-lg">✗</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Your expert application was not approved</p>
            <p className="text-xs text-danger-text mt-0.5"><Link href="/experts/apply" className="underline">See details</Link></p>
          </div>
        </div>
      )}
      {!expertProfile && (
        <div className="mb-5 bg-white border border-border rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Are you also a VC, mentor, advisor, or domain expert?</p>
            <p className="text-xs text-text-tertiary mt-0.5">Apply to join our network and get curated SEA founder deal flow.</p>
          </div>
          <Link href="/experts/apply" className="text-xs font-medium bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5 transition whitespace-nowrap">
            Apply →
          </Link>
        </div>
      )}

      {/* Empty state */}
      {total === 0 ? (
        <div className="bg-white border border-border rounded-xl p-10 text-center">
          <div className="text-4xl mb-3 opacity-40">📊</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Start with your deck</h2>
          <p className="text-sm text-text-tertiary mb-6 max-w-md mx-auto">
            Upload your pitch deck. You'll get a deck score, market sizing, competitor analysis, and matched investors — in 60 seconds.
          </p>
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-lg px-5 py-2.5 transition"
          >
            Analyze your first deck →
          </Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total submissions" value={total} />
            <StatCard label="Average score" value={avgScore != null ? `${avgScore}/100` : '—'} />
            <StatCard label="Top score" value={topScore != null ? `${topScore}/100` : '—'} />
            <StatCard label="Last activity" value={lastSubmissionDate ? fmtDate(lastSubmissionDate) : '—'} />
          </div>

          {/* Submissions table */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-text-primary">Your submissions</h2>
              <Link
                href="/apply"
                className="text-xs font-medium text-brand hover:underline"
              >
                + New analysis
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    <Th>Company</Th>
                    <Th>Stage</Th>
                    <Th>Raise</Th>
                    <Th>Deck score</Th>
                    <Th>Top match</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map(s => {
                    const score = getDeckScore(s.deck_analysis)
                    return (
                      <tr key={s.id} className="hover:bg-surface-muted">
                        <Td>
                          <div className="font-medium text-text-primary">{s.company_name || '(untitled)'}</div>
                          {s.sector && <div className="text-xs text-text-tertiary">{s.sector}</div>}
                        </Td>
                        <Td>{s.stage || '—'}</Td>
                        <Td>{fmtUSD(s.raise_target_usd)}</Td>
                        <Td>
                          {score != null ? (
                            <span className={`font-semibold ${score >= 70 ? 'text-success-text' : score >= 50 ? 'text-warning-text' : 'text-danger-text'}`}>
                              {score}
                            </span>
                          ) : '—'}
                        </Td>
                        <Td>{s.top_match_score != null ? <span className="text-brand font-medium">{s.top_match_score}</span> : '—'}</Td>
                        <Td className="text-xs text-text-tertiary">{fmtDate(s.created_at)}</Td>
                        <Td>
                          {s.analysis_status === 'complete' && <span className="inline-flex items-center gap-1 text-xs text-success-text"><span className="w-1.5 h-1.5 rounded-full bg-success-solid" />Complete</span>}
                          {s.analysis_status === 'failed' && <span className="inline-flex items-center gap-1 text-xs text-danger-text"><span className="w-1.5 h-1.5 rounded-full bg-danger-solid" />Failed</span>}
                          {(!s.analysis_status || s.analysis_status === 'pending') && <span className="inline-flex items-center gap-1 text-xs text-text-tertiary"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Pending</span>}
                        </Td>
                        <Td>
                          <Link
                            href={`/match/${s.unique_slug}`}
                            className="text-xs font-medium text-brand hover:underline"
                          >
                            View →
                          </Link>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wide px-4 py-2.5">{children}</th>
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
