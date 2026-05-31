import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { sendWeeklyDigest } from '@/lib/digest-builder'

export const maxDuration = 30

// GET /api/admin/news/preview-digest
// Returns the rendered digest HTML (for the admin's own profile) so the admin
// can preview EXACTLY what subscribers will see — without sending any email.
export async function GET() {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // dryRun returns the plan + a sample rendered HTML; we ask it to include HTML
  const result = await sendWeeklyDigest({ triggeredBy: 'manual_admin', dryRun: true, returnHtml: true })

  if (!result.previewHtml) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;color:#666;">
        <h2>No preview available</h2>
        <p>There are no approved items in the last 7 days, or no subscribers. Approve some items + an editor's take first.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Return the raw HTML so it renders in the browser tab
  return new NextResponse(result.previewHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
