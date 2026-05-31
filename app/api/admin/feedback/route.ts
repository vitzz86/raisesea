// app/api/admin/feedback/route.ts
//
// Admin endpoint: list all beta feedback with user emails.
// Auth: cookie-based admin_auth check (matches /api/admin/submissions pattern).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('admin_auth')
  if (cookie?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all feedback
  const { data: feedback, error } = await supabaseAdmin
    .from('user_feedback')
    .select('id, user_id, task_key, rating, message, page_url, user_agent, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[/api/admin/feedback] failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with user emails via auth.admin (separate query — no FK to auth.users from API)
  const userIds = Array.from(new Set((feedback || []).map(f => f.user_id as string)))
  const userEmails: Record<string, string> = {}

  // listUsers is paginated; for now we list up to 1000 (enough for beta phase)
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of users?.users || []) {
    if (userIds.includes(u.id)) {
      userEmails[u.id] = u.email || '(no email)'
    }
  }

  const enriched = (feedback || []).map(f => ({
    ...f,
    user_email: userEmails[f.user_id as string] || '(unknown)',
  }))

  // Aggregate stats per task
  const taskAverages: Record<string, { count: number; sum: number; avg: number }> = {}
  for (const f of feedback || []) {
    const key = f.task_key as string
    if (!taskAverages[key]) taskAverages[key] = { count: 0, sum: 0, avg: 0 }
    taskAverages[key].count += 1
    taskAverages[key].sum   += (f.rating as number)
  }
  for (const key of Object.keys(taskAverages)) {
    taskAverages[key].avg = Math.round((taskAverages[key].sum / taskAverages[key].count) * 10) / 10
  }

  return NextResponse.json({
    feedback: enriched,
    stats:    taskAverages,
    total:    enriched.length,
  })
}
