import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import NewsHistory from './NewsHistory'

export const dynamic = 'force-dynamic'

export default async function NewsHistoryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/news/history')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  // Load 4 weeks (28 days) of approved items
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400 * 1000).toISOString()
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('id, category, title, company_name, amount_usd, stage, sector, country, lead_investor, source_url, source_name, ai_summary, ai_why_it_matters, published_at, region_scope')
    .eq('status', 'approved')
    .gte('published_at', fourWeeksAgo)
    .order('published_at', { ascending: false })
    .limit(500)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="news">
      <NewsHistory items={items || []} />
    </DashboardShell>
  )
}
