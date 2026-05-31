import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { isApprovedExpert } from '@/lib/expert-status'
import { resolveDeckUrl } from '@/lib/storage'
import DashboardShell from '@/components/DashboardShell'
import LiveSession from './LiveSession'

export const dynamic = 'force-dynamic'

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/login?redirectTo=/mock-pitch/${sessionId}`)

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, company_name').eq('id', user.id).maybeSingle()

  const { data: session } = await supabaseAdmin
    .from('mock_pitch_sessions')
    .select('id, submission_id, mode, duration_min, questions, transcript, status, started_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!session) notFound()

  if (session.status === 'completed') {
    redirect(`/mock-pitch/${sessionId}/debrief`)
  }

  const { data: sub } = await supabaseAdmin
    .from('submissions')
    .select('id, company_name, deck_url, stage, sector')
    .eq('id', session.submission_id)
    .maybeSingle()

  // Resolve the deck into both an embeddable URL and a direct "open in new tab" URL.
  // Handles: storage paths, Google Drive URLs (auto-converted to /preview), other https URLs, or null.
  const { embedUrl: deckEmbedUrl, external: deckExternalUrl } = await resolveDeckUrl(sub?.deck_url, 7200)

  const admin = await isSuperAdmin(user)
  const isExpert = await isApprovedExpert(user.id)

  return (
    <DashboardShell user={user} profile={profile} isAdmin={admin} isApprovedExpert={isExpert} activePath="mock-pitch">
      <LiveSession
        sessionId={sessionId}
        mode={session.mode as 'pitch' | 'qa'}
        durationMin={session.duration_min}
        questions={session.questions as { q: string; area: string; context?: string }[] | null}
        company={sub?.company_name || ''}
        deckUrl={deckEmbedUrl}
        deckExternalUrl={deckExternalUrl}
      />
    </DashboardShell>
  )
}
