import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/supabase-server'
import LoginForm from './LoginForm'
import { safeInternalRedirect } from '@/lib/safe-redirect'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in | RaiseSEA',
  description: 'Sign in with Google to use RaiseSEA deck analysis, mock pitch practice, investor matching, CRM, calculators, and weekly news.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; next?: string; error?: string }>
}) {
  const user = await getSessionUser()
  const params = await searchParams
  const redirectTo = safeInternalRedirect(params.redirectTo || params.next)

  if (user) {
    redirect(redirectTo)
  }

  return <LoginForm redirectTo={redirectTo} initialError={params.error} />
}
