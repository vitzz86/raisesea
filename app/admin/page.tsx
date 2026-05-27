import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/admin')

  const admin = await isSuperAdmin(user)
  if (!admin) {
    redirect('/dashboard')
  }

  const { data: stats } = await supabaseAdmin.rpc('get_platform_stats')
  const s = (stats as Record<string, unknown>) || {}

  return (
    <main className="min-h-screen bg-[#f8f7f2] px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-xl font-semibold text-[#1a4d2e]">
              RaiseSEA
            </Link>
            <p className="text-sm text-gray-600 mt-1">
              Super admin panel · Signed in as {user.email}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ← Back to dashboard
          </Link>
        </div>

        <div className="bg-white border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 text-xl">✓</span>
            <h1 className="text-lg font-semibold">Super admin access confirmed</h1>
          </div>
          <p className="text-sm text-gray-600">
            The full 4-tab admin panel (Overview · Submissions · Users · Super admins) ships in chunk 5.
          </p>
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Platform stats (live)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total submissions" value={s.total_submissions} />
          <StatCard label="Registered users" value={s.total_users} />
          <StatCard label="Submitted today" value={s.submissions_today} />
          <StatCard label="This week" value={s.submissions_this_week} />
          <StatCard label="Complete analyses" value={s.complete_analyses} />
          <StatCard label="Failed analyses" value={s.failed_analyses} />
          <StatCard label="Avg deck score" value={s.avg_deck_score} />
          <StatCard
            label="Total raise target"
            value={
              typeof s.total_raise_target_usd === 'number'
                ? `$${(s.total_raise_target_usd / 1e6).toFixed(1)}M`
                : '—'
            }
          />
        </div>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-semibold text-gray-900">
        {value == null || value === '' ? '—' : String(value)}
      </div>
    </div>
  )
}
