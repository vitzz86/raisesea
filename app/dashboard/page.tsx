// ═══════════════════════════════════════════════════════════════
// app/dashboard/page.tsx — Dashboard HUB (chunk 12.7.4 rebuild)
//
// The signed-in home. NOT a list of submissions — that lives at
// /dashboard/submissions now. This page is a multi-block aggregator
// showing the user where they are across all 4 journey blocks:
//
//   • Assess  — 3 latest deck submissions + scores + top match
//   • Prepare — latest mock pitch session + experts to meet
//   • Execute — upcoming meetings + 3 latest CRM contacts
//   • Learn   — this week's news highlights (with date range)
//
// Each block has CTAs that link to its dedicated dedicated page.
// ═══════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import { RefreshOnFocus } from '@/components/RefreshOnFocus'
import BetaProgressCard from '@/components/BetaProgressCard'
import {
  ArrowRight, Plus, FileText, Mic, Building2, Calendar, Newspaper,
  TrendingUp, Briefcase, Users, Sparkles, Target, MessageSquare, Calculator
} from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────

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
}

type MockPitchSessionRow = {
  id: string
  submission_id: string | null
  mode: string | null
  duration_min: number | null
  status: string | null
  started_at: string
  debrief: { overall_score?: number } | null
}

type CrmContactRow = {
  id: string
  name: string | null
  company: string | null
  stage: string | null
  priority: string | null
  next_action: string | null
  next_action_date: string | null
  created_at: string
}

type MeetingRow = {
  id: string
  vc_profile_id: string
  founder_user_id: string
  status: string | null
  confirmed_slot: string | null
  meeting_goal: string | null
  google_meet_link: string | null
  created_at: string
}

type VcProfileRow = {
  id: string
  user_id: string
  display_name: string | null
  fund_or_firm: string | null
  title: string | null
  bio: string | null
  expertise_areas: string[] | null
  application_status: string | null
}

type NewsItemRow = {
  id: string
  category: string | null
  title: string
  company_name: string | null
  amount_usd: number | null
  stage: string | null
  sector: string | null
  country: string | null
  source_name: string | null
  published_at: string
}

type SavedScenarioRow = {
  id: string
  name: string
  instrument: string                    // 'equity' | 'debt' | 'safe_post' | 'safe_pre' | 'note'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: any                           // shape depends on instrument
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────

function getDeckScore(deckAnalysisJson: string | null): number | null {
  if (!deckAnalysisJson) return null
  try {
    const parsed = JSON.parse(deckAnalysisJson)
    return typeof parsed.overall_score === 'number' ? parsed.overall_score : null
  } catch {
    return null
  }
}

function fmtUSD(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

function fmtRelative(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const day = 86400 * 1000
  if (diff < day)        return 'Today'
  if (diff < 2 * day)    return 'Yesterday'
  if (diff < 7 * day)    return `${Math.floor(diff / day)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMeetingDate(iso: string): string {
  const date = new Date(iso)
  const diff = date.getTime() - Date.now()
  const day = 86400 * 1000
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
  if (diff < day && diff > 0)        return `Today, ${date.toLocaleTimeString('en-US', opts)}`
  if (diff < 2 * day && diff > 0)    return `Tomorrow, ${date.toLocaleTimeString('en-US', opts)}`
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString('en-US', opts)}`
}

function fmtActionDate(dateStr: string | null): { label: string; overdue: boolean; soon: boolean } {
  if (!dateStr) return { label: 'No date set', overdue: false, soon: false }
  const date = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / (86400 * 1000))
  if (diffDays < 0)   return { label: `${Math.abs(diffDays)}d overdue`,           overdue: true,  soon: false }
  if (diffDays === 0) return { label: 'Today',                                   overdue: false, soon: true }
  if (diffDays === 1) return { label: 'Tomorrow',                                overdue: false, soon: true }
  if (diffDays < 7)   return { label: `In ${diffDays}d`,                          overdue: false, soon: true }
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return { label: date.toLocaleDateString('en-US', opts), overdue: false, soon: false }
}

function fmtWeekRange(now: Date = new Date()): string {
  // Range covers news published in the past 7 days INCLUDING today.
  // If today is May 30 → "May 23 – May 30, 2026".
  // Cross-month → "Apr 26 – May 3, 2026".
  // Month name shown on both sides for clarity (per user preference).
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const end   = now
  const start = new Date(now.getTime() - 7 * 86400 * 1000)
  const startMonth = MONTHS[start.getMonth()]
  const endMonth   = MONTHS[end.getMonth()]
  const year       = end.getFullYear()
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`
}

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default async function DashboardHub() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/dashboard')

  const supabase = await createSupabaseServerClient()
  const [profile, expertProfileResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('full_name, company_name, email, role, plan, submissions_count')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('vc_profiles')
      .select('id, application_status')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  const expertProfile = expertProfileResult.data

  const [isAdmin, isExpert] = await Promise.all([
    isSuperAdmin(user),
    isApprovedExpert(user.id),
  ])

  // ─── Parallel data fetches for all blocks ─────────────────────
  const [
    submissionsResult,
    latestPitchResult,
    latestQaResult,
    upcomingMeetingsResult,
    crmActionsResult,
    suggestedExpertsResult,
    newsItemsResult,
    editorsTakeResult,
    savedScenariosResult,
  ] = await Promise.all([
    // Latest 3 submissions for the Assess block
    supabaseAdmin
      .from('submissions')
      .select('id, unique_slug, company_name, stage, sector, raise_target_usd, analysis_status, deck_analysis, top_match_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),

    // Most recent completed PITCH session (mode = 'pitch')
    supabaseAdmin
      .from('mock_pitch_sessions')
      .select('id, submission_id, mode, duration_min, status, started_at, debrief')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('mode', 'pitch')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most recent completed Q&A session (mode = 'qa')
    supabaseAdmin
      .from('mock_pitch_sessions')
      .select('id, submission_id, mode, duration_min, status, started_at, debrief')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('mode', 'qa')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Upcoming confirmed meetings (admin-only founder feature)
    isAdmin
      ? supabaseAdmin
        .from('meeting_requests')
        .select('id, vc_profile_id, founder_user_id, status, confirmed_slot, meeting_goal, google_meet_link, created_at')
        .eq('founder_user_id', user.id)
        .eq('status', 'confirmed')
        .gte('confirmed_slot', new Date().toISOString())
        .order('confirmed_slot', { ascending: true })
        .limit(3)
      : Promise.resolve({ data: [] }),

    // CRM contacts with a next_action set — these are the action items the user needs to do
    supabaseAdmin
      .from('crm_contacts')
      .select('id, name, company, stage, priority, next_action, next_action_date, created_at')
      .eq('user_id', user.id)
      .not('next_action', 'is', null)
      .order('next_action_date', { ascending: true, nullsFirst: false })
      .limit(4),

    // 5 active experts for the "Mentors you might meet" sub-section (admin-only founder feature)
    isAdmin
      ? supabaseAdmin
        .from('vc_profiles')
        .select('id, user_id, display_name, fund_or_firm, title, bio, expertise_areas, application_status')
        .eq('application_status', 'active')
        .neq('user_id', user.id)
        .limit(5)
      : Promise.resolve({ data: [] }),

    // 3 latest news items from the past 7 days
    supabaseAdmin
      .from('news_items')
      .select('id, category, title, company_name, amount_usd, stage, sector, country, source_name, published_at')
      .eq('status', 'approved')
      .gte('published_at', new Date(Date.now() - 7 * 86400 * 1000).toISOString())
      .order('published_at', { ascending: false })
      .limit(3),

    // Most recent approved editor's take (just the headline for the hub)
    supabaseAdmin
      .from('editors_takes')
      .select('headline, takeaway, approved_at')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Latest saved calculator scenario PER instrument — used by the Calculator block
    supabaseAdmin
      .from('safe_scenarios')
      .select('id, name, instrument, inputs, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const submissions       = (submissionsResult.data        || []) as SubmissionRow[]
  const latestPitch       = latestPitchResult.data            as MockPitchSessionRow | null
  const latestQa          = latestQaResult.data               as MockPitchSessionRow | null
  const upcomingMeetings  = (upcomingMeetingsResult.data   || []) as MeetingRow[]
  const crmActions        = (crmActionsResult.data         || []) as CrmContactRow[]
  const suggestedExperts  = (suggestedExpertsResult.data   || []) as VcProfileRow[]
  const newsItems         = (newsItemsResult.data          || []) as NewsItemRow[]
  const editorsTake       = editorsTakeResult.data            as { headline: string | null; takeaway: string | null; approved_at: string } | null
  const savedScenarios    = (savedScenariosResult.data     || []) as SavedScenarioRow[]

  // For the Calculator block: latest saved scenario PER instrument category
  // Safe values: safe_post / safe_pre / note → all bucket into "convertible"
  const latestEquityScenario      = savedScenarios.find(s => s.instrument === 'equity')      || null
  const latestDebtScenario        = savedScenarios.find(s => s.instrument === 'debt')        || null
  const latestConvertibleScenario = savedScenarios.find(s => ['safe_post', 'safe_pre', 'note'].includes(s.instrument)) || null

  const firstName = profile.data?.full_name?.split(' ')[0] || 'there'
  const weekRange = fmtWeekRange()

  // Count overdue actions for the Execute block alert
  const overdueCount = crmActions.filter(c => fmtActionDate(c.next_action_date).overdue).length

  // ─── Render ────────────────────────────────────────────────────

  return (
    <DashboardShell user={user} profile={profile.data || null} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="dashboard">

      {/* Auto-refresh when tab regains focus — keeps data fresh without manual reload */}
      <RefreshOnFocus />

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Welcome back, {firstName}.
        </h1>
        <p className="text-sm text-text-tertiary mt-1">
          Your fundraise at a glance. Pick up where you left off.
        </p>
      </div>

      {/* Beta tester progress card — shown to all users during beta phase.
          Dismissible (localStorage). Auto-hides after all tasks complete + dismissed. */}
      <BetaProgressCard />

      {/* Expert application status banner (if applicable) */}
      {expertProfile?.application_status === 'pending' && (
        <div className="mb-6 bg-warning-bg border border-warning-border rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-warning-text mt-0.5 shrink-0" strokeWidth={1.75} />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-text">Your expert application is pending review</p>
            <p className="text-xs text-warning-text mt-0.5">
              We typically respond within 5 business days. <Link href="/experts/apply" className="underline">View status</Link>
            </p>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────
          BLOCK 1: ASSESS — submissions + top match
          ─────────────────────────────────────────────────────── */}
      <HubBlock
        kicker="Assess"
        kickerIcon={<FileText className="w-3.5 h-3.5" strokeWidth={1.75} />}
        title="Where your decks stand"
        cta={{ label: 'View all results', href: '/dashboard/submissions' }}
      >
        {submissions.length === 0 ? (
          <EmptyState
            title="No decks analyzed yet"
            body="Upload your first pitch deck to get an AI analysis, market sizing, and matched SEA investors — in 60 seconds."
            cta={{ label: 'Analyze your first deck', href: '/apply' }}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {submissions.map(sub => {
                const score = getDeckScore(sub.deck_analysis)
                const isProcessing = sub.analysis_status === 'processing' || sub.analysis_status === 'pending'
                return (
                  <Link
                    key={sub.id}
                    href={`/match/${sub.unique_slug}`}
                    className="group block bg-surface-card border border-border rounded-xl p-4 hover:border-brand/30 hover:shadow-subtle transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-brand transition-colors">
                          {sub.company_name}
                        </h3>
                        <p className="text-[11px] text-text-tertiary mt-0.5">
                          {sub.stage || '—'} · {sub.sector || '—'} · {fmtRelative(sub.created_at)}
                        </p>
                      </div>
                      {isProcessing && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-warning-bg text-warning-text shrink-0">Processing</span>
                      )}
                    </div>

                    {/* Score + meta row */}
                    <div className="flex items-end justify-between mt-3 pt-3 border-t border-border-muted">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Deck score</div>
                        {score !== null ? (
                          <div className="text-xl font-semibold text-text-primary mt-0.5 tabular-nums">
                            {score}<span className="text-xs text-text-tertiary font-normal">/100</span>
                          </div>
                        ) : (
                          <div className="text-xs text-text-tertiary mt-1.5">Awaiting analysis</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Top match</div>
                        <div className="text-xs font-medium text-text-primary mt-0.5">
                          {sub.top_match_score ? `${sub.top_match_score}/100` : '—'}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Always show a primary CTA below the cards */}
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-4 py-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              New deck analysis
            </Link>
          </div>
        )}
      </HubBlock>

      {/* ───────────────────────────────────────────────────────
          BLOCK 2: PREPARE — Mock pitch (Last pitch + Last Q&A)
          ─────────────────────────────────────────────────────── */}
      <HubBlock
        kicker="Prepare · Mock pitch"
        kickerIcon={<Mic className="w-3.5 h-3.5" strokeWidth={1.75} />}
        title="Practice for the meeting"
        cta={{ label: 'Open Mock Pitch', href: '/mock-pitch' }}
      >
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Last full pitch */}
          <SessionCard
            label="Last pitch"
            session={latestPitch}
            emptyTitle="No pitch run yet"
            emptyBody="Practice your full deck out loud. AI scores delivery, pace, and gaps."
            ctaStart="Run a pitch"
            ctaContinue="Practice again"
            href="/mock-pitch"
          />

          {/* Last Q&A drill */}
          <SessionCard
            label="Last Q&A"
            session={latestQa}
            emptyTitle="No Q&A drill yet"
            emptyBody="The hard questions investors actually ask. Drill the answers before the meeting."
            ctaStart="Start a Q&A"
            ctaContinue="Drill again"
            href="/mock-pitch"
          />

        </div>
      </HubBlock>

      {isAdmin && (
        <HubBlock
          kicker="Prepare · Meet"
          kickerIcon={<Users className="w-3.5 h-3.5" strokeWidth={1.75} />}
          title="Mentors you might meet"
          cta={{ label: 'Browse all mentors', href: '/meet' }}
        >
          {suggestedExperts.length === 0 ? (
            <div className="bg-surface-card border border-border rounded-xl p-6 text-center">
              <p className="text-sm text-text-tertiary">No mentors available yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggestedExperts.slice(0, 3).map(exp => (
                <Link
                  key={exp.id}
                  href={`/meet/${exp.id}`}
                  className="group block bg-surface-card border border-border rounded-xl p-4 hover:border-brand/30 hover:shadow-subtle transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center text-sm font-semibold shrink-0">
                      {(exp.display_name || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-text-primary truncate group-hover:text-brand transition-colors">
                        {exp.display_name || 'Unnamed expert'}
                      </div>
                      <div className="text-[11px] text-text-tertiary truncate">
                        {[exp.title, exp.fund_or_firm].filter(Boolean).join(' · ') || 'Expert'}
                      </div>
                    </div>
                  </div>
                  {exp.expertise_areas && exp.expertise_areas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border-muted">
                      {exp.expertise_areas.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-muted text-text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </HubBlock>
      )}

      {/* ───────────────────────────────────────────────────────
          BLOCK 4: EXECUTE — meetings + CRM action items
          ─────────────────────────────────────────────────────── */}
      <HubBlock
        kicker="Execute"
        kickerIcon={<Briefcase className="w-3.5 h-3.5" strokeWidth={1.75} />}
        title="What's next this week"
        cta={{ label: 'Open CRM', href: '/crm' }}
      >
        <div className={isAdmin ? 'grid lg:grid-cols-2 gap-4' : 'grid gap-4'}>

          {/* Upcoming meetings */}
          {isAdmin && (
            <div className="bg-surface-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-brand-soft text-brand flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Upcoming meetings</div>
              </div>

              {upcomingMeetings.length === 0 ? (
                <>
                  <p className="text-sm text-text-tertiary leading-relaxed mb-3">
                    No meetings on your calendar. When experts confirm your meeting requests, they appear here.
                  </p>
                  <Link
                    href="/meet"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
                  >
                    Browse mentors
                    <ArrowRight className="w-3 h-3" strokeWidth={2} />
                  </Link>
                </>
              ) : (
                <>
                  <div className="space-y-2 mb-3">
                    {upcomingMeetings.map(m => (
                      <div key={m.id} className="flex items-start gap-2.5 py-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-tertiary mt-0.5 shrink-0" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-text-primary">
                            {m.confirmed_slot ? fmtMeetingDate(m.confirmed_slot) : 'TBD'}
                          </div>
                          <div className="text-[11px] text-text-tertiary truncate">{m.meeting_goal || 'Mentor meeting'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/dashboard/meetings"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
                  >
                    View all meetings
                    <ArrowRight className="w-3 h-3" strokeWidth={2} />
                  </Link>
                </>
              )}
            </div>
          )}

          {/* CRM action items */}
          <div className="bg-surface-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-brand-soft text-brand flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">CRM action items</div>
              </div>
              {overdueCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger-bg text-danger-text">
                  {overdueCount} overdue
                </span>
              )}
            </div>

            {crmActions.length === 0 ? (
              <>
                <p className="text-sm text-text-secondary leading-relaxed mb-3">
                  No action items set yet. When you add a <strong>next action</strong> to a CRM contact, it appears here as a reminder.
                </p>
                <Link
                  href="/crm"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
                >
                  Open CRM
                  <ArrowRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              </>
            ) : (
              <>
                {overdueCount === 0 && (
                  <p className="text-[11px] text-text-tertiary mb-2 leading-relaxed">
                    Don't forget — completing your action items keeps every investor relationship moving.
                  </p>
                )}
                <div className="space-y-2 mb-3">
                  {crmActions.slice(0, 4).map(c => {
                    const action = fmtActionDate(c.next_action_date)
                    return (
                      <Link
                        key={c.id}
                        href="/crm"
                        className="group flex items-start gap-2.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-surface-muted transition-colors"
                      >
                        <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${action.overdue ? 'text-danger-text' : 'text-brand'}`} strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-text-primary truncate group-hover:text-brand transition-colors">
                              {c.name || 'Unnamed contact'}
                            </span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                              action.overdue ? 'bg-danger-bg text-danger-text' :
                              action.soon    ? 'bg-warning-bg text-warning-text' :
                                               'bg-surface-muted text-text-tertiary'
                            }`}>
                              {action.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-secondary truncate mt-0.5">
                            {c.next_action} {c.company ? `· ${c.company}` : ''}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                <Link
                  href="/crm"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
                >
                  See all in CRM
                  <ArrowRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              </>
            )}
          </div>
        </div>
      </HubBlock>

      {/* ───────────────────────────────────────────────────────
          BLOCK 5: TOOLS — Calculator scenarios (3 cards: Equity / Debt / Convertible)
          ─────────────────────────────────────────────────────── */}
      <HubBlock
        kicker="Tools"
        kickerIcon={<Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />}
        title="Your latest calculator scenarios"
        cta={{ label: 'Open Calculator', href: '/tools/calculator' }}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CalculatorCard
            label="Equity"
            description="Priced round dilution"
            scenario={latestEquityScenario}
            href="/tools/calculator?tab=equity"
            emptyCta="Run your first equity scenario"
            renderInputs={(inp) => [
              { label: 'Pre-money',  value: inp.preMoney    ? `$${(inp.preMoney/1e6).toFixed(1)}M` : '—' },
              { label: 'Raise',      value: inp.raiseAmount ? `$${(inp.raiseAmount/1e6).toFixed(1)}M` : '—' },
              { label: 'Founder %',  value: inp.founderPct  != null ? `${inp.founderPct}%` : '—' },
            ]}
          />
          <CalculatorCard
            label="Debt"
            description="Loan amortization"
            scenario={latestDebtScenario}
            href="/tools/calculator?tab=debt"
            emptyCta="Run your first debt scenario"
            renderInputs={(inp) => [
              { label: 'Principal',  value: inp.principal     ? `$${(inp.principal/1e3).toFixed(0)}K` : '—' },
              { label: 'Rate',       value: inp.annualRatePct != null ? `${inp.annualRatePct}%` : '—' },
              { label: 'Term',       value: inp.termMonths    ? `${inp.termMonths}mo` : '—' },
            ]}
          />
          <CalculatorCard
            label="SAFE / Note"
            description="Convertible instruments"
            scenario={latestConvertibleScenario}
            href="/tools/calculator?tab=convertible"
            emptyCta="Run your first SAFE scenario"
            renderInputs={(inp) => [
              { label: 'Investment', value: inp.investment    ? `$${(inp.investment/1e3).toFixed(0)}K` : '—' },
              { label: 'Cap',        value: inp.valuationCap  ? `$${(inp.valuationCap/1e6).toFixed(1)}M` : '—' },
              { label: 'Discount',   value: inp.discountPct   != null ? `${inp.discountPct}%` : '—' },
            ]}
          />
        </div>
      </HubBlock>

      {/* ───────────────────────────────────────────────────────
          BLOCK 6: LEARN — Editor's take (left) + news this week (right)
          ─────────────────────────────────────────────────────── */}
      <HubBlock
        kicker="Learn"
        kickerIcon={<Newspaper className="w-3.5 h-3.5" strokeWidth={1.75} />}
        title={`This week in SEA fundraising`}
        subtitle={weekRange}
        cta={{ label: 'Read all this week', href: '/news' }}
      >
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4 items-stretch">

          {/* Editor's take — LEFT */}
          {editorsTake?.headline ? (
            <div className="bg-brand text-text-inverse rounded-xl p-5 flex flex-col h-full">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                Editor's take
              </div>
              <h4 className="text-base font-semibold leading-snug">{editorsTake.headline}</h4>
              {editorsTake.takeaway && (
                <p className="text-xs text-white/80 mt-3 leading-relaxed flex-1">{editorsTake.takeaway}</p>
              )}
              <Link
                href="/news"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white mt-4 hover:underline self-start"
              >
                Read full take
                <ArrowRight className="w-3 h-3" strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <div className="bg-surface-card border border-border rounded-xl p-5 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={1.75} />
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Editor's take</div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Editor's take publishes weekly. The latest hot take and what it means for SEA founders, in 60 seconds.
              </p>
            </div>
          )}

          {/* News items — RIGHT */}
          <div className="bg-surface-card border border-border rounded-xl p-5 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-brand" strokeWidth={1.75} />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Top stories</div>
            </div>

            {newsItems.length === 0 ? (
              <p className="text-sm text-text-tertiary">No news for this week yet. Check back Monday — that's when the digest drops.</p>
            ) : (
              <div className="space-y-3 flex-1">
                {newsItems.map(item => (
                  <Link
                    key={item.id}
                    href="/news"
                    className="block group"
                  >
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      {item.category && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-soft text-brand shrink-0">
                          {item.category}
                        </span>
                      )}
                      {item.amount_usd && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-success-bg text-success-text">
                          {fmtUSD(item.amount_usd)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-text-primary leading-snug group-hover:text-brand transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-text-tertiary mt-1">
                      {item.source_name || 'Source'} · {fmtRelative(item.published_at)}
                      {item.country ? ` · ${item.country}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </HubBlock>

    </DashboardShell>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function HubBlock({ kicker, kickerIcon, title, subtitle, cta, children }: {
  kicker:      string
  kickerIcon:  React.ReactNode
  title:       string
  subtitle?:   string
  cta?:        { label: string; href: string }
  children:    React.ReactNode
}) {
  return (
    <section className="mb-10">
      {/* Block header */}
      <div className="flex items-end justify-between mb-4 gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand mb-1.5">
            {kickerIcon}
            {kicker}
          </div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
        {cta && (
          <Link
            href={cta.href}
            className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 shrink-0"
          >
            {cta.label}
            <ArrowRight className="w-3 h-3" strokeWidth={2} />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ title, body, cta }: {
  title: string
  body:  string
  cta:   { label: string; href: string }
}) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-8 text-center">
      <h3 className="text-sm font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">{body}</p>
      <Link
        href={cta.href}
        className="inline-flex items-center gap-2 text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-4 py-2 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        {cta.label}
      </Link>
    </div>
  )
}

function SessionCard({ label, session, emptyTitle, emptyBody, ctaStart, ctaContinue, href }: {
  label:        string
  session:      MockPitchSessionRow | null
  emptyTitle:   string
  emptyBody:    string
  ctaStart:     string
  ctaContinue:  string
  href:         string
}) {
  const score = session?.debrief?.overall_score ?? null
  const debriefHref = session ? `/mock-pitch/${session.id}/debrief` : href

  return (
    <div className="bg-surface-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-md bg-brand-soft text-brand flex items-center justify-center">
          <Target className="w-3.5 h-3.5" strokeWidth={1.75} />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
      </div>

      {session ? (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <div className="text-3xl font-semibold text-text-primary tabular-nums">
              {score ?? '—'}<span className="text-base text-text-tertiary font-normal">/100</span>
            </div>
          </div>
          <div className="text-[11px] text-text-tertiary mb-3">
            {fmtRelative(session.started_at)}{session.duration_min ? ` · ${session.duration_min}min` : ''}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={debriefHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
            >
              View debrief
              <ArrowRight className="w-3 h-3" strokeWidth={2} />
            </Link>
            <Link
              href={href}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              {ctaContinue}
            </Link>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-text-primary mb-1.5">{emptyTitle}</h3>
          <p className="text-[12px] text-text-secondary leading-relaxed mb-3">{emptyBody}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-sm font-medium bg-brand hover:bg-brand-hover text-text-inverse rounded-md px-3.5 py-1.5 transition-colors"
          >
            {ctaStart}
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </>
      )}
    </div>
  )
}

function CalculatorCard({ label, description, scenario, href, emptyCta, renderInputs }: {
  label:        string
  description:  string
  scenario:     SavedScenarioRow | null
  href:         string
  emptyCta:     string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderInputs: (inputs: any) => { label: string; value: string }[]
}) {
  if (!scenario) {
    return (
      <Link
        href={href}
        className="group block bg-surface-card border border-border border-dashed rounded-xl p-4 hover:border-brand hover:bg-brand-soft/30 transition-all"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-surface-muted text-text-tertiary flex items-center justify-center group-hover:bg-brand-soft group-hover:text-brand transition-colors">
            <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
        </div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">No {label.toLowerCase()} scenarios yet</h3>
        <p className="text-[11px] text-text-tertiary leading-relaxed mb-3">{description}</p>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand group-hover:text-brand-hover transition-colors">
          {emptyCta}
          <ArrowRight className="w-3 h-3" strokeWidth={2} />
        </div>
      </Link>
    )
  }

  const inputs = renderInputs(scenario.inputs)
  const date = new Date(scenario.created_at)
  const relTime = (() => {
    const diff = Date.now() - date.getTime()
    const day = 86400 * 1000
    if (diff < day)        return 'Today'
    if (diff < 2 * day)    return 'Yesterday'
    if (diff < 7 * day)    return `${Math.floor(diff / day)}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  return (
    <Link
      href={href}
      className="group block bg-surface-card border border-border rounded-xl p-4 hover:border-brand/30 hover:shadow-subtle transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md bg-brand-soft text-brand flex items-center justify-center">
          <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
      </div>
      <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-brand transition-colors mb-1">
        {scenario.name}
      </h3>
      <div className="text-[10px] text-text-tertiary mb-3">{relTime}</div>

      <dl className="space-y-1 pt-3 border-t border-border-muted">
        {inputs.map((kv, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <dt className="text-text-tertiary">{kv.label}</dt>
            <dd className="font-medium text-text-primary tabular-nums">{kv.value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}
