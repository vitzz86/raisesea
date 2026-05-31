import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import ExpertApplyForm from './ExpertApplyForm'

export const dynamic = 'force-dynamic'

export default async function ExpertsApplyPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/experts/apply')

  const supabase = await createSupabaseServerClient()

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from('user_profiles').select('full_name, company_name, country').eq('id', user.id).maybeSingle(),
    supabase.from('vc_profiles').select('id, application_status, application_notes, avatar_url').eq('user_id', user.id).maybeSingle(),
  ])

  const isAdmin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  // If they already have an application — show status, not form
  if (existing) {
    return (
      <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-profile">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Your expert application</h1>
          <StatusCard
            status={existing.application_status}
            notes={existing.application_notes}
          />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={user} profile={profile} isAdmin={isAdmin} isApprovedExpert={isExpert} activePath="expert-profile">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Apply to join the expert network</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Get curated SEA founder deal flow + briefings. Free to join. Applications reviewed within 5 business days.
        </p>
      </div>
      <ExpertApplyForm
        prefill={{
          display_name: profile?.full_name || '',
          fund_or_firm: profile?.company_name || '',
          hq_country:   profile?.country || '',
          avatar_url:   null,
        }}
      />
    </DashboardShell>
  )
}

function StatusCard({ status, notes }: { status: string; notes: string | null }) {
  if (status === 'pending') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-600 text-xl">⏳</span>
          <h2 className="text-lg font-semibold text-amber-900">Application pending review</h2>
        </div>
        <p className="text-sm text-amber-800 mb-3">
          Thanks for applying. We typically review within 5 business days. You&apos;ll be notified by email when there&apos;s a decision.
        </p>
        <p className="text-xs text-amber-700">
          In the meantime, you can continue to use your founder dashboard. Once approved, you&apos;ll get an Expert section with deal flow.
        </p>
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600 text-xl">✓</span>
          <h2 className="text-lg font-semibold text-green-900">Application approved</h2>
        </div>
        <p className="text-sm text-green-800 mb-4">
          You&apos;re live in the expert directory. Founders can now request meetings with you.
        </p>
        <Link href="/experts/profile" className="inline-block text-sm font-medium bg-green-700 hover:bg-green-800 text-white rounded-md px-4 py-2 transition">
          Edit your profile →
        </Link>
      </div>
    )
  }
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-600 text-xl">✗</span>
        <h2 className="text-lg font-semibold text-red-900">Application not approved</h2>
      </div>
      {notes && <p className="text-sm text-red-800 mb-3"><strong>Reason:</strong> {notes}</p>}
      <p className="text-xs text-red-700">
        If you believe this is in error or your circumstances have changed, contact support.
      </p>
    </div>
  )
}
