import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; next?: string; error?: string }>
}) {
  const user = await getSessionUser()
  const params = await searchParams
  const redirectTo = safeRedirect(params.redirectTo || params.next || '/dashboard')

  if (user) {
    redirect(redirectTo)
  }

  return <LoginForm redirectTo={redirectTo} initialError={params.error} />
}

function safeRedirect(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return '/dashboard'
  return path
}
