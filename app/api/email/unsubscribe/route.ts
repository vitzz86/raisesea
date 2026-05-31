// ═══════════════════════════════════════════════════════════════
// GET /api/email/unsubscribe?u=<user_id>
// Footer link in emails — toggles email_digest_enabled to false.
// One-click (no signin required) since the email itself proves identity.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('u')
  if (!userId) return NextResponse.json({ error: 'Missing user' }, { status: 400 })

  await supabaseAdmin
    .from('user_profiles')
    .update({ email_digest_enabled: false })
    .eq('id', userId)

  // Render a confirmation page (HTML, no React needed)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Unsubscribed — RaiseSEA</title></head>
<body style="font-family:-apple-system,sans-serif;background:#f8f7f2;padding:60px 20px;text-align:center;">
  <h1 style="color:#1a4d2e;">You&apos;re unsubscribed</h1>
  <p style="color:#666;max-width:480px;margin:12px auto 24px;">
    You won&apos;t receive the weekly digest anymore. You can re-enable it anytime in your settings.
  </p>
  <a href="${baseUrl}/settings" style="display:inline-block;background:#1a4d2e;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">
    Open RaiseSEA settings
  </a>
</body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  )
}
