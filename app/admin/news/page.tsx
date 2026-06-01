import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import DashboardShell from '@/components/DashboardShell'
import { isApprovedExpert } from '@/lib/expert-status'
import AdminNewsTabs from './AdminNewsTabs'

export const dynamic = 'force-dynamic'

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/admin/news')
  if (!(await isSuperAdmin(user))) redirect('/dashboard')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  // Pending + approved items (last 14 days)
  const since = new Date(Date.now() - 14 * 86400 * 1000).toISOString()
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('id, category, title, company_name, amount_usd, stage, sector, country, lead_investor, source_url, source_name, ai_summary, ai_why_it_matters, status, published_at, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  // This week's editor's takes
  const { data: takes } = await supabaseAdmin
    .from('editors_takes')
    .select('id, week_starting, content, headline, takeaway, top_stories, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // Subscriber list (recipients) — all profiles with digest enabled
  const { data: subList } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, news_sectors, email_digest_enabled')
    .eq('email_digest_enabled', true)
    .order('email', { ascending: true })
  const subscribers = (subList || []).filter(s => s.email).map(s => ({
    id: s.id, email: s.email as string, full_name: s.full_name || null,
    sectors: (s.news_sectors || []) as string[],
  }))
  const subscriberCount = subscribers.length

  const sp = await searchParams

  return (
    <DashboardShell user={user} profile={profile} isAdmin={true} isApprovedExpert={await isApprovedExpert(user.id)} activePath="admin-news">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">News management</h1>
        <p className="text-sm text-gray-600 mt-1">Review &amp; approve items, manage editor&apos;s take, send digest.</p>
      </div>

      <AdminNewsTabs
        initialTab={sp.tab === 'send' ? 'send' : sp.tab === 'editor' ? 'editor' : 'queue'}
        items={items || []}
        takes={takes || []}
        subscriberCount={subscriberCount}
        subscribers={subscribers}
      />
    </DashboardShell>
  )
}
