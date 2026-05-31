// ═══════════════════════════════════════════════════════════════
// lib/crm.ts — Shared CRM types, stage definitions, type catalog.
// Single source of truth for both server + client.
// ═══════════════════════════════════════════════════════════════

export type Board = 'investor' | 'general'
export type Priority = 'high' | 'medium' | 'low'

export type Contact = {
  id: string
  user_id: string
  name: string
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  contact_type: string
  board: Board
  stage: string
  priority: Priority
  is_lost: boolean
  met_at_source: string | null
  met_at_details: string | null
  notes: string | null
  next_action: string | null
  next_action_date: string | null
  created_at: string
  updated_at: string
}

// ─── Pipeline stages, in order ──────────────────────────────────────
export const INVESTOR_STAGES = [
  { key: 'to_contact',        label: 'To contact' },
  { key: 'contacted',         label: 'Contacted' },
  { key: 'meeting_scheduled', label: 'Meeting scheduled' },
  { key: 'due_diligence',     label: 'Due diligence' },
  { key: 'term_sheet',        label: 'Term sheet' },
  { key: 'closed_won',        label: 'Closed-Won' },
] as const

export const GENERAL_STAGES = [
  { key: 'to_contact',        label: 'To contact' },
  { key: 'contacted',         label: 'Contacted' },
  { key: 'meeting_scheduled', label: 'Meeting scheduled' },
  { key: 'mou_signed',        label: 'MoU signed' },
  { key: 'deal_signed',       label: 'Deal signed' },
] as const

export function stagesFor(board: Board) {
  return board === 'investor' ? INVESTOR_STAGES : GENERAL_STAGES
}

export function stageLabel(board: Board, stageKey: string): string {
  const found = stagesFor(board).find(s => s.key === stageKey)
  return found?.label || stageKey
}

// ─── System contact types ──────────────────────────────────────────
// Each type has a label + which board it belongs to.
export const INVESTOR_TYPES = [
  { key: 'vc_fund',           label: 'VC fund' },
  { key: 'angel',             label: 'Angel investor' },
  { key: 'family_office',     label: 'Family office' },
  { key: 'corporate_vc',      label: 'Corporate VC' },
  { key: 'accelerator',       label: 'Accelerator / Incubator' },
  { key: 'government',        label: 'Government / Grant body' },
  { key: 'strategic',         label: 'Strategic investor' },
  { key: 'other_investor',    label: 'Other investor' },
] as const

export const GENERAL_TYPES = [
  { key: 'supplier',          label: 'Supplier / Vendor' },
  { key: 'partner',           label: 'Partner / Channel' },
  { key: 'customer',          label: 'Customer / Prospect' },
  { key: 'advisor',           label: 'Advisor / Mentor' },
  { key: 'service_provider',  label: 'Service provider' },
  { key: 'media',             label: 'Media / PR' },
  { key: 'talent',            label: 'Talent / Hire' },
  { key: 'other_contact',     label: 'Other contact' },
] as const

export function typeLabel(typeKey: string, customTypes?: { investor: string[]; general: string[] }): string {
  const all = [...INVESTOR_TYPES, ...GENERAL_TYPES]
  const found = all.find(t => t.key === typeKey)
  if (found) return found.label
  // Custom types use their label directly as the key
  if (customTypes) {
    if (customTypes.investor.includes(typeKey)) return typeKey
    if (customTypes.general.includes(typeKey)) return typeKey
  }
  return typeKey
}

export function boardForType(typeKey: string, customTypes?: { investor: string[]; general: string[] }): Board {
  if (INVESTOR_TYPES.some(t => t.key === typeKey)) return 'investor'
  if (GENERAL_TYPES.some(t => t.key === typeKey)) return 'general'
  if (customTypes?.investor.includes(typeKey)) return 'investor'
  return 'general'  // default for unknowns / custom general types
}

// ─── Source dropdown ───────────────────────────────────────────────
export const SOURCES = [
  { key: 'event',         label: 'Event / Conference' },
  { key: 'linkedin',      label: 'LinkedIn' },
  { key: 'warm_intro',    label: 'Warm intro' },
  { key: 'cold_outreach', label: 'Cold outreach (you reached out)' },
  { key: 'inbound',       label: 'Inbound (they reached out)' },
  { key: 'network',       label: 'Existing network' },
  { key: 'referral',      label: 'Referral' },
  { key: 'card_scan',     label: 'Business card scan' },
  { key: 'other',         label: 'Other' },
] as const

export function sourceLabel(srcKey: string | null): string {
  if (!srcKey) return ''
  return SOURCES.find(s => s.key === srcKey)?.label || srcKey
}

export function sourcePlaceholder(srcKey: string | null): string {
  switch (srcKey) {
    case 'event':         return 'e.g. Kumpul 2025, Echelon Asia, Tech in Asia'
    case 'linkedin':      return 'e.g. Replied to my post about Series A'
    case 'warm_intro':    return 'e.g. Introduced by John Smith at Acme'
    case 'cold_outreach': return 'e.g. Sent via my website form'
    case 'inbound':       return 'e.g. Reached out via my website'
    case 'referral':      return 'e.g. Referred by Maria from Sequoia'
    case 'card_scan':     return 'Auto-filled with scan date'
    default:              return 'Add any extra context'
  }
}

// ─── Helpers ───────────────────────────────────────────────────────
export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }
export const PRIORITY_DOT: Record<Priority, string>   = { high: '🔴', medium: '🟡', low: '🟢' }
