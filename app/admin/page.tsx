import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import DashboardShell from '@/components/DashboardShell'
import { isApprovedExpert } from '@/lib/expert-status'
import AdminTabs from './AdminTabs'

export const dynamic = 'force-dynamic'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/admin')
  const admin = await isSuperAdmin(user)
  if (!admin) redirect('/dashboard')

  const params = await searchParams
  const tab = (params.tab as 'overview' | 'submissions' | 'users' | 'admins' | 'experts' | 'feedback') || 'overview'

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  // Load tab-specific data server-side
  const tabData: Record<string, unknown> = {}

  if (tab === 'overview') {
    const { data: stats } = await supabaseAdmin.rpc('get_platform_stats')
    tabData.stats = stats || {}
  } else if (tab === 'submissions') {
    const { data } = await supabaseAdmin
      .from('submissions')
      .select('id, unique_slug, company_name, country, stage, sector, raise_target_usd, founder_email, analysis_status, top_match_score, created_at, is_public, user_id')
      .order('created_at', { ascending: false })
      .limit(100)
    tabData.submissions = data || []
  } else if (tab === 'users') {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, company_name, country, role, plan, submissions_count, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    tabData.users = data || []
  } else if (tab === 'admins') {
    const { data } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, user_id, notes, created_at')
      .order('created_at', { ascending: false })
    tabData.admins = data || []
  } else if (tab === 'experts') {
    const { data: vcRows } = await supabaseAdmin
      .from('vc_profiles')
      .select('id, user_id, display_name, fund_or_firm, title, bio, what_i_offer, linkedin_url, company_linkedin_url, company_website, website, avatar_url, profile_types, expertise_areas, hq_country, application_status, application_notes, created_at, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(200)
    // Fetch corresponding auth emails (one-shot listUsers — we only have up to 200 records)
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = new Map<string, string>()
    authData?.users.forEach(u => { if (u.email) emailMap.set(u.id, u.email) })
    tabData.experts = (vcRows || []).map(r => ({ ...r, email: emailMap.get(r.user_id) || null }))
  } else if (tab === 'feedback') {
    // Beta feedback — list all + compute per-task averages
    const { data: fb } = await supabaseAdmin
      .from('user_feedback')
      .select('id, user_id, task_key, rating, message, page_url, user_agent, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500)
    // Join user emails
    const userIds = Array.from(new Set((fb || []).map(f => f.user_id as string)))
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = new Map<string, string>()
    authData?.users.forEach(u => { if (u.email && userIds.includes(u.id)) emailMap.set(u.id, u.email) })
    tabData.feedback = (fb || []).map(f => ({ ...f, user_email: emailMap.get(f.user_id as string) || '(unknown)' }))
  }

  return (
    <DashboardShell user={user} profile={profile} isAdmin={true} isApprovedExpert={await isApprovedExpert(user.id)} activePath="admin">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Super admin panel</h1>
        <p className="text-sm text-text-tertiary mt-1">Platform-wide management. Visible only to super admins.</p>
      </div>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-hide">
        {(['overview', 'submissions', 'feedback', 'experts', 'users', 'admins'] as const).map(t => (
          <Link
            key={t}
            href={`/admin?tab=${t}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              tab === t
                ? 'border-brand text-brand'
                : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-strong'
            }`}
          >
            {t === 'experts' ? 'Experts' : t === 'feedback' ? 'Feedback' : t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>

      <AdminTabs tab={tab} data={tabData} />
    </DashboardShell>
  )
}
