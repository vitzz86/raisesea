import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id: requestId } = await context.params
  let body: { reason?: string }
  try { body = await req.json() } catch { body = {} }
  const reason = (body.reason || '').trim().slice(0, 1000) || null

  const { data: mr } = await supabaseAdmin
    .from('meeting_requests')
    .select('id, status, vc_profile_id, founder_user_id')
    .eq('id', requestId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (mr.status !== 'pending') return NextResponse.json({ error: 'Already resolved' }, { status: 400 })

  // Verify VC owns it
  const { data: vcProfile } = await supabaseAdmin
    .from('vc_profiles')
    .select('user_id')
    .eq('id', mr.vc_profile_id)
    .maybeSingle()
  if (!vcProfile || vcProfile.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('meeting_requests')
    .update({
      status:           'declined',
      vc_response: reason,
      vc_responded_at:   new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify founder of decline
  try {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const founderUser = authUsers?.users.find(u => u.id === mr.founder_user_id)
    if (founderUser?.email) {
      const { sendEmail, wrapEmailHTML } = await import('@/lib/resend')
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const { data: vc } = await supabaseAdmin.from('vc_profiles').select('display_name, fund_or_firm').eq('id', mr.vc_profile_id).maybeSingle()
      const emailBody = `
<h2 style="font-size:18px;margin:0 0 12px 0;color:#1a1a1a;">Meeting request response</h2>
<p style="font-size:14px;color:#333;margin:0 0 12px 0;">
  Unfortunately <strong>${vc?.display_name || 'the expert'}</strong>${vc?.fund_or_firm ? ' from ' + vc.fund_or_firm : ''} can&apos;t take this meeting.
</p>
${reason ? `<div style="background:#f8f7f2;border-radius:8px;padding:14px;margin:0 0 12px 0;">
  <div style="font-size:11px;text-transform:uppercase;color:#888;margin-bottom:4px;">Their note</div>
  <div style="font-size:14px;color:#1a1a1a;white-space:pre-wrap;">${reason.replace(/[<>&"]/g, '')}</div>
</div>` : ''}
<p style="font-size:13px;color:#666;margin:0 0 16px 0;">You can always request a meeting with another expert.</p>
<a href="${baseUrl}/meet" style="display:inline-block;background:#1a4d2e;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">Browse experts →</a>`
      await sendEmail({
        to: founderUser.email,
        subject: `Meeting request response from ${vc?.display_name || 'expert'}`,
        html: wrapEmailHTML({ title: 'Meeting request response', body: emailBody, unsubscribeUrl: `${baseUrl}/api/email/unsubscribe?u=${founderUser.id}` }),
        text: `${vc?.display_name || 'The expert'} can't take this meeting. ${reason || ''}`,
        tags: [{ name: 'category', value: 'meeting_declined' }],
      })
    }
  } catch (err) {
    console.error('[meetings/decline] email send failed:', err)
  }

  console.log(`[meetings] ${user.email} declined meeting ${requestId}: ${reason || '(no reason)'}`)
  return NextResponse.json({ ok: true })
}
