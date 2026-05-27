import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { key } = await req.json()
  if (key !== process.env.ADMIN_SECRET_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_key', key, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7 })
  return res
}
