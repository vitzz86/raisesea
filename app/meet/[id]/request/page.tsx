import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import RequestMeetingForm from './RequestMeetingForm'

export const dynamic = 'force-dynamic'

export default async function RequestMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  const { id: vcProfileId } = await params

  if (!user) redirect(`/login?redirectTo=/meet/${vcProfileId}/request`)

  const { data: vc } = await supabaseAdmin
    .from('vc_profiles')
    .select('id, display_name, fund_or_firm, title, avatar_url, application_status, is_listed, calendar_connected')
    .eq('id', vcProfileId)
    .maybeSingle()

  if (!vc || vc.application_status !== 'active' || !vc.is_listed) notFound()

  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select('id, company_name, unique_slug, deck_url, created_at, stage, raise_target_usd')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const supabase = await createSupabaseServerClient()
  const { data: founderProfile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  return (
    <DashboardShell user={user} profile={founderProfile} isAdmin={admin} isApprovedExpert={isExpert} activePath="experts">
      <div className="max-w-5xl">
        <RequestMeetingForm
          vc={{
            id:                 vc.id,
            display_name:       vc.display_name,
            fund_or_firm:       vc.fund_or_firm,
            title:              vc.title,
            avatar_url:         vc.avatar_url,
            calendar_connected: !!vc.calendar_connected,
          }}
          founder={{
            id:        user.id,
            email:     user.email || '',
            full_name: founderProfile?.full_name || '',
          }}
          submissions={(submissions || []).map(s => ({
            id:               s.id,
            company_name:     s.company_name,
            unique_slug:      s.unique_slug,
            deck_url:         s.deck_url,
            stage:            s.stage,
            raise_target_usd: s.raise_target_usd,
          }))}
        />
      </div>
    </DashboardShell>
  )
}
