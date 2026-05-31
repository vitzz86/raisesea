import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import VcMeetingsView from './VcMeetingsView'

export const dynamic = 'force-dynamic'

export default async function VcMeetingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/experts/meetings')

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

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  if (!vcProfile || vcProfile.application_status !== 'active') {
    return (
      <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="expert-meetings">
        <h1 className="text-2xl font-semibold mb-3">Expert meetings</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-sm text-amber-900">
            Available to approved experts only. <Link href="/experts/apply" className="underline">View application →</Link>
          </p>
        </div>
      </DashboardShell>
    )
  }

  const { data: requests } = await supabaseAdmin
    .from('meeting_requests')
    .select(`
      id, status, meeting_goal, meeting_notes, key_questions,
      preferred_slot_1, preferred_slot_2, preferred_slot_3,
      confirmed_slot, google_meet_link, soft_hold_expires_at,
      created_at, vc_responded_at, founder_user_id, submission_id
    `)
    .eq('vc_profile_id', vcProfile.id)
    .order('created_at', { ascending: false })

  // Fetch founders + submissions
  const founderIds = [...new Set((requests || []).map(r => r.founder_user_id))]
  const subIds     = [...new Set((requests || []).map(r => r.submission_id))]

  const [{ data: authData }, { data: founders }, { data: subs }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    founderIds.length > 0
      ? supabaseAdmin.from('user_profiles').select('id, full_name, company_name').in('id', founderIds)
      : Promise.resolve({ data: [] }),
    subIds.length > 0
      ? supabaseAdmin.from('submissions').select('id, company_name, unique_slug, stage, sector, raise_target_usd').in('id', subIds)
      : Promise.resolve({ data: [] }),
  ])

  const emailMap   = new Map<string, string>()
  authData?.users.forEach(u => { if (u.email) emailMap.set(u.id, u.email) })

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="expert-meetings">
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Incoming meeting requests</h1>
          <Link href="/experts/profile/availability" className="text-xs text-gray-600 underline">Manage availability →</Link>
        </div>
        <p className="text-sm text-gray-600 mt-1">Review each request and either accept a slot or decline.</p>
        {!vcProfile.calendar_connected && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
            ⚠ Google Calendar not connected — you can&apos;t accept meetings until you connect.
            <Link href="/experts/profile/availability" className="ml-2 underline">Connect now →</Link>
          </div>
        )}
      </div>

      <VcMeetingsView
        requests={(requests || []).map(r => ({
          id:                 r.id,
          status:             r.status,
          meeting_goal:       r.meeting_goal,
          meeting_notes:      r.meeting_notes,
          key_questions:      (r.key_questions || []) as string[],
          preferred_slots:    [r.preferred_slot_1, r.preferred_slot_2, r.preferred_slot_3].filter(Boolean) as string[],
          confirmed_slot:     r.confirmed_slot,
          google_meet_link:   r.google_meet_link,
          soft_hold_expires_at: r.soft_hold_expires_at,
          created_at:         r.created_at,
          founder_name:       (founders || []).find(f => f.id === r.founder_user_id)?.full_name || null,
          founder_email:      emailMap.get(r.founder_user_id) || null,
          submission:         (subs || []).find(s => s.id === r.submission_id) || null,
        }))}
      />
    </DashboardShell>
  )
}
