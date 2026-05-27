'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function AdminLogin() {
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  const router = useRouter()
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
    if (res.ok) router.push('/admin')
    else setErr('Invalid key')
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Admin access</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Admin key" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a4d2e]" />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" className="w-full bg-[#1a4d2e] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2d7a4e]">Sign in</button>
        </form>
      </div>
    </div>
  )
}
