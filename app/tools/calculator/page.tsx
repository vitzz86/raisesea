// ═══════════════════════════════════════════════════════════════
// app/tools/calculator/page.tsx
//
// Unified calculator entry. Loads saved Convertible scenarios +
// user's most recent submission stage so the DilutionInsight can
// benchmark against THEIR stage instead of a generic guess.
// ═══════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import Calculator from './Calculator'
import { normalizeStageString } from '@/components/calculator/DilutionInsight'

export const dynamic = 'force-dynamic'

export default async function CalculatorPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/tools/calculator')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const [admin, isExpert] = await Promise.all([
    isSuperAdmin(user),
    isApprovedExpert(user.id),
  ])

  // Parallel fetch: saved Convertible scenarios + latest submission stage
  const [{ data: saved }, { data: latestSub }] = await Promise.all([
    supabaseAdmin
      .from('safe_scenarios')
      .select('id, name, instrument, inputs, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('submissions')
      .select('stage')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const userStage = normalizeStageString(latestSub?.stage)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="calculator">
      <Calculator initialSaved={saved || []} userStage={userStage} />
    </DashboardShell>
  )
}
