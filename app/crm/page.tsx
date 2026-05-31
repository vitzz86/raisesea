import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import CrmBoard from './CrmBoard'
import type { Contact } from '@/lib/crm'

export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/crm')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name, crm_custom_types')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  const { data: contacts } = await supabaseAdmin
    .from('crm_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(500)

  const customTypes = (profile?.crm_custom_types as { investor: string[]; general: string[] } | null) || { investor: [], general: [] }

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="crm">
      <CrmBoard initialContacts={(contacts || []) as Contact[]} initialCustomTypes={customTypes} />
    </DashboardShell>
  )
}
