import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import { FREE_DECK_ANALYSIS_MONTHLY_LIMIT, currentUsageWindow, getDeckAnalysisUsage } from '@/lib/usage-limits'
import DashboardShell from '@/components/DashboardShell'
import ApplyForm from './ApplyForm'

export const dynamic = 'force-dynamic'

export default async function ApplyPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/apply')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name, country')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)
  const usageWindow = currentUsageWindow()
  const deckUsage = admin ? 0 : await getDeckAnalysisUsage(user.id, usageWindow)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="apply">
      <ApplyForm
        prefill={{
          founder_email: user.email || '',
          founder_name:  profile?.full_name    || '',
          company_name:  profile?.company_name || '',
          country:       profile?.country      || '',
        }}
        usage={{
          isLimited: !admin,
          used: deckUsage,
          limit: FREE_DECK_ANALYSIS_MONTHLY_LIMIT,
          resetLabel: usageWindow.resetLabel,
        }}
      />
    </DashboardShell>
  )
}
