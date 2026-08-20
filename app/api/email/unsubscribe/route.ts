import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validate(userId: string | null, token: string | null): userId is string {
  return !!(userId && token && UUID.test(userId) && verifyUnsubscribeToken(userId, token))
}

function page(content: string, status = 200) {
  return new NextResponse(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Email preferences — RaiseSEA</title></head>
<body style="font-family:-apple-system,sans-serif;background:#f8f7f2;padding:60px 20px;text-align:center;">
  <main style="max-width:480px;margin:auto;background:white;border:1px solid #e5e2da;border-radius:12px;padding:32px;">${content}</main>
</body></html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

// GET is intentionally confirmation-only. Email security scanners often open
// every link; a GET must not silently change a user's subscription.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('u')
  const token = url.searchParams.get('t')
  if (!validate(userId, token)) {
    return page('<h1 style="color:#1a4d2e;">Invalid or expired link</h1><p style="color:#666;">Open email preferences from your RaiseSEA settings.</p>', 400)
  }

  return page(`
    <h1 style="color:#1a4d2e;margin-top:0;">Stop weekly digests?</h1>
    <p style="color:#666;">Confirm below. You can re-enable them later in settings.</p>
    <form method="post">
      <input type="hidden" name="u" value="${userId}">
      <input type="hidden" name="t" value="${token}">
      <button type="submit" style="border:0;background:#1a4d2e;color:white;padding:11px 20px;border-radius:6px;font-size:14px;cursor:pointer;">Confirm unsubscribe</button>
    </form>`)
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const userId = form?.get('u')?.toString() || null
  const token = form?.get('t')?.toString() || null
  if (!validate(userId, token)) {
    return page('<h1 style="color:#1a4d2e;">Invalid or expired link</h1><p style="color:#666;">Open email preferences from your RaiseSEA settings.</p>', 400)
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ email_digest_enabled: false })
    .eq('id', userId)
  if (error) return page('<h1>Something went wrong</h1><p>Please try again from settings.</p>', 500)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.raisesea.com'
  return page(`
    <h1 style="color:#1a4d2e;margin-top:0;">You’re unsubscribed</h1>
    <p style="color:#666;">You won’t receive the weekly digest anymore.</p>
    <a href="${baseUrl}/settings" style="display:inline-block;background:#1a4d2e;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Open RaiseSEA settings</a>`)
}
