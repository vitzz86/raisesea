'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export default function LoginForm({ redirectTo, initialError }: { redirectTo: string; initialError?: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    initialError
      ? { kind: 'error', text: initialError.includes('PKCE') || initialError.includes('verifier') || initialError.includes('link')
          ? 'That sign-in attempt expired. Please continue with Google.'
          : initialError }
      : null
  )
  const supabase = getSupabaseBrowserClient()

  async function handleGoogle() {
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}` },
    })
    if (error) { setLoading(false); setMessage({ kind: 'error', text: error.message }) }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[#1a4d2e]">RaiseSEA</Link>
          <p className="mt-2 text-sm text-gray-600">Founder OS for Southeast Asia</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-600 mb-6">Use your Google account to continue. No password, no magic-link limits.</p>
          <button type="button" onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-border-strong rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition">
            <GoogleIcon />{loading ? 'Redirecting...' : 'Continue with Google'}
          </button>
          {message && (
            <div className={`mt-4 text-sm rounded-lg p-3 ${message.kind === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>
          )}
        </div>
        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to RaiseSEA&apos;s terms.<br />
          New here? <Link href="/" className="text-[#1a4d2e] hover:underline">Learn more about the platform</Link>.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
