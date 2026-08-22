import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import TopBar from '@/components/TopBar'
import DashboardShell from '@/components/DashboardShell'
import MatchView from './MatchView'

export const dynamic = 'force-dynamic'

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: slug } = await params
  const user = await getSessionUser()

  // Load the report server-side. Anonymous clients no longer receive direct
  // table access; this component enforces slug visibility before serializing
  // the explicitly selected report fields to the browser.
  const { data: row } = await supabaseAdmin
    .from('submissions')
    .select(`
      user_id, is_public,
      company_name, country, stage, raise_target_usd, sector, business_model,
      annual_revenue_usd, current_mrr_usd, match_results, warm_intros,
      deck_analysis, market_analysis, competitive_analysis, sector_profile
    `)
    .eq('unique_slug', slug)
    .maybeSingle()

  if (!row) notFound()

  const isOwner = !!(user && row.user_id === user.id)
  const admin   = user ? await isSuperAdmin(user) : false

  // Privacy: if not public, only owner + super admin can view
  if (row.is_public !== true && !isOwner && !admin) {
    notFound()
  }

  const { user_id: _userId, is_public: _isPublic, ...report } = row

  // ── Signed-in viewer: wrap in the full DashboardShell so they have
  //    nav back to the rest of the app. Fixes the "deck analysis has
  //    no nav" complaint.
  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data: profile } = await supabase
      .from('user_profiles').select('full_name, company_name').eq('id', user.id).maybeSingle()
    const isExpert = await isApprovedExpert(user.id)
    return (
      <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="dashboard">
        <MatchView initialSubmission={report} isOwner={isOwner} canUseExpertFeatures={admin} />
      </DashboardShell>
    )
  }

  // ── Anonymous viewer (public-shared link): minimal top bar only.
  return (
    <>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <MatchView initialSubmission={report} isOwner={isOwner} canUseExpertFeatures={false} />
      </div>
    </>
  )
}
