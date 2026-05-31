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
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[resend] send failed:', res.status, errBody.slice(0, 300))
      return { ok: false, error: `Resend ${res.status}: ${errBody.slice(0, 200)}` }
    }
    const data = await res.json() as { id: string }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[resend] threw:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
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
