import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Pull user profile + count of claimed submissions
  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name, email, role, plan, submissions_count')
    .eq('id', user.id)
    .maybeSingle()

  // Use service role (bypasses RLS) to get accurate count
  const { count } = await supabaseAdmin
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const isAdmin = await isSuperAdmin(user)

  return (
    <main className="min-h-screen bg-[#f8f7f2] px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-xl font-semibold text-[#1a4d2e]">
              RaiseSEA
            </Link>
            <p className="text-sm text-gray-600 mt-1">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
            </p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Auth working confirmation */}
        <div className="bg-white border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 text-xl">✓</span>
            <h1 className="text-lg font-semibold">You&apos;re signed in</h1>
          </div>
          <p className="text-sm text-gray-600">
            Authentication is working. The full dashboard ships in chunk 4 — for now this is a placeholder.
          </p>
        </div>

        {/* Account details */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Your account
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Email</dt>
              <dd className="font-medium text-gray-900">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">User ID</dt>
              <dd className="font-mono text-xs text-gray-500">{user.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Role</dt>
              <dd className="font-medium text-gray-900 capitalize">{profile?.role || 'founder'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Plan</dt>
              <dd className="font-medium text-gray-900 capitalize">{profile?.plan || 'free'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Your submissions</dt>
              <dd className="font-medium text-gray-900">{count ?? 0}</dd>
            </div>
            {isAdmin && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <dt className="text-gray-600">Super admin</dt>
                <dd className="font-medium text-green-700">Yes —{' '}
                  <Link href="/admin" className="underline hover:text-green-800">
                    Open admin panel
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/apply"
            className="bg-[#1a4d2e] hover:bg-[#143d24] text-white rounded-xl p-5 transition"
          >
            <div className="text-sm font-medium mb-1">→ Submit a deck</div>
            <div className="text-xs text-white/70">Run a new analysis</div>
          </Link>
          <div className="bg-gray-100 rounded-xl p-5">
            <div className="text-sm font-medium text-gray-700 mb-1">Coming in chunk 4</div>
            <div className="text-xs text-gray-500">
              Submission history · Stats · Settings · Profile editing
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
