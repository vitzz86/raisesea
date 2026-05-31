// ═══════════════════════════════════════════════════════════════
// POST /api/meetings/request
// Founder submits a meeting request with up to 3 preferred slots.
// We re-validate slots are still bookable (race protection) and
// compute the soft-hold expiry (Option B: min of 7 days OR 1h-before-earliest-slot).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBusyBlocks } from '@/lib/google-calendar'
import { computeFreeSlots, type AvailabilityWindow, type SoftHeldSlot } from '@/lib/slot-computation'

const VALID_GOALS = ['pitch_intro', 'investment_discussion', 'product_feedback', 'market_advice', 'intro_request', 'other']
const MIN_LEAD_MS = 48 * 3600 * 1000  // 48 hours

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: {
    vc_profile_id?:   string
    submission_id?:   string
    meeting_goal?:    string
    meeting_notes?:   string
    key_questions?:   string[]
    preferred_slots?: string[]
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── Validate input ───────────────────────────────────────────
  if (!body.vc_profile_id) return NextResponse.json({ error: 'Missing vc_profile_id' }, { status: 400 })
  if (!body.submission_id) return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })
  if (!body.meeting_goal || !VALID_GOALS.includes(body.meeting_goal)) {
    return NextResponse.json({ error: 'Invalid meeting_goal' }, { status: 400 })
  }
  if (!body.meeting_notes || body.meeting_notes.trim().length < 30) {
    return NextResponse.json({ error: 'Meeting notes must be at least 30 characters' }, { status: 400 })
  }
  if (!Array.isArray(body.preferred_slots) || body.preferred_slots.length < 1 || body.preferred_slots.length > 3) {
    return NextResponse.json({ error: 'Must pick 1-3 preferred slots' }, { status: 400 })
  }

  // Slot must be valid ISO + ≥48h in future
  const now = Date.now()
  const slotMs = body.preferred_slots.map(s => new Date(s).getTime())
  for (const ms of slotMs) {
    if (isNaN(ms)) return NextResponse.json({ error: 'Invalid slot timestamp' }, { status: 400 })
    if (ms < now + MIN_LEAD_MS) return NextResponse.json({ error: 'All slots must be at least 48 hours in the future' }, { status: 400 })
  }

  // ── Authorize: submission must belong to founder ─────────────
  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select('id, user_id, company_name, deck_url, unique_slug')
    .eq('id', body.submission_id)
    .maybeSingle()
  if (!submission || submission.user_id !== user.id) {
    return NextResponse.json({ error: 'Submission not found or not yours' }, { status: 403 })
  }

  // ── Authorize: VC must be active + listed + calendar connected ──
  const { data: vc } = await supabaseAdmin
    .from('vc_profiles')
    .select('id, user_id, application_status, is_listed, calendar_connected')
    .eq('id', body.vc_profile_id)
    .maybeSingle()
  if (!vc || vc.application_status !== 'active' || !vc.is_listed) {
    return NextResponse.json({ error: 'Expert not bookable' }, { status: 404 })
  }
  if (!vc.calendar_connected) {
    return NextResponse.json({ error: 'Expert has not connected their calendar' }, { status: 400 })
  }

  // ── Race protection: re-compute free slots, ensure all picks are still bookable ──
  const { data: windowsRaw } = await supabaseAdmin
    .from('vc_availability')
    .select('day_of_week, start_time, end_time, timezone')
    .eq('vc_profile_id', body.vc_profile_id)
    .eq('is_active', true)
  const windows: AvailabilityWindow[] = (windowsRaw || []).map(w => ({
    day_of_week: w.day_of_week,
    start_time:  w.start_time,
    end_time:    w.end_time,
    timezone:    w.timezone,
  }))

  const horizonEnd = new Date(now + 14 * 86400 * 1000)
  const busy = await getBusyBlocks(vc.user_id, new Date(now).toISOString(), horizonEnd.toISOString())

  const { data: pendingRaw } = await supabaseAdmin
    .from('meeting_requests')
    .select('preferred_slot_1, preferred_slot_2, preferred_slot_3, soft_hold_expires_at')
    .eq('vc_profile_id', body.vc_profile_id)
    .eq('status', 'pending')
    .gt('soft_hold_expires_at', new Date(now).toISOString())

  const softHeld: SoftHeldSlot[] = []
  for (const r of pendingRaw || []) {
    for (const slot of [r.preferred_slot_1, r.preferred_slot_2, r.preferred_slot_3]) {
      if (slot) {
        const s = new Date(slot)
        softHeld.push({ start: s.toISOString(), end: new Date(s.getTime() + 30 * 60 * 1000).toISOString() })
      }
    }
  }

  const freeSlots = computeFreeSlots({ windows, busy, softHeld, now: new Date(now) })
  const freeSet = new Set(freeSlots.map(s => s.start_iso))

  for (const slotIso of body.preferred_slots) {
    const normalized = new Date(slotIso).toISOString()
    if (!freeSet.has(normalized)) {
      return NextResponse.json({
        error: 'One or more selected slots is no longer available — refresh and try again',
      }, { status: 409 })
    }
  }

  // ── Compute soft-hold expiry: min(7 days, earliest_slot - 1h) ──
  const earliestSlotMs = Math.min(...slotMs)
  const sevenDaysOut   = now + 7 * 86400 * 1000
  const oneHourBefore  = earliestSlotMs - 3600 * 1000
  const softHoldExpiresAt = new Date(Math.min(sevenDaysOut, oneHourBefore)).toISOString()

  // ── Insert the request ───────────────────────────────────────
  const { data: inserted, error } = await supabaseAdmin
    .from('meeting_requests')
    .insert({
      founder_user_id:        user.id,
      vc_profile_id:          body.vc_profile_id,
      submission_id:          body.submission_id,
      meeting_goal:           body.meeting_goal,
      meeting_notes:          body.meeting_notes.trim().slice(0, 5000),
      key_questions:          (body.key_questions || []).filter(q => typeof q === 'string' && q.trim().length > 0).slice(0, 5),
      preferred_slot_1:       body.preferred_slots[0],
      preferred_slot_2:       body.preferred_slots[1] || null,
      preferred_slot_3:       body.preferred_slots[2] || null,
      status:                 'pending',
      soft_hold_expires_at:   softHoldExpiresAt,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[/api/meetings/request] insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Email VC about the incoming request
  try {
    const { data: vcAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const vcEmail = vcAuth?.users.find(u => u.id === vc.user_id)?.email
    if (vcEmail) {
      const { sendEmail, wrapEmailHTML } = await import('@/lib/resend')
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const goalLabel = body.meeting_goal.replace(/_/g, ' ')
      const noteSnippet = (body.meeting_notes || '').slice(0, 300)
      const emailBody = `
<h2 style="font-size:18px;margin:0 0 12px 0;color:#1a1a1a;">New meeting request</h2>
<p style="font-size:14px;color:#333;margin:0 0 16px 0;">
  <strong>${(user.email || 'A founder').replace(/[<>&"]/g, '')}</strong> has requested a meeting with you on RaiseSEA.
</p>
<p style="font-size:13px;color:#666;margin:0 0 8px 0;">Goal: ${goalLabel.replace(/[<>&"]/g, '')}</p>
<p style="font-size:13px;color:#666;margin:0 0 16px 0;">${noteSnippet.replace(/[<>&"]/g, '')}</p>
<a href="${baseUrl}/experts/meetings" style="display:inline-block;background:#1a4d2e;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">
  Review request →
</a>`
      await sendEmail({
        to: vcEmail,
        subject: `Meeting request from ${user.email}`,
        html: wrapEmailHTML({ title: 'New meeting request', body: emailBody, unsubscribeUrl: `${baseUrl}/api/email/unsubscribe?u=${vc.user_id}` }),
        text: `New meeting request from ${user.email}. Review: ${baseUrl}/experts/meetings`,
        tags: [{ name: 'category', value: 'meeting_request' }],
      })
    }
  } catch (err) {
    console.error('[meetings/request] email send failed:', err)
    // don't fail the request submission if email fails
  }

  console.log(`[meetings] founder ${user.email} requested meeting with VC ${vc.id} → meeting_request ${inserted.id}`)

  return NextResponse.json({ ok: true, request_id: inserted.id })
}
