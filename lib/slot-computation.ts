// ═══════════════════════════════════════════════════════════════
// lib/slot-computation.ts
// Compute available 30-min meeting slots for a VC.
//
// Algorithm:
//   1. For each day in the next 14 days (starting at +48h from now)…
//   2. Look up that day's weekday → match against vc_availability windows
//   3. For each window, generate 30-min slots
//   4. Subtract Google Calendar busy blocks
//   5. Subtract slots already soft-held by pending meeting_requests
//
// We keep this UTC-internally; the VC's declared timezone is used only
// to interpret HH:MM windows. Output is always ISO UTC.
// ═══════════════════════════════════════════════════════════════

import type { BusyBlock } from './google-calendar'

export type AvailabilityWindow = {
  day_of_week: number  // 0=Sun..6=Sat
  start_time:  string  // 'HH:MM:SS' or 'HH:MM'
  end_time:    string
  timezone:    string
}

export type SoftHeldSlot = { start: string; end: string }  // ISO

export type FreeSlot = {
  start_iso:  string  // UTC ISO timestamp
  end_iso:    string
  day_label:  string  // "Tue, Jun 2" (used for grouping)
  time_label: string  // "10:00 AM" (start time only, 30-min is implied)
  tz_abbr:    string  // "SGT" / "ICT" — shown once per day header
  iso_date:   string  // "2025-06-02" — sortable key for grouping
}

const SLOT_MINUTES = 30
const MIN_LEAD_HOURS = 48
const HORIZON_DAYS = 14

/**
 * Parse 'HH:MM:SS' or 'HH:MM' → minutes since midnight.
 */
function parseTime(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convert a Date (or ISO string) to local-time HH:MM in a given IANA timezone.
 * Uses Intl.DateTimeFormat for correctness vs DST.
 */
function getZonedTimeMinutes(date: Date, timezone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday:  'short',
    hour:     'numeric',
    minute:   'numeric',
    hour12:   false,
  }).formatToParts(date)

  const weekday = parts.find(p => p.type === 'weekday')!.value
  const hour    = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
  const minute  = parseInt(parts.find(p => p.type === 'minute')!.value, 10)

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { day: dayMap[weekday] ?? 0, minutes: hour * 60 + minute }
}

/**
 * Get the timezone abbreviation (e.g. "SGT", "ICT") for display in slot labels.
 */
function tzShort(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(date)
    return parts.find(p => p.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

/**
 * Build display labels split into day/time so the UI can group easily.
 */
function buildLabels(startISO: string, timezone: string): {
  day_label: string
  time_label: string
  tz_abbr: string
  iso_date: string
} {
  const startD = new Date(startISO)
  const day_label = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
  }).format(startD)
  const time_label = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(startD)
  const tz_abbr = tzShort(startD, timezone)

  // ISO date in the VC's timezone (for grouping/sorting by day)
  const ymdParts = new Intl.DateTimeFormat('en-CA', {  // en-CA → YYYY-MM-DD format
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(startD)
  return { day_label, time_label, tz_abbr, iso_date: ymdParts }
}

/**
 * Check if a 30-min slot overlaps any busy or soft-held block.
 * A slot [s, e) conflicts if (s < block.end AND e > block.start).
 */
function conflicts(
  startMs: number,
  endMs: number,
  blocks: Array<{ startMs: number; endMs: number }>,
): boolean {
  for (const b of blocks) {
    if (startMs < b.endMs && endMs > b.startMs) return true
  }
  return false
}

/**
 * Main entry — returns all available 30-min slots for the next 14 days,
 * filtered by 48h lead time, calendar busy, and soft-holds.
 */
export function computeFreeSlots(opts: {
  windows:     AvailabilityWindow[]
  busy:        BusyBlock[]
  softHeld:    SoftHeldSlot[]
  now?:        Date           // injectable for tests; defaults to now
}): FreeSlot[] {
  const now = opts.now || new Date()
  const earliestStart = new Date(now.getTime() + MIN_LEAD_HOURS * 3600 * 1000)
  const horizonEnd    = new Date(now.getTime() + HORIZON_DAYS * 86400 * 1000)

  // Normalize blocked intervals to numeric ms for fast comparison
  const blockedMs = [
    ...opts.busy.map(b => ({ startMs: new Date(b.start).getTime(), endMs: new Date(b.end).getTime() })),
    ...opts.softHeld.map(s => ({ startMs: new Date(s.start).getTime(), endMs: new Date(s.end).getTime() })),
  ]

  // Group windows by (day, timezone) for efficient lookup
  // For each day in the horizon, we need to know which windows apply
  // Note: a window has its own timezone. We compute the day-of-week IN THAT TIMEZONE
  // for each candidate calendar day.

  const results: FreeSlot[] = []
  // Walk day by day (start at "earliestStart" rounded down to its date)
  const startDay = new Date(earliestStart.getTime())
  startDay.setUTCHours(0, 0, 0, 0)
  const endDay = new Date(horizonEnd.getTime())
  endDay.setUTCHours(0, 0, 0, 0)

  for (let d = new Date(startDay); d <= endDay; d.setUTCDate(d.getUTCDate() + 1)) {
    // For each window, check if THIS calendar day (interpreted in window's TZ)
    // matches the window's day_of_week
    for (const w of opts.windows) {
      const ref = new Date(d)
      const zoned = getZonedTimeMinutes(ref, w.timezone)
      if (zoned.day !== w.day_of_week) continue

      // Generate slots from start_time to end_time (in window's TZ)
      const startMin = parseTime(w.start_time)
      const endMin   = parseTime(w.end_time)

      for (let m = startMin; m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
        // Build the slot's start/end in the window's timezone, then convert to UTC
        // To do this we construct an ISO local time and let Date interpret it,
        // accounting for the timezone offset at that moment.
        const slotStartISO = makeZonedISO(d, m, w.timezone)
        const slotEndISO   = makeZonedISO(d, m + SLOT_MINUTES, w.timezone)
        if (!slotStartISO || !slotEndISO) continue

        const slotStartMs = new Date(slotStartISO).getTime()
        const slotEndMs   = new Date(slotEndISO).getTime()

        // Apply 48h lead time + horizon
        if (slotStartMs < earliestStart.getTime()) continue
        if (slotStartMs > horizonEnd.getTime()) continue

        // Skip if conflicts with busy/soft-held
        if (conflicts(slotStartMs, slotEndMs, blockedMs)) continue

        const labels = buildLabels(new Date(slotStartMs).toISOString(), w.timezone)
        results.push({
          start_iso:  new Date(slotStartMs).toISOString(),
          end_iso:    new Date(slotEndMs).toISOString(),
          day_label:  labels.day_label,
          time_label: labels.time_label,
          tz_abbr:    labels.tz_abbr,
          iso_date:   labels.iso_date,
        })
      }
    }
  }

  // De-duplicate (windows could overlap, e.g. if a VC declares overlapping ranges)
  const seen = new Set<string>()
  const unique = results.filter(s => {
    if (seen.has(s.start_iso)) return false
    seen.add(s.start_iso)
    return true
  })

  // Sort chronologically
  unique.sort((a, b) => a.start_iso.localeCompare(b.start_iso))
  return unique
}

/**
 * Construct an ISO UTC timestamp for "day D, minutes M, in timezone TZ".
 * Uses a probing technique: format the target in TZ, compute the offset
 * needed to land at that local clock time, return the resulting UTC instant.
 *
 * This is the part that's gnarly. We accept a small DST-edge limitation:
 * during the "spring forward" hour, the slot won't materialize (which is
 * the correct behavior — that time doesn't exist locally).
 */
function makeZonedISO(dayUTC: Date, minutesInDay: number, timezone: string): string | null {
  // Start with the UTC midnight of the target day, then iteratively converge
  // on the correct UTC instant whose local clock matches (dayUTC, minutesInDay).
  // Since timezone offsets are step functions, one or two iterations always converge.

  const hour = Math.floor(minutesInDay / 60)
  const min  = minutesInDay % 60

  // First guess: assume offset of timezone right now
  // Format the UTC midnight in the target TZ to find that day's offset
  let candidate = new Date(Date.UTC(
    dayUTC.getUTCFullYear(),
    dayUTC.getUTCMonth(),
    dayUTC.getUTCDate(),
    hour,
    min,
    0,
    0,
  ))

  // Iterate twice to handle DST transitions correctly
  for (let i = 0; i < 3; i++) {
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(candidate)

    const get = (t: string) => parseInt(localParts.find(p => p.type === t)!.value, 10)
    const localY = get('year')
    const localM = get('month')
    const localD = get('day')
    const localH = get('hour') === 24 ? 0 : get('hour')  // some locales emit "24" for midnight
    const localMin = get('minute')

    // Target local date/time
    const targetY = dayUTC.getUTCFullYear()
    const targetM = dayUTC.getUTCMonth() + 1
    const targetD = dayUTC.getUTCDate()

    const diffMinutes =
      ((targetY - localY) * 525600) +
      ((targetM - localM) * 43200) +
      ((targetD - localD) * 1440) +
      ((hour - localH) * 60) +
      (min - localMin)

    if (diffMinutes === 0) return candidate.toISOString()
    candidate = new Date(candidate.getTime() + diffMinutes * 60 * 1000)
  }

  return candidate.toISOString()  // converged or close enough
}
