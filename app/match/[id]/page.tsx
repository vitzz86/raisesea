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

  // Load minimal row to check ownership + privacy
  const { data: row } = await supabaseAdmin
    .from('submissions')
    .select('user_id, is_public')
    .eq('unique_slug', slug)
    .maybeSingle()

  if (!row) notFound()

  const isOwner = !!(user && row.user_id === user.id)
  const admin   = user ? await isSuperAdmin(user) : false

  // Privacy: if not public, only owner + super admin can view
  if (row.is_public === false && !isOwner && !admin) {
    notFound()
  }

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
        <MatchView isOwner={isOwner} />
      </DashboardShell>
    )
  }

  // ── Anonymous viewer (public-shared link): minimal top bar only.
  return (
    <>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <MatchView isOwner={isOwner} />
      </div>
    </>
  )
}
