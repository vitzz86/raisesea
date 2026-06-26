import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import { FREE_MOCK_PITCH_MONTHLY_LIMIT, currentUsageWindow, getMockPitchUsage } from '@/lib/usage-limits'
import DashboardShell from '@/components/DashboardShell'
import MockPitchHome from './MockPitchHome'

export const dynamic = 'force-dynamic'

export default async function MockPitchPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/mock-pitch')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)

  // Load the user's submissions that have a deck_analysis available (needed for Q&A context)
  const { data: subs } = await supabaseAdmin
    .from('submissions')
    .select('id, unique_slug, company_name, stage, sector, analysis_status, deck_analysis, created_at')
    .eq('user_id', user.id)
    .not('deck_analysis', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // Past sessions
  const { data: sessions } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .select('id, submission_id, mode, duration_min, status, started_at, completed_at, debrief')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(50)

  // Lookup company names for sessions
  const subById = Object.fromEntries((subs || []).map(s => [s.id as string, s]))

  const isExpert = await isApprovedExpert(user.id)
  const usageWindow = currentUsageWindow()
  const mockPitchUsage = admin ? 0 : await getMockPitchUsage(user.id, usageWindow)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="mock-pitch">
      <MockPitchHome
        submissions={(subs || []) as { id: string; unique_slug: string; company_name: string; stage: string | null; sector: string | null; created_at: string }[]}
        sessions={(sessions || []).map(s => ({
          ...s,
          submission: s.submission_id ? subById[s.submission_id as string] || null : null,
        }))}
        usage={{
          isLimited: !admin,
          used: mockPitchUsage,
          limit: FREE_MOCK_PITCH_MONTHLY_LIMIT,
          resetLabel: usageWindow.resetLabel,
        }}
      />
    </DashboardShell>
  )
}
