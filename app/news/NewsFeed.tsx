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

type Trending = {
  sectors:   { name: string; count: number }[]
  investors: { name: string; count: number }[]
}

type TopStory = {
  id: string
  headline: string
  sector: string | null
  country: string | null
  coverage: number
  sources: { name: string; url: string }[]
}

type EditorsTake = {
  headline: string | null
  body: string | null
  takeaway: string | null
}

type Glance = {
  region: string
  country: string
  category: string
  industry: string
}

type Props = {
  items: Item[]
  userSectors: string[]
  editorsTake: EditorsTake | null
  trending: Trending
  topStories: TopStory[]
  glance: Glance
  dateRange: string
  weekStats: { dealCount: number; totalRaised: number; sectorCount: number }
}

const CATEGORIES = [
  { key: 'fundraising', label: 'Fundraising' },
  { key: 'tech',        label: 'Tech & product' },
  { key: 'policy',      label: 'Economic & policy' },
  { key: 'exit',        label: 'Exit market' },
] as const

function fmtUSD(n: number): string {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

export default function NewsFeed({ items, userSectors, editorsTake, trending, topStories, glance, dateRange, weekStats }: Props) {
  // Filters
  const [region, setRegion]     = useState<'all' | 'sea' | 'global'>('all')
  const [country, setCountry]   = useState<string>('all')
  const [category, setCategory] = useState<string>('all')
  const [sector, setSector]     = useState<string>('all')

  // Distinct filter values from items
  const allSectors   = useMemo(() => Array.from(new Set(items.map(i => i.sector).filter((s): s is string => !!s))).sort(), [items])
  // Countries available depend on the selected region (region↔country link)
  const allCountries = useMemo(() => {
    const pool = region === 'all' ? items : items.filter(i => (i.region_scope || 'sea') === region)
    return Array.from(new Set(pool.map(i => i.country).filter((c): c is string => !!c))).sort()
  }, [items, region])

  // If the selected country is no longer valid for the chosen region, reset it
  const countryValid = country === 'all' || allCountries.includes(country)
  const effectiveCountry = countryValid ? country : 'all'

  // Apply filters (AND logic)
  const filtered = useMemo(() => items.filter(i => {
    if (region !== 'all' && (i.region_scope || 'sea') !== region) return false
    if (effectiveCountry !== 'all' && i.country !== effectiveCountry) return false
    if (category !== 'all' && i.category !== category) return false
    if (sector !== 'all' && i.sector !== sector) return false
    return true
  }), [items, region, country, category, sector])

  // Group by category — SEA items first, then global, newest within each
  const byCategory = useMemo(() => {
    const out: Record<string, Item[]> = { fundraising: [], tech: [], policy: [], exit: [] }
    filtered.forEach(i => { if (out[i.category]) out[i.category].push(i) })
    const seaFirst = (a: Item, b: Item) => {
      const aw = (a.region_scope || 'sea') === 'sea' ? 0 : 1
      const bw = (b.region_scope || 'sea') === 'sea' ? 0 : 1
      if (aw !== bw) return aw - bw
      return (b.published_at || '').localeCompare(a.published_at || '')
    }
    for (const k of Object.keys(out)) out[k].sort(seaFirst)
    return out
  }, [filtered])

  const anyFilterActive = region !== 'all' || country !== 'all' || category !== 'all' || sector !== 'all'
  function resetFilters() { setRegion('all'); setCountry('all'); setCategory('all'); setSector('all') }

  // Export the currently-filtered items as CSV (opens directly in Excel — no dependency)
  function exportExcel() {
    const headers = ['Date', 'Headline', 'Category', 'Region', 'Country', 'Sector', 'Amount (USD)', 'Stage', 'Lead investor', 'Why it matters', 'Source', 'Link']
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = filtered.map(i => [
      i.published_at ? new Date(i.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
      i.company_name ? `${i.company_name}${i.amount_usd ? ' raised $' + (i.amount_usd / 1e6).toFixed(1) + 'M' : ''}` : i.title,
      i.category, i.region_scope || 'sea', i.country || '', i.sector || '',
      i.amount_usd || '', i.stage || '', i.lead_investor || '',
      i.ai_why_it_matters || '', i.source_name || '', i.source_url,
    ])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    // BOM so Excel reads UTF-8 (— and other chars) correctly
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `raisesea-news-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Weekly SEA Fundraising Digest</h1>
          <p className="text-sm text-gray-600 mt-1">{dateRange} · curated fundraising, tech, and policy news.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/news/history" className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap">
            🗓 Past weeks
          </Link>
          <button onClick={exportExcel} className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Editor's take — structured newsletter style */}
      {editorsTake && (editorsTake.headline || editorsTake.body) && (
        <div className="bg-gradient-to-br from-[#f4f9f5] to-white border border-[#1a4d2e]/20 rounded-xl p-5 mb-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#1a4d2e] mb-2">✍️ Editor&apos;s Take</div>
          {editorsTake.headline && (
            <h2 className="text-lg font-bold text-gray-900 leading-snug mb-2">{editorsTake.headline}</h2>
          )}
          {editorsTake.body && (
            <p className="text-sm text-gray-800 leading-relaxed mb-3">{editorsTake.body}</p>
          )}
          {editorsTake.takeaway && (
            <div className="bg-[#1a4d2e]/5 border-l-2 border-[#1a4d2e] rounded-r-md px-3 py-2">
              <span className="text-sm text-[#1a4d2e] font-medium">→ {editorsTake.takeaway}</span>
            </div>
          )}
        </div>
      )}

      {/* Top stories — most-covered this week (grouped across sources) */}
      {topStories.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-semibold text-gray-900">Top stories this week</h2>
            <span className="text-[10px] text-gray-500">most covered across sources</span>
          </div>
          <ol className="space-y-2.5">
            {topStories.map((s, idx) => (
              <li key={s.id} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{s.headline}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {s.sector && <span className="text-[10px] bg-white border border-border text-gray-600 px-1.5 py-0.5 rounded-full">{s.sector}</span>}
                    {s.country && <span className="text-[10px] bg-white border border-border text-gray-600 px-1.5 py-0.5 rounded-full">📍 {s.country}</span>}
                    {s.coverage >= 2 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{s.coverage} sources</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {s.sources.slice(0, 5).map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-[#1a4d2e] hover:underline">
                        {src.name} ↗
                      </a>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* This week at a glance */}
      <div className="bg-white border border-border rounded-xl p-5 mb-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">📊 This week at a glance</div>
        <div className="space-y-1.5 text-sm text-gray-700">
          {glance.region   && <p>🌏 {glance.region}</p>}
          {glance.country  && <p>📍 {glance.country}</p>}
          {glance.category && <p>🏷 {glance.category}</p>}
          {glance.industry && <p>⚡ {glance.industry}</p>}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <Stat label="Deals (7d)"        value={weekStats.dealCount.toString()} />
        <Stat label="Total raised (7d)" value={fmtUSD(weekStats.totalRaised)} />
        <Stat label="Active sectors"    value={weekStats.sectorCount.toString()} />
      </div>

      {/* Filters: region, country, category, sector */}
      <div className="bg-white border border-border rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filter</div>
          {anyFilterActive && (
            <button onClick={resetFilters} className="text-[11px] text-[#1a4d2e] hover:underline">Reset all</button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FilterSelect label="Region" value={region} onChange={v => { setRegion(v as 'all' | 'sea' | 'global'); setCountry('all') }}
            options={[['all', 'All regions'], ['sea', '🌏 SEA'], ['global', 'Global']]} />
          <FilterSelect label="Country" value={effectiveCountry} onChange={setCountry}
            options={[['all', 'All countries'], ...allCountries.map(c => [c, c] as [string, string])]} />
          <FilterSelect label="Category" value={category} onChange={setCategory}
            options={[['all', 'All types'], ['fundraising', 'Fundraising'], ['tech', 'Tech'], ['policy', 'Policy'], ['exit', 'Exit']]} />
          <FilterSelect label="Sector" value={sector} onChange={setSector}
            options={[['all', 'All sectors'], ...allSectors.map(s => [s, s] as [string, string])]} />
        </div>
        <div className="text-[11px] text-gray-500 mt-2">{filtered.length} stor{filtered.length === 1 ? 'y' : 'ies'} match</div>
      </div>

      {/* Sections — top 5 per category + show more */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center">
          <div className="text-3xl opacity-30 mb-2">📰</div>
          <h2 className="text-base font-semibold text-text-primary mb-1">Nothing matches</h2>
          <p className="text-sm text-gray-600">{anyFilterActive ? 'Try adjusting or resetting your filters.' : 'News will appear here once the super admin approves items.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const catItems = byCategory[cat.key]
            if (catItems.length === 0) return null
            return <CategorySection key={cat.key} label={cat.label} items={catItems} />
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-8">
        Showing approved items from the last 7 days. <Link href="/news/history" className="underline">Browse past weeks →</Link>
      </p>
    </div>
  )
}

// Collapsible category section: shows 5, "show more" reveals the rest
function CategorySection({ label, items }: { label: string; items: Item[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 5)
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {label} <span className="text-gray-400">({items.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {visible.map(item => <ItemCard key={item.id} item={item} />)}
      </div>
      {items.length > 5 && (
        <button onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-medium text-[#1a4d2e] hover:underline">
          {expanded ? '↑ Show less' : `↓ Show ${items.length - 5} more`}
        </button>
      )}
    </section>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-0.5">{value}</div>
    </div>
  )
}

// Sector → consistent color chip
const SECTOR_COLORS: Record<string, string> = {
  'AI/ML':        'bg-violet-100 text-violet-700',
  'Fintech':      'bg-emerald-100 text-emerald-700',
  'SaaS':         'bg-sky-100 text-sky-700',
  'E-commerce':   'bg-orange-100 text-orange-700',
  'Healthtech':   'bg-rose-100 text-rose-700',
  'Logistics':    'bg-amber-100 text-amber-700',
  'Edtech':       'bg-cyan-100 text-cyan-700',
  'Agritech':     'bg-lime-100 text-lime-700',
  'Cleantech':    'bg-green-100 text-green-700',
  'Deep Tech':    'bg-indigo-100 text-indigo-700',
  'Consumer':     'bg-pink-100 text-pink-700',
  'Cybersecurity':'bg-slate-200 text-slate-700',
  'Crypto/Web3':  'bg-yellow-100 text-yellow-800',
}

const CATEGORY_STYLE: Record<string, { label: string; cls: string }> = {
  fundraising: { label: '💰 Fundraising', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  tech:        { label: '⚡ Tech',        cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  policy:      { label: '🏛 Policy',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  exit:        { label: '🚪 Exit',        cls: 'bg-purple-50 text-purple-700 border-purple-200' },
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${className || 'bg-gray-100 text-gray-700'}`}>
      {children}
    </span>
  )
}

function fmtAbsoluteDate(iso: string | null): string {
  if (!iso) return 'Date unknown'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Date unknown'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function ItemCard({ item }: { item: Item }) {
  const headline = item.company_name
    ? `${item.company_name}${item.amount_usd ? ' raised $' + (item.amount_usd / 1e6).toFixed(1) + 'M' : ''}${item.stage ? ' · ' + item.stage : ''}`
    : item.title

  const cat = CATEGORY_STYLE[item.category]
  const sectorCls = item.sector ? (SECTOR_COLORS[item.sector] || 'bg-gray-100 text-gray-700') : ''
  const age = daysAgo(item.published_at)
  // Flag if outside the 7-day window (shouldn't happen, but visible verification)
  const outOfWindow = age !== null && age > 7

  return (
    <div className="bg-white border border-border rounded-xl p-4 hover:border-border-strong transition">
      {/* Top row: category badge + region + date */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {cat && (
            <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cat.cls}`}>
              {cat.label}
            </span>
          )}
          {item.region_scope === 'global' && (
            <Chip className="bg-blue-100 text-blue-700">🌏 Global</Chip>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] font-medium ${outOfWindow ? 'text-red-600' : 'text-gray-500'}`}>
            📅 {fmtAbsoluteDate(item.published_at)}
          </span>
          {age !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${outOfWindow ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
              {age === 0 ? 'today' : age === 1 ? '1d ago' : `${age}d ago`}
            </span>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="text-sm font-semibold text-gray-900 mb-2">{headline}</div>

      {/* Tag chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {item.country && <Chip className="bg-gray-100 text-gray-700">📍 {item.country}</Chip>}
        {item.sector && <Chip className={sectorCls}>{item.sector}</Chip>}
        {item.lead_investor && <Chip className="bg-gray-100 text-gray-600">🤝 {item.lead_investor}</Chip>}
      </div>

      {/* Why it matters */}
      {item.ai_why_it_matters && (
        <div className="text-sm text-gray-700 leading-relaxed mb-2.5">{item.ai_why_it_matters}</div>
      )}

      {/* Source */}
      <a href={item.source_url} target="_blank" rel="noopener noreferrer"
        className="text-xs text-[#1a4d2e] hover:underline font-medium">
        Read on {item.source_name || 'source'} →
      </a>
    </div>
  )
}
