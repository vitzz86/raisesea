import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import LocalTime from '@/components/LocalTime'

export const dynamic = 'force-dynamic'

const GOAL_LABELS: Record<string, string> = {
  pitch_intro: 'Pitch / first intro',
  investment_discussion: 'Investment discussion',
  product_feedback: 'Product / deck feedback',
  market_advice: 'Market or strategy advice',
  intro_request: 'Request for introductions',
  other: 'Other',
}

export default async function FounderMeetingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/dashboard/meetings')

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const admin = await isSuperAdmin(user)
  if (!admin) redirect('/dashboard')

  const isExpert = await isApprovedExpert(user.id)

  const { data: requests } = await supabaseAdmin
    .from('meeting_requests')
    .select(`
      id, status, meeting_goal, meeting_notes, preferred_slot_1, preferred_slot_2, preferred_slot_3,
      confirmed_slot, google_meet_link, vc_response, soft_hold_expires_at, created_at, vc_responded_at,
      vc_profile_id, submission_id
    `)
    .eq('founder_user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch related VC profiles + submissions
  const vcIds  = [...new Set((requests || []).map(r => r.vc_profile_id))]
  const subIds = [...new Set((requests || []).map(r => r.submission_id))]
  const [{ data: vcs }, { data: subs }] = await Promise.all([
    vcIds.length > 0
      ? supabaseAdmin.from('vc_profiles').select('id, display_name, fund_or_firm, avatar_url').in('id', vcIds)
      : Promise.resolve({ data: [] }),
    subIds.length > 0
      ? supabaseAdmin.from('submissions').select('id, company_name, unique_slug').in('id', subIds)
      : Promise.resolve({ data: [] }),
  ])
  const vcMap  = new Map((vcs || []).map(v => [v.id, v]))
  const subMap = new Map((subs || []).map(s => [s.id, s]))

  const list = requests || []
  const confirmed = list.filter(r => r.status === 'confirmed')
  const pending   = list.filter(r => r.status === 'pending')
  const past      = list.filter(r => ['declined', 'expired', 'cancelled', 'completed'].includes(r.status))

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="meetings">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Your meetings</h1>
        <p className="text-sm text-text-tertiary mt-1">Meeting requests you&apos;ve sent to experts. <Link href="/meet" className="text-brand underline">Browse experts →</Link></p>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-10 text-center">
          <div className="text-4xl mb-3 opacity-30">📅</div>
          <h2 className="text-base font-semibold text-text-primary mb-1">No meetings booked yet</h2>
          <p className="text-sm text-text-tertiary mb-4">Find a mentor, VC, or domain expert. 30-minute sessions, free for now.</p>
          <Link href="/meet" className="inline-block text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-md px-4 py-2">Browse experts →</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {confirmed.length > 0 && (
            <Section title="Confirmed" subtitle="Meeting is on your calendar">
              {confirmed.map(r => (
                <ConfirmedRow key={r.id}
                  request={r}
                  vc={vcMap.get(r.vc_profile_id)}
                  submission={subMap.get(r.submission_id)} />
              ))}
            </Section>
          )}
          {pending.length > 0 && (
            <Section title="Waiting for expert" subtitle="They&apos;ll pick one of your proposed times">
              {pending.map(r => (
                <PendingRow key={r.id}
                  request={r}
                  vc={vcMap.get(r.vc_profile_id)}
                  submission={subMap.get(r.submission_id)} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="History">
              {past.map(r => (
                <PastRow key={r.id}
                  request={r}
                  vc={vcMap.get(r.vc_profile_id)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </DashboardShell>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-text-tertiary mb-2">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

type MeetingRow = {
  id: string
  status: string
  meeting_goal: string
  meeting_notes: string
  confirmed_slot: string | null
  google_meet_link: string | null
  vc_response: string | null
  soft_hold_expires_at: string | null
  preferred_slot_1: string | null
  preferred_slot_2: string | null
  preferred_slot_3: string | null
  created_at: string
  vc_responded_at: string | null
  vc_profile_id: string
  submission_id: string
}

type VcMini = { id: string; display_name: string; fund_or_firm: string | null; avatar_url: string | null }
type SubMini = { id: string; company_name: string; unique_slug: string }

function VcSnippet({ vc }: { vc: VcMini | undefined }) {
  if (!vc) return <span className="text-text-tertiary">Unknown expert</span>
  return (
    <div className="flex items-center gap-2 min-w-0">
      {vc.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vc.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {vc.display_name[0].toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium text-text-primary truncate">{vc.display_name}</span>
      {vc.fund_or_firm && <span className="text-xs text-text-tertiary truncate">· {vc.fund_or_firm}</span>}
    </div>
  )
}

function ConfirmedRow({ request, vc, submission }: { request: MeetingRow; vc: VcMini | undefined; submission: SubMini | undefined }) {
  return (
    <div className="bg-white border border-success-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <VcSnippet vc={vc} />
        <span className="text-[10px] uppercase bg-green-100 text-success-text px-1.5 py-0.5 rounded">Confirmed</span>
      </div>
      <div className="mt-2 text-sm text-text-secondary">
        <strong>{request.confirmed_slot ? <LocalTime iso={request.confirmed_slot} /> : '—'}</strong>
        {submission && <> · for <Link href={`/match/${submission.unique_slug}`} className="text-brand underline">{submission.company_name}</Link></>}
      </div>
      <div className="text-xs text-text-tertiary mt-1">{GOAL_LABELS[request.meeting_goal] || request.meeting_goal}</div>
      {request.google_meet_link && (
        <a href={request.google_meet_link} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 text-xs font-medium bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5">
          Join Google Meet →
        </a>
      )}
    </div>
  )
}

function PendingRow({ request, vc, submission }: { request: MeetingRow; vc: VcMini | undefined; submission: SubMini | undefined }) {
  const slots = [request.preferred_slot_1, request.preferred_slot_2, request.preferred_slot_3].filter(Boolean) as string[]
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <VcSnippet vc={vc} />
        <span className="text-[10px] uppercase bg-warning-bg text-warning-text px-1.5 py-0.5 rounded">Pending</span>
      </div>
      <div className="mt-2 text-xs text-text-tertiary">{GOAL_LABELS[request.meeting_goal] || request.meeting_goal}</div>
      {submission && <div className="text-xs text-text-tertiary">For: <Link href={`/match/${submission.unique_slug}`} className="text-brand underline">{submission.company_name}</Link></div>}
      <div className="mt-2 text-xs text-text-tertiary">Proposed slots:</div>
      <ul className="text-xs text-text-secondary mt-0.5 space-y-0.5">
        {slots.map(s => <li key={s}>• <LocalTime iso={s} /></li>)}
      </ul>
      {request.soft_hold_expires_at && (
        <div className="text-[10px] text-text-disabled mt-2">
          Auto-expires <LocalTime iso={request.soft_hold_expires_at} />
        </div>
      )}
    </div>
  )
}

function PastRow({ request, vc }: { request: MeetingRow; vc: VcMini | undefined }) {
  return (
    <div className="bg-surface-muted border border-border rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <VcSnippet vc={vc} />
        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
          request.status === 'declined' ? 'bg-red-100 text-danger-text'
          : request.status === 'expired' ? 'bg-surface-sunken text-text-secondary'
          : 'bg-surface-sunken text-text-secondary'
        }`}>{request.status}</span>
      </div>
      {request.vc_response && (
        <div className="text-xs text-text-tertiary mt-1.5"><strong>Reason:</strong> {request.vc_response}</div>
      )}
      <div className="text-[10px] text-text-disabled mt-1">{new Date(request.created_at).toLocaleDateString()}</div>
    </div>
  )
}
