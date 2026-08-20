import { NextResponse } from 'next/server'

// The password-cookie admin flow was retired in favor of Supabase Auth plus
// the super_admins allowlist. Keep an explicit response for old clients.
export async function POST() {
  return NextResponse.json(
    { error: 'Legacy admin login retired. Sign in with Google.' },
    { status: 410 },
  )
}
