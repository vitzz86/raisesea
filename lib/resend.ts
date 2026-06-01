// ═══════════════════════════════════════════════════════════════
// lib/resend.ts — Email sending via Resend
// Single helper used by:
//   • Meeting flow emails (request received, accepted, declined)
//   • Weekly news digest
// Logs to console + returns false on failure so callers can decide
// whether to surface to the user.
// ═══════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL     = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const FROM_LABEL     = 'RaiseSEA'

export type EmailPayload = {
  to:        string | string[]
  subject:   string
  html:      string
  text?:     string           // plain-text fallback (recommended for deliverability)
  reply_to?: string
  tags?:     Array<{ name: string; value: string }>
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[resend] RESEND_API_KEY not set — skipping email to', payload.to)
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const MAX_ATTEMPTS = 4
  let lastErr = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:   `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:     `${FROM_LABEL} <${FROM_EMAIL}>`,
          to:       Array.isArray(payload.to) ? payload.to : [payload.to],
          subject:  payload.subject,
          html:     payload.html,
          text:     payload.text,
          reply_to: payload.reply_to,
          tags:     payload.tags,
        }),
      })

      // Rate limited (free tier = 2 req/s). Wait the header's Retry-After (or back
      // off) and retry — so a burst of sends doesn't silently drop recipients.
      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        const retryAfterSec = Number(res.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : 700 * attempt  // 0.7s, 1.4s, 2.1s
        console.warn(`[resend] 429 rate limited (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${waitMs}ms`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      if (!res.ok) {
        const errBody = await res.text()
        console.error('[resend] send failed:', res.status, errBody.slice(0, 300))
        return { ok: false, error: `Resend ${res.status}: ${errBody.slice(0, 200)}` }
      }
      const data = await res.json() as { id: string }
      return { ok: true, id: data.id }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      console.error('[resend] threw:', err)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 700 * attempt))
        continue
      }
      return { ok: false, error: lastErr }
    }
  }
  return { ok: false, error: lastErr || 'Resend rate limit: retries exhausted' }
}

/**
 * Send up to 100 distinct emails in ONE request via Resend's batch endpoint.
 * Why batch: Resend's rate limit is 2 requests/sec across all endpoints, so a
 * per-recipient loop hits 429s fast. Batching turns N sends into ceil(N/100)
 * requests. The caller is responsible for chunking to <= 100 and for mapping
 * success back to recipients.
 *
 * Notes (verified against Resend docs):
 *  - Default validation is STRICT: if ANY item is invalid the whole batch is
 *    rejected. Callers MUST pre-validate addresses (see isValidEmail in the
 *    digest builder).
 *  - `tags` are supported on batch; `attachments` are not (we don't use them).
 *  - An optional Idempotency-Key dedupes accidental re-sends within ~24h.
 */
export async function sendEmailBatch(
  emails: EmailPayload[],
  opts?: { idempotencyKey?: string },
): Promise<{ ok: boolean; sent: number; ids: string[]; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[resend] RESEND_API_KEY not set — skipping batch of', emails.length)
    return { ok: false, sent: 0, ids: [], error: 'RESEND_API_KEY not configured' }
  }
  if (emails.length === 0) return { ok: true, sent: 0, ids: [] }
  if (emails.length > 100) {
    return { ok: false, sent: 0, ids: [], error: `Batch too large (${emails.length}); max 100 — caller must chunk` }
  }

  const payload = emails.map(p => ({
    from:     `${FROM_LABEL} <${FROM_EMAIL}>`,
    to:       Array.isArray(p.to) ? p.to : [p.to],
    subject:  p.subject,
    html:     p.html,
    text:     p.text,
    reply_to: p.reply_to,
    tags:     p.tags,
  }))

  const MAX_ATTEMPTS = 4
  let lastErr = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const headers: Record<string, string> = {
        Authorization:   `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      }
      if (opts?.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey

      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        const retryAfterSec = Number(res.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : 700 * attempt
        console.warn(`[resend] batch ${res.status} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${waitMs}ms`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      if (!res.ok) {
        const errBody = await res.text()
        console.error('[resend] batch failed:', res.status, errBody.slice(0, 300))
        return { ok: false, sent: 0, ids: [], error: `Resend ${res.status}: ${errBody.slice(0, 200)}` }
      }

      const data = await res.json() as { data?: Array<{ id: string }> }
      const ids = (data.data || []).map(d => d.id)
      return { ok: true, sent: ids.length, ids }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      console.error('[resend] batch threw:', err)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 700 * attempt))
        continue
      }
      return { ok: false, sent: 0, ids: [], error: lastErr }
    }
  }
  return { ok: false, sent: 0, ids: [], error: lastErr || 'Resend batch: retries exhausted' }
}

/**
 * Render a basic, deliverability-safe HTML email.
 * Single column, 600px max, inline-style only (Gmail strips <head>/style tags).
 */
export function wrapEmailHTML(opts: {
  title: string
  body: string  // inner HTML content
  footer?: string
  unsubscribeUrl?: string
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHTML(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f8f7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="margin-bottom:20px;">
      <a href="${baseUrl}" style="color:#1a4d2e;font-size:18px;font-weight:600;text-decoration:none;">RaiseSEA</a>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;">
      ${opts.body}
    </div>
    <div style="margin-top:20px;font-size:11px;color:#888;line-height:1.5;text-align:center;">
      ${opts.footer || ''}
      ${opts.unsubscribeUrl ? `<br><a href="${opts.unsubscribeUrl}" style="color:#888;">Unsubscribe</a> · <a href="${baseUrl}/settings" style="color:#888;">Email preferences</a>` : ''}
    </div>
  </div>
</body>
</html>`
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
