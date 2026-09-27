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

  // Load the FULL row server-side. This is now the single read path for the
  // report: the client component no longer queries the database, so
  // `submissions` no longer needs any anonymous read access (see
  // supabase/migrations/v26_submissions_anon_lockdown.sql).
  const { data: row } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .eq('unique_slug', slug)
    .maybeSingle()

  if (!row) notFound()

  const isOwner = !!(user && row.user_id === user.id)
  const admin   = user ? await isSuperAdmin(user) : false

  // Privacy: fail CLOSED. Anything not explicitly public is visible only to its
  // owner and to super admins.
  // This previously read `row.is_public === false`, so a NULL is_public fell
  // through and was treated as PUBLIC here — while the admin table renders a
  // NULL is_public as "private". The two surfaces disagreed; this makes the
  // page match the label.
  if (!row.is_public && !isOwner && !admin) {
    notFound()
  }

  // Strip founder PII before the row crosses to the client. The report UI never
  // renders these; admin and /meet/preview read them through their own
  // service-role queries, where authorization has already been established.
  const submission = { ...(row as Record<string, unknown>) }
  delete submission.founder_email

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
        <MatchView submission={submission} isOwner={isOwner} canUseExpertFeatures={admin} />
      </DashboardShell>
    )
  }

  // ── Anonymous viewer (public-shared link): minimal top bar only.
  return (
    <>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <MatchView submission={submission} isOwner={isOwner} canUseExpertFeatures={false} />
      </div>
    </>
  )
}
