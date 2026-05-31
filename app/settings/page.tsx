import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import SettingsForm from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/settings')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name, country, role, plan, news_sectors, email_digest_enabled, email, created_at')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="settings">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Update your profile and preferences.
        </p>
      </div>

      <SettingsForm
        initialProfile={{
          full_name:     profile?.full_name     || '',
          company_name:  profile?.company_name  || '',
          country:       profile?.country       || '',
          news_sectors:  profile?.news_sectors  || [],
          email_digest_enabled: profile?.email_digest_enabled !== false,
        }}
        accountInfo={{
          email:      user.email || '',
          role:       profile?.role || 'founder',
          plan:       profile?.plan || 'free',
          memberSince: profile?.created_at || '',
        }}
      />
    </DashboardShell>
  )
}
