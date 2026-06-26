import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import DashboardShell from '@/components/DashboardShell'
import { PageHeader, EmptyState, Card } from '@/components/ui'
import { Search, Users } from 'lucide-react'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', cvc: 'CVC', corporate: 'Corporate',
  angel: 'Angel', advisor: 'Advisor', domain_expert: 'Domain Expert',
}

type ExpertRow = {
  id: string
  display_name: string
  fund_or_firm: string | null
  title: string | null
  bio: string | null
  hq_country: string | null
  hq_city: string | null
  profile_types: string[]
  expertise_areas: string[]
  what_i_offer: string | null
  avatar_url: string | null
}

export default async function MeetDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const { type, q } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect('/login?redirectTo=/meet')

  const admin = await isSuperAdmin(user)
  if (!admin) redirect('/dashboard')

  let query = supabaseAdmin
    .from('vc_profiles')
    .select('id, display_name, fund_or_firm, title, bio, hq_country, hq_city, profile_types, expertise_areas, what_i_offer, avatar_url')
    .eq('application_status', 'active')
    .eq('is_listed', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (type && Object.keys(TYPE_LABELS).includes(type)) {
    query = query.contains('profile_types', [type])
  }

  const { data: experts } = await query
  let rows = (experts || []) as ExpertRow[]

  if (q) {
    const qLower = q.toLowerCase()
    rows = rows.filter(r =>
      r.display_name?.toLowerCase().includes(qLower) ||
      r.fund_or_firm?.toLowerCase().includes(qLower) ||
      r.expertise_areas?.some(a => a.toLowerCase().includes(qLower))
    )
  }

  const body = (
    <>
      <PageHeader
        title="Find an expert"
        subtitle="VCs, mentors, advisors, and domain experts active in Southeast Asia. Request a 30-minute meeting once you find a fit."
      />

      {/* Filter pills */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <FilterPill href="/meet" label="All" active={!type} />
        {Object.entries(TYPE_LABELS).map(([v, label]) => (
          <FilterPill key={v} href={`/meet?type=${v}`} label={label} active={type === v} />
        ))}
      </div>

      {/* Search */}
      <form method="GET" className="mb-6">
        {type && <input type="hidden" name="type" value={type} />}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" strokeWidth={1.75} />
          <input
            type="text"
            name="q"
            defaultValue={q || ''}
            placeholder="Search by name, firm, or expertise…"
            className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-md bg-surface-card focus:border-brand focus:outline-none transition-colors"
          />
        </div>
      </form>

      {rows.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Users className="w-5 h-5" strokeWidth={1.5} />}
            title="No experts match this filter"
            description="Try a different category or clear your search."
            primaryAction={{ label: 'See all experts', href: '/meet' }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(r => <ExpertCard key={r.id} expert={r} />)}
        </div>
      )}
    </>
  )

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, company_name').eq('id', user.id).maybeSingle()
  const isExpert = await isApprovedExpert(user.id)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="experts">
      {body}
    </DashboardShell>
  )
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
        active
          ? 'bg-brand text-text-inverse'
          : 'bg-surface-card text-text-secondary border border-border hover:border-border-strong'
      )}
    >
      {label}
    </Link>
  )
}

function ExpertCard({ expert }: { expert: ExpertRow }) {
  const initial = (expert.display_name[0] || 'E').toUpperCase()
  return (
    <Link
      href={`/meet/${expert.id}`}
      className="bg-surface-card border border-border rounded-lg p-4 hover:border-border-strong hover:shadow-hover transition-all block"
    >
      <div className="flex items-start gap-3 mb-3">
        {expert.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={expert.avatar_url}
            alt={expert.display_name}
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-border"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand text-text-inverse flex items-center justify-center text-sm font-semibold shrink-0">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary truncate">{expert.display_name}</h3>
          {expert.title && expert.fund_or_firm && (
            <p className="text-xs text-text-tertiary truncate">{expert.title} · {expert.fund_or_firm}</p>
          )}
          {!expert.title && expert.fund_or_firm && (
            <p className="text-xs text-text-tertiary truncate">{expert.fund_or_firm}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {expert.profile_types.slice(0, 3).map(t => (
          <span key={t} className="text-[10px] uppercase tracking-wider bg-brand-soft text-brand px-1.5 py-0.5 rounded font-medium">
            {TYPE_LABELS[t] || t}
          </span>
        ))}
      </div>
      {expert.what_i_offer && (
        <p className="text-xs text-text-secondary line-clamp-3 mb-3">{expert.what_i_offer}</p>
      )}
      {expert.expertise_areas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {expert.expertise_areas.slice(0, 3).map(area => (
            <span key={area} className="text-[10px] text-text-tertiary bg-surface-muted px-1.5 py-0.5 rounded">{area}</span>
          ))}
          {expert.expertise_areas.length > 3 && (
            <span className="text-[10px] text-text-tertiary">+{expert.expertise_areas.length - 3} more</span>
          )}
        </div>
      )}
    </Link>
  )
}
