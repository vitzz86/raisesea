import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('admin_auth')
  return res
}
