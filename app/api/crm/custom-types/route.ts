import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Board } from '@/lib/crm'

type CustomTypes = { investor: string[]; general: string[] }
const EMPTY: CustomTypes = { investor: [], general: [] }

// GET /api/crm/custom-types — return the user's private custom types
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('user_profiles').select('crm_custom_types').eq('id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customTypes: (data?.crm_custom_types as CustomTypes | null) || EMPTY })
}

// POST /api/crm/custom-types — add a new type to the user's list
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { label?: string; board?: Board }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const label = (body.label || '').trim().slice(0, 80)
  if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 })
  if (body.board !== 'investor' && body.board !== 'general') {
    return NextResponse.json({ error: 'Invalid board' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles').select('crm_custom_types').eq('id', user.id).maybeSingle()
  const current = (profile?.crm_custom_types as CustomTypes | null) || EMPTY
  const list = current[body.board]
  if (list.includes(label)) {
    return NextResponse.json({ customTypes: current })  // already there, no-op
  }
  const next = { ...current, [body.board]: [...list, label].slice(0, 50) }

  const { error } = await supabaseAdmin
    .from('user_profiles').update({ crm_custom_types: next }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, customTypes: next })
}
