#!/usr/bin/env tsx

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

type Command = 'status' | 'latest' | 'weekly' | 'search' | 'coverage' | 'edit' | 'delist' | 'restore'

function loadRuntimeEnvironment() {
  const candidates = [process.env.NEWS_ENV_FILE, '/opt/data/.env', resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')]
    .filter((candidate): candidate is string => Boolean(candidate))
  const envFile = candidates.find(existsSync)
  if (envFile) process.loadEnvFile(envFile)
}

function args(): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {}
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue
    const [key, ...rest] = arg.slice(2).split('=')
    parsed[key] = rest.length > 0 ? rest.join('=') : true
  }
  return parsed
}

function text(value: string | boolean | undefined): string | null {
  return typeof value === 'string' ? value.trim() : null
}

function nullable(value: string | boolean | undefined): string | null | undefined {
  const parsed = text(value)
  if (parsed === null) return undefined
  return parsed || null
}

function requireConfirmation(input: Record<string, string | boolean>) {
  if (input.confirm !== true) {
    throw new Error('Mutation blocked: repeat with --confirm after the operator explicitly confirms the exact item ID and change.')
  }
}

async function main() {
  loadRuntimeEnvironment()
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY']) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)
  }

  const input = args()
  const command = text(input.command) as Command | null
  if (!command || !['status', 'latest', 'weekly', 'search', 'coverage', 'edit', 'delist', 'restore'].includes(command)) {
    throw new Error('Use --command=status|latest|weekly|search|coverage|edit|delist|restore')
  }
  const { supabaseAdmin } = await import('../lib/supabase')

  if (command === 'status') {
    const { data, error } = await supabaseAdmin.from('news_pipeline_runs')
      .select('run_key, mode, status, started_at, completed_at, stats, error_message')
      .order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    console.log(JSON.stringify({ ok: true, command, run: data }, null, 2))
    return
  }

  if (command === 'latest' || command === 'search') {
    const limit = Math.min(20, Math.max(1, Number(text(input.limit) || 8)))
    const { data, error } = await supabaseAdmin.from('news_items')
      .select('id, title, category, company_name, amount_usd, sector, country, source_name, source_url, ai_summary, ai_why_it_matters, published_at, region_scope')
      .eq('status', 'approved').order('published_at', { ascending: false }).limit(command === 'search' ? 250 : limit)
    if (error) throw error
    const query = (text(input.query) || '').toLowerCase()
    if (command === 'search' && !query) throw new Error('Search requires --query=<keywords>')
    const items = command === 'search'
      ? (data || []).filter(item => [item.title, item.company_name, item.sector, item.country, item.ai_summary]
          .filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, limit)
      : (data || [])
    console.log(JSON.stringify({ ok: true, command, count: items.length, items }, null, 2))
    return
  }

  if (command === 'weekly') {
    const { data, error } = await supabaseAdmin.from('editors_takes')
      .select('id, week_starting, headline, body, takeaway, top_stories, created_at')
      .eq('status', 'approved').order('week_starting', { ascending: false })
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    console.log(JSON.stringify({ ok: true, command, editorial: data }, null, 2))
    return
  }

  if (command === 'coverage') {
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
    const { data, error } = await supabaseAdmin.from('news_items')
      .select('region_scope, country, category, sector').eq('status', 'approved').gte('published_at', since)
    if (error) throw error
    const countBy = (field: 'region_scope' | 'country' | 'category' | 'sector') =>
      Object.entries((data || []).reduce<Record<string, number>>((acc, row) => {
        const key = String(row[field] || 'Unknown')
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})).sort((a, b) => b[1] - a[1])
    console.log(JSON.stringify({ ok: true, command, windowDays: 7, total: data?.length || 0,
      byRegion: countBy('region_scope'), byCountry: countBy('country'),
      byCategory: countBy('category'), bySector: countBy('sector') }, null, 2))
    return
  }

  const id = text(input.id)
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) throw new Error('A valid --id=<news UUID> is required')
  requireConfirmation(input)

  if (command === 'delist' || command === 'restore') {
    const updates = command === 'delist'
      ? { status: 'rejected', reject_reason: 'telegram_delist' }
      : { status: 'approved', reject_reason: null, approved_at: new Date().toISOString(), approved_by: null }
    const { data, error } = await supabaseAdmin.from('news_items').update(updates).eq('id', id)
      .select('id, title, status').maybeSingle()
    if (error) throw error
    if (!data) throw new Error(`No news item found for ID ${id}`)
    console.log(JSON.stringify({ ok: true, command, item: data }, null, 2))
    return
  }

  const updates: Record<string, string | number | null> = {}
  const aliases = { title: 'title', category: 'category', company: 'company_name', stage: 'stage', sector: 'sector',
    country: 'country', 'lead-investor': 'lead_investor', summary: 'ai_summary', why: 'ai_why_it_matters' } as const
  for (const [argument, column] of Object.entries(aliases)) {
    const value = nullable(input[argument])
    if (value !== undefined) updates[column] = value
  }
  if (input.amount !== undefined) {
    const amount = text(input.amount)
    if (!amount) updates.amount_usd = null
    else if (Number.isFinite(Number(amount)) && Number(amount) >= 0) updates.amount_usd = Math.round(Number(amount))
    else throw new Error('--amount must be a non-negative USD number')
  }
  if (updates.category && !['fundraising', 'tech', 'policy', 'exit'].includes(String(updates.category))) {
    throw new Error('--category must be fundraising, tech, policy, or exit')
  }
  if (Object.keys(updates).length === 0) throw new Error('Edit requires at least one supported field')

  const { data, error } = await supabaseAdmin.from('news_items').update(updates).eq('id', id)
    .select('id, title, status, category, company_name, amount_usd, sector, country, ai_summary, ai_why_it_matters').maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No news item found for ID ${id}`)
  console.log(JSON.stringify({ ok: true, command, changedFields: Object.keys(updates), item: data }, null, 2))
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
})
