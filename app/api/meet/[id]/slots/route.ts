// ═══════════════════════════════════════════════════════════════
// GET /api/meet/[id]/slots
// Returns the list of bookable 30-min slots for the given vc_profile_id.
// Combines:
//   • declared weekly availability windows
//   • Calendar busy blocks (live)
//   • slots already soft-held by pending meeting_requests
// Filtered by 48-hour lead time + 14-day horizon.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/super-admin'
import { getBusyBlocks } from '@/lib/google-calendar'
import { computeFreeSlots, type AvailabilityWindow, type SoftHeldSlot } from '@/lib/slot-computation'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  // Slot listing is gated to signed-in users — only founders with accounts can book.
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'This feature is currently available to admins only' }, { status: 403 })
  }

  const { id: vcProfileId } = await context.params

  // Verify VC is approved + listed + calendar connected
  const { data: vcProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('id, user_id, application_status, is_listed, calendar_connected')
    .eq('id', vcProfileId)
    .maybeSingle()

  if (!vcProfile || vcProfile.application_status !== 'active' || !vcProfile.is_listed) {
    return NextResponse.json({ error: 'Expert not bookable' }, { status: 404 })
  }
  if (!vcProfile.calendar_connected) {
    return NextResponse.json({ slots: [], reason: 'Calendar not connected' })
  }

  // Get declared windows
  const { data: windowsRaw } = await supabaseAdmin
    .from('vc_availability')
    .select('day_of_week, start_time, end_time, timezone, is_active')
    .eq('vc_profile_id', vcProfileId)
    .eq('is_active', true)

  const windows: AvailabilityWindow[] = (windowsRaw || []).map(w => ({
    day_of_week: w.day_of_week,
    start_time:  w.start_time,
    end_time:    w.end_time,
    timezone:    w.timezone,
  }))

  if (windows.length === 0) {
    return NextResponse.json({ slots: [], reason: 'No availability declared' })
  }

  // Get live busy blocks from Google Calendar
  const now = new Date()
  const horizonEnd = new Date(now.getTime() + 14 * 86400 * 1000)
  const busy = await getBusyBlocks(vcProfile.user_id, now.toISOString(), horizonEnd.toISOString())

  // Get soft-held slots (pending requests that haven't expired)
  const { data: pendingRaw } = await supabaseAdmin
    .from('meeting_requests')
    .select('preferred_slot_1, preferred_slot_2, preferred_slot_3, soft_hold_expires_at')
    .eq('vc_profile_id', vcProfileId)
    .eq('status', 'pending')
    .gt('soft_hold_expires_at', now.toISOString())

  const softHeld: SoftHeldSlot[] = []
  for (const r of pendingRaw || []) {
    for (const slot of [r.preferred_slot_1, r.preferred_slot_2, r.preferred_slot_3]) {
      if (slot) {
        const s = new Date(slot)
        softHeld.push({
          start: s.toISOString(),
          end:   new Date(s.getTime() + 30 * 60 * 1000).toISOString(),
        })
      }
    }
  }

  const slots = computeFreeSlots({ windows, busy, softHeld, now })

  return NextResponse.json({ slots: slots.slice(0, 100) })  // cap at 100 for UI sanity
}
