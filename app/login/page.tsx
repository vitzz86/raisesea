import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const user = await getSessionUser()
  const params = await searchParams
  const redirectTo = params.redirectTo || '/dashboard'

  if (user) {
    redirect(redirectTo)
  }

  return <LoginForm redirectTo={redirectTo} initialError={params.error} />
}
