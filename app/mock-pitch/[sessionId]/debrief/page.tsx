import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import DebriefView from './DebriefView'
import type { Debrief } from '@/lib/mock-pitch'

export const dynamic = 'force-dynamic'

export default async function DebriefPage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ generating?: string }>
}) {
  const { sessionId } = await params
  const { generating } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect(`/login?redirectTo=/mock-pitch/${sessionId}/debrief`)

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, company_name').eq('id', user.id).maybeSingle()

  const { data: session } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .select('id, submission_id, mode, duration_min, debrief, transcript, questions, started_at, completed_at, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!session) notFound()

  let companyName = ''
  let slug = ''
  if (session.submission_id) {
    const { data: sub } = await supabaseAdmin
      .from('submissions').select('company_name, unique_slug').eq('id', session.submission_id).maybeSingle()
    companyName = sub?.company_name || ''
    slug = sub?.unique_slug || ''
  }

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="mock-pitch">
      <DebriefView
        sessionId={sessionId}
        mode={session.mode as 'pitch' | 'qa'}
        durationMin={session.duration_min}
        company={companyName}
        companySlug={slug}
        debrief={session.debrief as Debrief | null}
        startedAt={session.started_at as string}
        isGenerating={generating === '1' && !session.debrief}
        status={session.status as string}
        canUseExpertFeatures={admin}
      />
    </DashboardShell>
  )
}
