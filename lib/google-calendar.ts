// ═══════════════════════════════════════════════════════════════
// lib/google-calendar.ts
// Google Calendar OAuth + API client.
// Wraps the raw oauth2/calendar HTTP endpoints. We don't use the
// `googleapis` SDK because it adds 5MB of dependencies for ~6
// endpoints we actually need.
//
// All functions that touch Calendar accept a userId, look up the
// stored refresh token (encrypted via pgsodium in oauth_tokens),
// exchange it for a fresh access token, and retry once on 401.
// ═══════════════════════════════════════════════════════════════

import { getOAuthToken, setOAuthToken, revokeOAuthToken } from './token-storage'

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI  = process.env.GOOGLE_OAUTH_REDIRECT_URI || ''

const SCOPES = [
  // calendar.events: create/edit individual events (for booking)
  'https://www.googleapis.com/auth/calendar.events',
  // calendar.readonly: required for freeBusy.query (computing available slots)
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

// ─── OAuth URLs ─────────────────────────────────────────────────

/**
 * Build the Google authorization URL the VC clicks to grant Calendar access.
 * `state` is an opaque string we round-trip to detect tampering / CSRF.
 */
export function buildAuthUrl(state: string): string {
  if (!CLIENT_ID || !REDIRECT_URI) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT_URI not configured')
  }
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',  // required to get a refresh token
    prompt:        'consent',  // force re-consent so we always get a refresh token (Google omits it on re-auth otherwise)
    state,
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange the auth code we received on the callback for tokens.
 * Returns { access_token, refresh_token, expires_in }.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
}> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('Google OAuth env vars missing')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${body.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * Use a stored refresh token to get a fresh access token.
 * Returns null if refresh permanently failed (token revoked, account deleted, etc.)
 * — caller should mark the user as disconnected in that case.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
} | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[google-calendar] refresh failed:', res.status, body.slice(0, 200))
    return null
  }
  return res.json()
}

// ─── Auth wrapper used by all API calls ─────────────────────────

/**
 * Get a fresh access token for the given user. Handles refresh transparently.
 * Returns null if user has no token stored OR refresh failed permanently.
 */
async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const refreshToken = await getOAuthToken(userId, 'google_calendar')
  if (!refreshToken) return null

  const fresh = await refreshAccessToken(refreshToken)
  if (!fresh) {
    // Refresh permanently failed — token revoked or expired
    await revokeOAuthToken(userId, 'google_calendar')
    return null
  }
  return fresh.access_token
}

// ─── Calendar API: freebusy ─────────────────────────────────────

export type BusyBlock = { start: string; end: string }  // ISO timestamps

/**
 * Get busy time blocks for a user's primary calendar between two ISO timestamps.
 * Returns empty array on error (don't block scheduling if Calendar is briefly down).
 */
export async function getBusyBlocks(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<BusyBlock[]> {
  const accessToken = await getAccessTokenForUser(userId)
  if (!accessToken) {
    console.warn('[google-calendar] freebusy: no access token for user', userId)
    return []
  }

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startISO,
        timeMax: endISO,
        items: [{ id: 'primary' }],
      }),
    })
    if (!res.ok) {
      console.error('[google-calendar] freebusy failed:', res.status, await res.text())
      return []
    }
    const data = await res.json() as { calendars?: { primary?: { busy?: BusyBlock[] } } }
    return data.calendars?.primary?.busy || []
  } catch (err) {
    console.error('[google-calendar] freebusy threw:', err)
    return []
  }
}

// ─── Calendar API: create event with Meet link ──────────────────

export type CreatedEvent = {
  id: string             // Google Calendar event ID
  meetLink: string | null
  htmlLink: string       // link to view event in Google Calendar
}

/**
 * Create a Calendar event on the VC's calendar with a Google Meet link.
 * Invites the founder as an attendee so it lands on their calendar too.
 */
export async function createMeetingEvent(opts: {
  vcUserId:       string
  startISO:       string
  endISO:         string
  summary:        string
  description:    string
  founderEmail:   string
  vcEmail:        string
  timezone?:      string  // e.g. 'Asia/Singapore'
}): Promise<CreatedEvent | null> {
  const accessToken = await getAccessTokenForUser(opts.vcUserId)
  if (!accessToken) {
    console.error('[google-calendar] createEvent: no access token')
    return null
  }

  const requestId = `raisesea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const body = {
    summary:     opts.summary,
    description: opts.description,
    start: { dateTime: opts.startISO, timeZone: opts.timezone || 'Asia/Singapore' },
    end:   { dateTime: opts.endISO,   timeZone: opts.timezone || 'Asia/Singapore' },
    attendees: [
      { email: opts.founderEmail },
      // VC is the organizer (calendar owner), no need to add as attendee
    ],
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: true },
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) {
      console.error('[google-calendar] createEvent failed:', res.status, await res.text())
      return null
    }
    const evt = await res.json() as {
      id: string
      htmlLink: string
      hangoutLink?: string
      conferenceData?: { entryPoints?: Array<{ uri: string; entryPointType: string }> }
    }
    const meetLink =
      evt.hangoutLink ||
      evt.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ||
      null
    return { id: evt.id, meetLink, htmlLink: evt.htmlLink }
  } catch (err) {
    console.error('[google-calendar] createEvent threw:', err)
    return null
  }
}

/** Cancel/delete a Calendar event. Used when meeting is cancelled. */
export async function deleteEvent(vcUserId: string, eventId: string): Promise<boolean> {
  const accessToken = await getAccessTokenForUser(vcUserId)
  if (!accessToken) return false
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    )
    return res.ok || res.status === 410  // 410 = already deleted
  } catch {
    return false
  }
}

// ─── Helper: persist refresh token after callback ───────────────

export async function persistConnection(opts: {
  userId:       string
  refreshToken: string
  scope?:       string
  expiresIn?:   number  // seconds
}): Promise<boolean> {
  const expiresAt = opts.expiresIn ? new Date(Date.now() + opts.expiresIn * 1000) : undefined
  const { ok, error } = await setOAuthToken(
    opts.userId,
    'google_calendar',
    opts.refreshToken,
    { scope: opts.scope, expiresAt },
  )
  if (!ok) console.error('[google-calendar] persist failed:', error)
  return ok
}
