// ═══════════════════════════════════════════════════════════════
// POST /api/meetings/[id]/accept
// VC picks one of the 3 proposed slots and confirms the meeting.
// We then:
//   1. Create a Google Calendar event on the VC's primary calendar
//   2. Auto-generate a Google Meet link via conferenceData
//   3. Invite the founder as attendee (sendUpdates=all → email sent by Google)
//   4. Mark the meeting_request as confirmed with the event/meet IDs
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createMeetingEvent } from '@/lib/google-calendar'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id: requestId } = await context.params

  let body: { chosen_slot?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.chosen_slot) return NextResponse.json({ error: 'Missing chosen_slot' }, { status: 400 })

  // ── Load request + cross-table data ──────────────────────────
  const { data: mr } = await supabaseAdmin
    .from('meeting_requests')
    .select(`
      id, status, founder_user_id, vc_profile_id,
      preferred_slot_1, preferred_slot_2, preferred_slot_3,
      meeting_goal, meeting_notes, key_questions, submission_id
    `)
    .eq('id', requestId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (mr.status !== 'pending') return NextResponse.json({ error: 'Request already resolved' }, { status: 400 })

  // Verify VC owns this request
  const { data: vcProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('user_id, display_name, fund_or_firm, calendar_connected')
    .eq('id', mr.vc_profile_id)
    .maybeSingle()
  if (!vcProfile || vcProfile.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!vcProfile.calendar_connected) {
    return NextResponse.json({ error: 'Calendar not connected — reconnect first' }, { status: 400 })
  }

  // Validate chosen_slot was one of the 3 proposals
  const proposals = [mr.preferred_slot_1, mr.preferred_slot_2, mr.preferred_slot_3].filter(Boolean) as string[]
  const chosenNormalized = new Date(body.chosen_slot).toISOString()
  const proposalsNormalized = proposals.map(p => new Date(p).toISOString())
  if (!proposalsNormalized.includes(chosenNormalized)) {
    return NextResponse.json({ error: 'chosen_slot was not one of the 3 proposed' }, { status: 400 })
  }

  // ── Fetch founder email + submission for event description ──
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const founderEmail = authUsers?.users.find(u => u.id === mr.founder_user_id)?.email
  if (!founderEmail) {
    return NextResponse.json({ error: 'Founder email not found' }, { status: 500 })
  }

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select('company_name, unique_slug')
    .eq('id', mr.submission_id)
    .maybeSingle()

  // ── Build event ──────────────────────────────────────────────
  const startISO = new Date(body.chosen_slot).toISOString()
  const endISO   = new Date(new Date(body.chosen_slot).getTime() + 30 * 60 * 1000).toISOString()
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const summary = `${submission?.company_name || 'Startup'} ↔ ${vcProfile.display_name}${vcProfile.fund_or_firm ? ' (' + vcProfile.fund_or_firm + ')' : ''}`
  const description = [
    `Meeting via RaiseSEA`,
    ``,
    `Goal: ${mr.meeting_goal.replace(/_/g, ' ')}`,
    ``,
    `Founder's note:`,
    mr.meeting_notes,
    ``,
    mr.key_questions && (mr.key_questions as string[]).length > 0
      ? 'Key questions:\n' + (mr.key_questions as string[]).map(q => '• ' + q).join('\n')
      : '',
    ``,
    submission ? `Deck & analysis: ${baseUrl}/match/${submission.unique_slug}` : '',
  ].filter(Boolean).join('\n')

  const event = await createMeetingEvent({
    vcUserId:     user.id,
    startISO,
    endISO,
    summary,
    description,
    founderEmail,
    vcEmail:      user.email || '',
    timezone:     'Asia/Singapore',
  })

  if (!event) {
    return NextResponse.json({ error: 'Failed to create calendar event — check Calendar connection' }, { status: 500 })
  }

  // ── Mark confirmed ───────────────────────────────────────────
  const { error: updErr } = await supabaseAdmin
    .from('meeting_requests')
    .update({
      status:                      'confirmed',
      confirmed_slot:              startISO,
      google_calendar_event_id:    event.id,
      google_meet_link:            event.meetLink,
      vc_responded_at:             new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updErr) {
    console.error('[meetings/accept] DB update failed:', updErr.message)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Branded email to founder (Google already sends Calendar invite; this is the RaiseSEA-branded follow-up)
  try {
    const { sendEmail, wrapEmailHTML } = await import('@/lib/resend')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const formattedTime = new Date(startISO).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZoneName: 'short',
    })
    const emailBody = `
<h2 style="font-size:18px;margin:0 0 12px 0;color:#1a4d2e;">✓ Meeting confirmed</h2>
<p style="font-size:14px;color:#333;margin:0 0 16px 0;">
  <strong>${vcProfile.display_name}</strong>${vcProfile.fund_or_firm ? ' from ' + vcProfile.fund_or_firm : ''} accepted your meeting request.
</p>
<div style="background:#f8f7f2;border-radius:8px;padding:14px;margin:0 0 16px 0;">
  <div style="font-size:11px;text-transform:uppercase;color:#888;margin-bottom:4px;">When</div>
  <div style="font-size:15px;font-weight:600;color:#1a1a1a;">${formattedTime}</div>
</div>
${event.meetLink ? `<a href="${event.meetLink}" style="display:inline-block;background:#1a4d2e;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;margin-bottom:8px;">Join Google Meet</a><br>` : ''}
<p style="font-size:12px;color:#666;margin-top:12px;">A Google Calendar invite has been sent separately. <a href="${baseUrl}/dashboard/meetings" style="color:#1a4d2e;">View in RaiseSEA →</a></p>`
    await sendEmail({
      to: founderEmail,
      subject: `Meeting confirmed with ${vcProfile.display_name}`,
      html: wrapEmailHTML({ title: 'Meeting confirmed', body: emailBody, unsubscribeUrl: `${baseUrl}/api/email/unsubscribe?u=${mr.founder_user_id}` }),
      text: `${vcProfile.display_name} confirmed your meeting on ${formattedTime}. ${event.meetLink || ''}`,
      tags: [{ name: 'category', value: 'meeting_confirmed' }],
    })
  } catch (err) {
    console.error('[meetings/accept] email send failed:', err)
  }

  console.log(`[meetings] ${user.email} accepted meeting ${requestId} → ${event.htmlLink}`)
  return NextResponse.json({ ok: true, meet_link: event.meetLink, calendar_link: event.htmlLink })
}
