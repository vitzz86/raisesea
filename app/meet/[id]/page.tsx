import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import { Card, Button } from '@/components/ui'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import DashboardShell from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  vc: 'Venture Capital', cvc: 'Corporate VC', corporate: 'Corporate',
  angel: 'Angel', advisor: 'Advisor', domain_expert: 'Domain Expert',
}

export default async function ExpertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/login?redirectTo=/meet/${id}`)

  const admin = await isSuperAdmin(user)
  if (!admin) redirect('/dashboard')

  const { data: expert } = await supabaseAdmin
    .from('vc_profiles')
    .select('*')
    .eq('id', id)
    .eq('application_status', 'active')
    .eq('is_listed', true)
    .eq('is_active', true)
    .maybeSingle()

  if (!expert) notFound()

  const initial = (expert.display_name[0] || 'E').toUpperCase()

  const body = (
    <div className="max-w-5xl">
      <Link href="/meet" className="text-sm text-text-tertiary hover:text-text-primary inline-flex items-center gap-1 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        Back to directory
      </Link>

      <Card className="mt-4">
        <div className="flex items-start gap-4 mb-4">
          {expert.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={expert.avatar_url} alt={expert.display_name}
              className="w-16 h-16 rounded-full object-cover shrink-0 border border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand text-text-inverse flex items-center justify-center text-2xl font-semibold shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">{expert.display_name}</h1>
            {expert.title && (
              <p className="text-sm text-text-secondary mt-1">
                {expert.title}{expert.fund_or_firm ? ` at ${expert.fund_or_firm}` : ''}
              </p>
            )}
            {!expert.title && expert.fund_or_firm && (
              <p className="text-sm text-text-secondary mt-1">{expert.fund_or_firm}</p>
            )}
            {(expert.hq_city || expert.hq_country) && (
              <p className="text-xs text-text-tertiary mt-1">
                {[expert.hq_city, expert.hq_country].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(expert.profile_types || []).map((t: string) => (
                <span key={t} className="text-[10px] uppercase tracking-wider bg-brand-soft text-brand px-2 py-0.5 rounded font-medium">
                  {TYPE_LABELS[t] || t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {expert.calendar_connected ? (
            <Link href={`/meet/${expert.id}/request`}>
              <Button variant="primary">Request meeting</Button>
            </Link>
          ) : (
            <Button variant="secondary" disabled title="Expert hasn't connected their calendar yet">
              Calendar not connected
            </Button>
          )}
          {expert.linkedin_url && (
            <a href={expert.linkedin_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" rightIcon={<ExternalLink className="w-3 h-3" strokeWidth={1.75} />}>
                LinkedIn
              </Button>
            </a>
          )}
          {expert.website && (
            <a href={expert.website} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" rightIcon={<ExternalLink className="w-3 h-3" strokeWidth={1.75} />}>
                Personal site
              </Button>
            </a>
          )}
          {expert.company_website && (
            <a href={expert.company_website} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" rightIcon={<ExternalLink className="w-3 h-3" strokeWidth={1.75} />}>
                Company site
              </Button>
            </a>
          )}
        </div>

        {expert.bio && (
          <Section title="About">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{expert.bio}</p>
          </Section>
        )}

        {expert.what_i_offer && (
          <Section title="What I offer founders">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{expert.what_i_offer}</p>
          </Section>
        )}

        {(expert.expertise_areas || []).length > 0 && (
          <Section title="Expertise">
            <div className="flex flex-wrap gap-1.5">
              {(expert.expertise_areas as string[]).map(a => (
                <span key={a} className="text-xs bg-surface-muted text-text-secondary px-2 py-1 rounded">{a}</span>
              ))}
            </div>
          </Section>
        )}

        {(expert.languages || []).length > 0 && (
          <Section title="Languages">
            <p className="text-sm text-text-secondary">{(expert.languages as string[]).join(' · ')}</p>
          </Section>
        )}

        {(expert.invest_stages || []).length > 0 && (
          <Section title="Investment profile">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-text-tertiary mb-1">Stages</p>
                <p className="text-sm text-text-secondary">{(expert.invest_stages as string[]).join(', ')}</p>
              </div>
              {(expert.invest_sectors || []).length > 0 && (
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Sectors</p>
                  <p className="text-sm text-text-secondary">{(expert.invest_sectors as string[]).join(', ')}</p>
                </div>
              )}
              {expert.ticket_min_usd && expert.ticket_max_usd && (
                <p className="text-xs text-text-tertiary">
                  Ticket: ${(expert.ticket_min_usd / 1000).toFixed(0)}K — ${(expert.ticket_max_usd / 1000).toFixed(0)}K
                </p>
              )}
              {expert.investment_thesis && (
                <p className="text-sm text-text-secondary whitespace-pre-wrap mt-2 leading-relaxed">{expert.investment_thesis}</p>
              )}
            </div>
          </Section>
        )}
      </Card>
    </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border-muted pt-4 mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">{title}</h2>
      {children}
    </div>
  )
}
