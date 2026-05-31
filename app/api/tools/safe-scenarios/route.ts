import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/tools/safe-scenarios — list the user's saved scenarios
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('safe_scenarios')
    .select('id, name, instrument, inputs, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenarios: data || [] })
}

// POST /api/tools/safe-scenarios — save a new scenario
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; instrument?: string; inputs?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = (body.name || '').trim().slice(0, 120)
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  // Whitelist of valid instruments — keep in sync with v18 migration's CHECK constraint
  const VALID_INSTRUMENTS = ['safe_post', 'safe_pre', 'note', 'equity', 'debt'] as const
  if (!VALID_INSTRUMENTS.includes((body.instrument || '') as typeof VALID_INSTRUMENTS[number])) {
    return NextResponse.json({ error: 'Invalid instrument' }, { status: 400 })
  }
  if (!body.inputs || typeof body.inputs !== 'object') {
    return NextResponse.json({ error: 'Inputs required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('safe_scenarios')
    .insert({ user_id: user.id, name, instrument: body.instrument, inputs: body.inputs })
    .select('id, name, instrument, inputs, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scenario: data })
}

// DELETE /api/tools/safe-scenarios?id=... — delete a saved scenario
export async function DELETE(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('safe_scenarios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)  // RLS-safe: only own rows
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
