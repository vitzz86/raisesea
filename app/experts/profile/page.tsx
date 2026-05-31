import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import EditProfileForm from './EditProfileForm'

export const dynamic = 'force-dynamic'

export default async function ExpertsProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/experts/profile')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch full vc_profile (must exist and be approved to use this page)
  const { data: vcProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  // No application yet → redirect to apply
  if (!vcProfile) {
    return (
      <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-profile">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Expert profile</h1>
          <div className="bg-white border border-border rounded-xl p-6">
            <p className="text-sm text-text-secondary mb-4">You haven&apos;t applied to the expert network yet.</p>
            <Link href="/experts/apply" className="inline-block text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-md px-4 py-2 transition">
              Apply now →
            </Link>
          </div>
        </div>
      </DashboardShell>
    )
  }

  // Pending or rejected → show status, no edit form (resubmit goes through /experts/apply)
  if (vcProfile.application_status !== 'active') {
    return (
      <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-profile">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Expert profile</h1>
          <div className={`border rounded-xl p-6 ${
            vcProfile.application_status === 'pending'
              ? 'bg-warning-bg border-warning-border'
              : 'bg-danger-bg border-danger-border'
          }`}>
            <p className="text-sm font-medium mb-2">
              {vcProfile.application_status === 'pending'
                ? 'Your application is still pending review.'
                : 'Your application was not approved.'}
            </p>
            <p className="text-xs">
              <Link href="/experts/apply" className="underline">See details →</Link>
            </p>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-profile">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Edit your expert profile</h1>
        <p className="text-sm text-text-tertiary mt-1 max-w-2xl">
          Changes go live immediately in <Link href="/meet" className="text-brand underline">the directory</Link>.
        </p>
      </div>
      <EditProfileForm initialProfile={vcProfile} />
    </DashboardShell>
  )
}
