// ═══════════════════════════════════════════════════════════════
// lib/emails/welcome.ts
//
// Welcome email sent on first sign-in. One-shot via user_metadata
// flag (welcome_sent=true) — fully idempotent, no DB migration.
//
// Voice: Sharp Friend — direct, no marketing fluff, no exclamation
// marks, no "Welcome aboard! 🎉". The reader is a busy founder.
// ═══════════════════════════════════════════════════════════════

import { sendEmail, wrapEmailHTML } from '@/lib/resend'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function sendWelcomeEmail(to: string, displayName?: string | null): Promise<{ ok: boolean; error?: string }> {
  const firstName = displayName ? displayName.split(/[\s@]/)[0] : 'there'

  // Plain-text body (fallback for clients that block HTML)
  const text = `Hi ${firstName},

Welcome to RaiseSEA. You've got a deck. Here's how to put it to work.

1. Analyze your deck (60 seconds)
   ${BASE_URL}/apply
   Score out of 100, market sizing benchmarked on SEA raises, 750+ matched investors.

2. Practice your pitch (out loud)
   ${BASE_URL}/mock-pitch
   AI listens, scores delivery, asks the hard questions before a real investor does.

3. Track every conversation
   ${BASE_URL}/crm
   Built-in CRM. No more spreadsheet you forget to update.

Reply to this email if anything breaks or you're stuck.

— RaiseSEA

P.S. If you don't know what a SAFE, TAM, or burn rate is — we built a glossary in plain English.
${BASE_URL}/glossary
`

  // HTML body (rendered through wrapEmailHTML)
  const body = `
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0d1f14;letter-spacing:-0.01em;">
  Welcome to RaiseSEA, ${escapeHTML(firstName)}.
</h1>

<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3d5045;">
  You've got a deck. Here's how to put it to work.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  ${stepRow({ num: '1', title: 'Analyze your deck', body: 'Score out of 100, market sizing benchmarked on SEA raises, 750+ matched investors. 60 seconds.', cta: 'Analyze →', href: `${BASE_URL}/apply` })}
  ${stepRow({ num: '2', title: 'Practice your pitch', body: 'AI listens, scores delivery, asks the hard questions before a real investor does.', cta: 'Practice →', href: `${BASE_URL}/mock-pitch` })}
  ${stepRow({ num: '3', title: 'Track every conversation', body: 'Built-in CRM tuned for fundraising. Stages, next actions, notes — no more spreadsheet.', cta: 'Open CRM →', href: `${BASE_URL}/crm` })}
</table>

<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#3d5045;">
  Reply to this email if anything breaks or you're stuck.
</p>

<div style="margin-top:20px;padding-top:20px;border-top:1px solid #e3eae5;">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7d6e;">
    <strong style="color:#0d1f14;">P.S.</strong> If you don't know what a SAFE, TAM, or burn rate is — we built a glossary in plain English.
    <a href="${BASE_URL}/glossary" style="color:#1a4d2e;text-decoration:underline;">${BASE_URL}/glossary</a>
  </p>
</div>
`

  const html = wrapEmailHTML({
    title: 'Welcome to RaiseSEA',
    body,
    footer: 'You\'re receiving this because you signed up for RaiseSEA.',
  })

  const res = await sendEmail({
    to,
    subject: 'Welcome to RaiseSEA — let\'s get your raise moving',
    html,
    text,
    tags: [{ name: 'type', value: 'welcome' }],
  })

  return { ok: res.ok, error: res.error }
}

// ─── Helpers ───────────────────────────────────────────────────────

function stepRow({ num, title, body, cta, href }: { num: string; title: string; body: string; cta: string; href: string }): string {
  return `
<tr>
  <td style="padding:0 0 14px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f7f5;border:1px solid #d4dfd7;border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;width:30px;vertical-align:top;">
          <div style="width:24px;height:24px;background:#1a4d2e;color:#ffffff;border-radius:50%;font-size:13px;font-weight:600;text-align:center;line-height:24px;">${num}</div>
        </td>
        <td style="padding:14px 16px 14px 0;vertical-align:top;">
          <div style="font-size:15px;font-weight:600;color:#0d1f14;margin-bottom:4px;">${escapeHTML(title)}</div>
          <div style="font-size:13px;line-height:1.55;color:#3d5045;margin-bottom:8px;">${escapeHTML(body)}</div>
          <a href="${href}" style="font-size:13px;color:#1a4d2e;text-decoration:none;font-weight:500;">${escapeHTML(cta)}</a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
