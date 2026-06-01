import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { supabaseAdmin } from '@/lib/supabase'
import { generateEditorsTake, generateTopStories } from '@/lib/news-pipeline'

export const maxDuration = 60

// POST /api/admin/news/editors-take — generate a new AI draft (take + top stories)
export async function POST() {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const take = await generateEditorsTake()
  if (!take) {
    return NextResponse.json({ error: 'Failed to generate — no approved items in last 7 days, or Gemini error' }, { status: 500 })
  }

  // Top stories are part of the same weekly artifact (best-effort: a failure
  // here shouldn't block the take — it just won't have top stories attached).
  const topStories = await generateTopStories()

  // Compute "week starting" (Monday of this week)
  const now = new Date()
  const dayOfWeek = now.getUTCDay()  // 0=Sun..6=Sat
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)

  const { data, error } = await supabaseAdmin
    .from('editors_takes')
    .insert({
      week_starting: monday.toISOString().slice(0, 10),
      content:  take.content,
      headline: take.headline,
      body:     take.body,
      takeaway: take.takeaway,
      top_stories: topStories,
      status: 'pending',
      generated_by: 'ai',
    })
    .select('id, content, headline, body, takeaway, top_stories')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, take: data })
}

// PATCH /api/admin/news/editors-take — approve/reject existing
export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: { id?: string; status?: 'approved' | 'rejected'; content?: string; headline?: string; body?: string; takeaway?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.status && ['approved', 'rejected'].includes(body.status)) {
    updates.status = body.status
    if (body.status === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = user.id
      // Auto-reject any other approved takes for same week (only one approved at a time)
      const { data: existing } = await supabaseAdmin
        .from('editors_takes')
        .select('week_starting')
        .eq('id', body.id)
        .maybeSingle()
      if (existing) {
        await supabaseAdmin
          .from('editors_takes')
          .update({ status: 'rejected' })
          .eq('week_starting', existing.week_starting)
          .eq('status', 'approved')
          .neq('id', body.id)
      }
    }
  }
  if (typeof body.content === 'string') {
    updates.content = body.content.trim().slice(0, 3000)
  }
  if (typeof body.headline === 'string') {
    updates.headline = body.headline.trim().slice(0, 200)
  }
  if (typeof body.body === 'string') {
    updates.body = body.body.trim().slice(0, 2000)
  }
  if (typeof body.takeaway === 'string') {
    updates.takeaway = body.takeaway.trim().slice(0, 400)
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('editors_takes').update(updates).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
