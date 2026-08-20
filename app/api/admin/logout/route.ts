import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('admin_auth')
  res.cookies.delete('admin_key')
  return res
}
