'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Item = {
  id: string
  category: string
  title: string
  company_name: string | null
  amount_usd: number | null
  stage: string | null
  sector: string | null
  country: string | null
  lead_investor: string | null
  source_url: string
  source_name: string | null
  ai_summary: string | null
  ai_why_it_matters: string | null
  published_at: string | null
  region_scope?: string | null
}

// Build the last 4 week-windows (each {label, startMs, endMs})
function buildWeeks() {
  const weeks: { key: string; label: string; startMs: number; endMs: number }[] = []
  const now = Date.now()
  for (let w = 0; w < 4; w++) {
    const endMs = now - w * 7 * 86400 * 1000
    const startMs = endMs - 7 * 86400 * 1000
    const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`
    const range = `${new Date(startMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    weeks.push({ key: `w${w}`, label: `${label} · ${range}`, startMs, endMs })
  }
  return weeks
}

const SECTOR_COLORS: Record<string, string> = {
  'AI/ML': 'bg-violet-100 text-violet-700', 'Fintech': 'bg-emerald-100 text-emerald-700',
  'SaaS': 'bg-sky-100 text-sky-700', 'E-commerce': 'bg-orange-100 text-orange-700',
  'Healthtech': 'bg-rose-100 text-rose-700', 'Logistics': 'bg-amber-100 text-amber-700',
  'Edtech': 'bg-cyan-100 text-cyan-700', 'Agritech': 'bg-lime-100 text-lime-700',
  'Cleantech': 'bg-green-100 text-green-700', 'Deep Tech': 'bg-indigo-100 text-indigo-700',
  'Consumer': 'bg-pink-100 text-pink-700', 'Cybersecurity': 'bg-slate-200 text-slate-700',
  'Crypto/Web3': 'bg-yellow-100 text-yellow-800',
}

// Token-AND search across the meaningful text fields (see NewsFeed for rationale).
function matchesQuery(item: Item, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const hay = [
    item.title, item.company_name, item.ai_summary, item.ai_why_it_matters,
    item.sector, item.country, item.lead_investor, item.source_name,
  ].filter(Boolean).join(' ').toLowerCase()
  return tokens.every(t => hay.includes(t))
}

function searchRank(item: Item, tokens: string[]): number {
  const strong = `${item.company_name || ''} ${item.title || ''}`.toLowerCase()
  let score = 0
  for (const t of tokens) if (strong.includes(t)) score++
  return score
}

export default function NewsHistory({ items }: { items: Item[] }) {
  const weeks = useMemo(buildWeeks, [])
  const [weekKey, setWeekKey] = useState('w1')  // default: last week (history)
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('all')
  const [country, setCountry] = useState('all')
  const [category, setCategory] = useState('all')
  const [sector, setSector] = useState('all')

  const tokens = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query])
  const searching = tokens.length > 0

  const allCountries = useMemo(() => Array.from(new Set(items.map(i => i.country).filter((c): c is string => !!c))).sort(), [items])
  const allSectors = useMemo(() => Array.from(new Set(items.map(i => i.sector).filter((s): s is string => !!s))).sort(), [items])

  const activeWeek = weeks.find(w => w.key === weekKey) || weeks[1]

  // While searching we span ALL loaded weeks (28d). Otherwise scope to the
  // selected week. Dropdowns always apply.
  const filtered = useMemo(() => {
    const list = items.filter(i => {
      if (!searching) {
        const ms = i.published_at ? new Date(i.published_at).getTime() : 0
        if (ms < activeWeek.startMs || ms >= activeWeek.endMs) return false
      }
      if (region !== 'all' && (i.region_scope || 'sea') !== region) return false
      if (country !== 'all' && i.country !== country) return false
      if (category !== 'all' && i.category !== category) return false
      if (sector !== 'all' && i.sector !== sector) return false
      if (!matchesQuery(i, tokens)) return false
      return true
    })
    if (searching) {
      list.sort((a, b) => {
        const r = searchRank(b, tokens) - searchRank(a, tokens)
        if (r !== 0) return r
        return (b.published_at || '').localeCompare(a.published_at || '')
      })
    }
    return list
  }, [items, activeWeek, region, country, category, sector, tokens, searching])

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">News history</h1>
          <p className="text-sm text-gray-600 mt-1">Browse the past 4 weeks of curated SEA + global news.</p>
        </div>
        <Link href="/news" className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap">← This week</Link>
      </div>

      {/* Week selector */}
      <div className={`flex flex-wrap items-center gap-1.5 mb-4 transition-opacity ${searching ? 'opacity-40 pointer-events-none' : ''}`}>
        {weeks.map(w => (
          <button key={w.key} onClick={() => setWeekKey(w.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
              weekKey === w.key ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-gray-700 border-border-strong hover:border-text-tertiary'
            }`}>
            {w.label}
          </button>
        ))}
        {searching && <span className="text-[11px] text-gray-500 ml-1">searching all weeks</span>}
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 mb-5">
        {/* Search spans all 4 loaded weeks */}
        <div className="relative mb-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Search all 4 weeks — company, investor, sector…"
            className="w-full text-xs border border-border-strong rounded-md pl-8 pr-8 py-2 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Sel label="Region" value={region} onChange={setRegion} options={[['all', 'All regions'], ['sea', '🌏 SEA'], ['global', 'Global']]} />
          <Sel label="Country" value={country} onChange={setCountry} options={[['all', 'All countries'], ...allCountries.map(c => [c, c] as [string, string])]} />
          <Sel label="Category" value={category} onChange={setCategory} options={[['all', 'All types'], ['fundraising', 'Fundraising'], ['tech', 'Tech'], ['policy', 'Policy'], ['exit', 'Exit']]} />
          <Sel label="Sector" value={sector} onChange={setSector} options={[['all', 'All sectors'], ...allSectors.map(s => [s, s] as [string, string])]} />
        </div>
        <div className="text-[11px] text-gray-500 mt-2">
          {searching
            ? `${filtered.length} result${filtered.length === 1 ? '' : 's'} for “${query.trim()}” across the last 4 weeks`
            : `${filtered.length} stor${filtered.length === 1 ? 'y' : 'ies'} in ${activeWeek.label.split(' · ')[0].toLowerCase()}`}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center">
          <div className="text-3xl opacity-30 mb-2">🗓</div>
          <p className="text-sm text-text-tertiary">
            {searching
              ? <>No stories match “{query.trim()}” in the last 4 weeks. <button onClick={() => setQuery('')} className="text-[#1a4d2e] underline">Clear search</button>.</>
              : 'Nothing in this week matches your filters. Try clearing some.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map(item => {
            const headline = item.company_name
              ? `${item.company_name}${item.amount_usd ? ' raised $' + (item.amount_usd / 1e6).toFixed(1) + 'M' : ''}${item.stage ? ' · ' + item.stage : ''}`
              : item.title
            const sectorCls = item.sector ? (SECTOR_COLORS[item.sector] || 'bg-gray-100 text-gray-700') : ''
            return (
              <div key={item.id} className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">{item.category}</span>
                  <span className="text-[11px] text-gray-500">
                    📅 {item.published_at ? new Date(item.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-900 mb-1.5">{headline}</div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {item.region_scope === 'global' && <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🌏 Global</span>}
                  {item.country && <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">📍 {item.country}</span>}
                  {item.sector && <span className={`text-[11px] px-2 py-0.5 rounded-full ${sectorCls}`}>{item.sector}</span>}
                </div>
                {item.ai_why_it_matters && <p className="text-sm text-gray-700 leading-relaxed mb-2">{item.ai_why_it_matters}</p>}
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1a4d2e] hover:underline font-medium">
                  Read on {item.source_name || 'source'} →
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-xs border border-border-strong rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  )
}
