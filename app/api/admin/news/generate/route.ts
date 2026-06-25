// ═══════════════════════════════════════════════════════════════
// POST /api/admin/news/generate
// Super admin clicks "Generate now" → triggers the RSS+DeepSeek pipeline.
// Items land in /admin/news for review.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/super-admin'
import { runNewsPipeline } from '@/lib/news-pipeline'

export const maxDuration = 300  // 5 min — RSS + DeepSeek can be slow

export async function POST() {
  const user = await getSessionUser()
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await runNewsPipeline()
  return NextResponse.json({ ok: true, ...result })
}
