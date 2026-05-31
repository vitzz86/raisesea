import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { boardForType, INVESTOR_STAGES, GENERAL_STAGES, type Board, type Priority } from '@/lib/crm'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

// GET /api/crm/contacts — list the user's contacts
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('crm_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data || [] })
}

// POST /api/crm/contacts — create a new contact
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = String(body.name || '').trim().slice(0, 120)
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const contactType = String(body.contact_type || 'other_contact').slice(0, 80)

  // Pull custom types so we can place the card on the right board
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('crm_custom_types')
    .eq('id', user.id)
    .maybeSingle()
  const customTypes = (profile?.crm_custom_types as { investor: string[]; general: string[] } | null) || { investor: [], general: [] }

  // Allow caller to override board (useful for custom types); otherwise infer
  const board: Board = body.board === 'investor' || body.board === 'general'
    ? body.board
    : boardForType(contactType, customTypes)

  const stage = String(body.stage || 'to_contact')
  const validStages = (board === 'investor' ? INVESTOR_STAGES : GENERAL_STAGES).map(s => s.key)
  if (!validStages.includes(stage as typeof validStages[number])) {
    return NextResponse.json({ error: 'Invalid stage for board' }, { status: 400 })
  }

  const priority = (PRIORITIES.includes(body.priority as Priority) ? body.priority : 'medium') as Priority

  const row = {
    user_id:           user.id,
    name,
    title:             String(body.title || '').slice(0, 120) || null,
    company:           String(body.company || '').slice(0, 120) || null,
    email:             String(body.email || '').slice(0, 200) || null,
    phone:             String(body.phone || '').slice(0, 60) || null,
    linkedin_url:      String(body.linkedin_url || '').slice(0, 300) || null,
    contact_type:      contactType,
    board,
    stage,
    priority,
    is_lost:           Boolean(body.is_lost),
    met_at_source:     String(body.met_at_source || '').slice(0, 60) || null,
    met_at_details:    String(body.met_at_details || '').slice(0, 200) || null,
    notes:             String(body.notes || '').slice(0, 10000) || null,
    next_action:       String(body.next_action || '').slice(0, 200) || null,
    next_action_date:  body.next_action_date ? String(body.next_action_date).slice(0, 10) : null,
  }

  const { data, error } = await supabaseAdmin.from('crm_contacts').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}
