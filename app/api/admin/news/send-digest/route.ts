import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { sendWeeklyDigest } from '@/lib/digest-builder'

export const maxDuration = 300

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { dryRun?: boolean }
  try { body = await req.json() } catch { body = {} }

  const result = await sendWeeklyDigest({
    triggeredBy: 'manual_admin',
    triggeredByUserId: user.id,
    dryRun: !!body.dryRun,
  })
  return NextResponse.json({ ok: true, ...result })
}
