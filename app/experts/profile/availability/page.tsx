import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import AvailabilityForm from './AvailabilityForm'

export const dynamic = 'force-dynamic'

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/experts/profile/availability')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: vcProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('id, application_status, calendar_connected')
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  if (!vcProfile) {
    return (
      <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-availability">
        <h1 className="text-2xl font-semibold mb-3">Availability</h1>
        <div className="bg-white border border-border rounded-xl p-6">
          <p className="text-sm text-text-secondary mb-3">Apply to the expert network first.</p>
          <Link href="/experts/apply" className="text-sm font-medium text-brand underline">Apply →</Link>
        </div>
      </DashboardShell>
    )
  }

  if (vcProfile.application_status !== 'active') {
    return (
      <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-availability">
        <h1 className="text-2xl font-semibold mb-3">Availability</h1>
        <div className="bg-warning-bg border border-warning-border rounded-xl p-6">
          <p className="text-sm text-warning-text">
            Available to approved experts only. <Link href="/experts/apply" className="underline">View application status →</Link>
          </p>
        </div>
      </DashboardShell>
    )
  }

  // Load existing availability windows
  const { data: windows } = await supabaseAdmin
    .from('vc_availability')
    .select('id, day_of_week, start_time, end_time, timezone, is_active')
    .eq('vc_profile_id', vcProfile.id)
    .order('day_of_week')
    .order('start_time')

  const params = await searchParams

  return (
    <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-availability">
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">Availability &amp; Calendar</h1>
          <Link href="/experts/profile" className="text-xs text-text-tertiary underline">← Back to profile</Link>
        </div>
        <p className="text-sm text-text-tertiary mt-1 max-w-2xl">
          Connect your Google Calendar and declare your weekly hours. Founders will see only free slots that fall inside your hours.
        </p>
      </div>

      {params.connected && (
        <div className="mb-5 bg-success-bg border border-success-border rounded-xl p-3 text-sm text-success-text">
          ✓ Calendar connected
        </div>
      )}
      {params.error && (
        <div className="mb-5 bg-danger-bg border border-danger-border rounded-xl p-3 text-sm text-danger-text">
          {params.error}
        </div>
      )}

      <AvailabilityForm
        vcProfileId={vcProfile.id}
        calendarConnected={!!vcProfile.calendar_connected}
        initialWindows={(windows || []).map(w => ({
          id:           w.id,
          day_of_week:  w.day_of_week,
          start_time:   w.start_time,
          end_time:     w.end_time,
          timezone:     w.timezone,
          is_active:    w.is_active,
        }))}
      />
    </DashboardShell>
  )
}
