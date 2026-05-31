// app/api/feedback/route.ts
//
// Beta-tester feedback API.
//
// POST  — submit/update feedback for a task (upsert via UNIQUE constraint)
// GET   — list current user's feedback (used by dashboard to show which tasks are done)

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { ALL_TASKS, type BetaTaskKey } from '@/lib/beta-tasks'

export const dynamic = 'force-dynamic'

const VALID_TASK_KEYS: BetaTaskKey[] = ALL_TASKS.map(t => t.key)
const MAX_MESSAGE_LEN = 2000

// ─── POST: submit/update feedback ─────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { task_key?: string; rating?: number; message?: string; page_url?: string } | null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body) return NextResponse.json({ error: 'Empty body' }, { status: 400 })

  const { task_key, rating, message, page_url } = body

  // ─── Validation ───────────────────────────────────────────
  if (!task_key || !VALID_TASK_KEYS.includes(task_key as BetaTaskKey)) {
    return NextResponse.json(
      { error: `task_key must be one of: ${VALID_TASK_KEYS.join(', ')}` },
      { status: 400 }
    )
  }
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 10) {
    return NextResponse.json(
      { error: 'rating must be an integer 1-10' },
      { status: 400 }
    )
  }
  if (message && typeof message === 'string' && message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `message exceeds ${MAX_MESSAGE_LEN} characters` },
      { status: 400 }
    )
  }

  // ─── Upsert ──────────────────────────────────────────────
  // ON CONFLICT (user_id, task_key) → update (lets user refine their feedback)
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null

  const { data, error } = await supabaseAdmin
    .from('user_feedback')
    .upsert(
      {
        user_id:    user.id,
        task_key,
        rating,
        message:    (message || '').trim() || null,
        page_url:   page_url?.slice(0, 500) || null,
        user_agent: userAgent,
      },
      { onConflict: 'user_id,task_key' }
    )
    .select('id, task_key, rating')
    .single()

  if (error) {
    console.error('[/api/feedback] upsert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, feedback: data })
}

// ─── GET: list current user's feedback ────────────────────────
// Used by dashboard to show which tasks have been completed (= submitted feedback)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('user_feedback')
    .select('task_key, rating, message, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[/api/feedback GET] failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feedback: data || [] })
}
