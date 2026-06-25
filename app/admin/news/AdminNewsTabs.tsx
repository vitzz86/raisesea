'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategorizedTopStories, TopStory as AITopStory, TopStoryCategory } from '@/lib/news-clustering'

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
  status: string
  published_at: string | null
  created_at: string
}

type Take = {
  id: string
  week_starting: string
  content: string
  headline?: string | null
  takeaway?: string | null
  top_stories?: CategorizedTopStories | null
  status: string
  created_at: string
}

type Tab = 'queue' | 'editor' | 'send'

type Subscriber = { id: string; email: string; full_name: string | null; sectors: string[] }

const CATEGORIES = ['fundraising', 'tech', 'policy', 'exit'] as const

export default function AdminNewsTabs({
  initialTab,
  items,
  takes,
  subscriberCount,
  subscribers,
}: {
  initialTab: Tab
  items: Item[]
  takes: Take[]
  subscriberCount: number
  subscribers: Subscriber[]
}) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-5">
        <TabBtn active={tab === 'queue'}  onClick={() => setTab('queue')}>Review queue ({items.filter(i => i.status === 'pending').length})</TabBtn>
        <TabBtn active={tab === 'editor'} onClick={() => setTab('editor')}>Editor&apos;s take</TabBtn>
        <TabBtn active={tab === 'send'}   onClick={() => setTab('send')}>Send digest</TabBtn>
      </div>

      {tab === 'queue'  && <QueueTab items={items} />}
      {tab === 'editor' && <EditorTab takes={takes} />}
      {tab === 'send'   && <SendTab subscriberCount={subscriberCount} subscribers={subscribers} approvedItems={items.filter(i => i.status === 'approved')} takes={takes} />}
    </div>
  )
}

function TopStoriesPreview({ stories }: { stories?: CategorizedTopStories | null }) {
  const order: { key: TopStoryCategory; label: string }[] = [
    { key: 'fundraising', label: '💰 Fundraising' },
    { key: 'tech',        label: '⚡ Tech' },
    { key: 'policy',      label: '🏛 Policy' },
    { key: 'exit',        label: '🚪 Exit' },
  ]
  const present = stories ? order.filter(o => stories[o.key]) : []
  if (present.length === 0) {
    return (
      <div className="text-[11px] text-text-tertiary mb-3">
        No AI top stories attached to this take{stories === undefined ? ' (generated before this feature)' : ''}.
      </div>
    )
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-2">🔥 Top stories (per category)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {present.map(({ key, label }) => {
          const s = stories![key] as AITopStory
          return (
            <div key={key} className="bg-white border border-amber-100 rounded p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">{label}</div>
              <div className="text-xs font-semibold text-text-primary leading-snug">{s.headline}</div>
              {s.why && <p className="text-[11px] text-text-secondary leading-relaxed mt-1">{s.why}</p>}
              <div className="text-[10px] text-text-tertiary mt-1">
                {[s.sector, s.country].filter(Boolean).join(' · ')}{s.coverage >= 2 ? ` · ${s.coverage} sources` : ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`text-sm px-3 py-2 border-b-2 transition ${active ? 'border-brand text-brand font-medium' : 'border-transparent text-text-tertiary hover:text-text-primary'}`}>
      {children}
    </button>
  )
}

// ─── Review queue tab ─────────────────────────────────────────

function QueueTab({ items }: { items: Item[] }) {
  const router = useRouter()
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [generating, setGenerating] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)

  // All sectors present in the current items (for the filter dropdown)
  const availableSectors = Array.from(
    new Set(items.map(i => i.sector).filter((s): s is string => !!s))
  ).sort()

  const filtered = items.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
    if (sectorFilter !== 'all' && i.sector !== sectorFilter) return false
    return true
  })

  // Pending items in the CURRENT filtered view — these are what "Approve all" acts on
  const pendingInView = filtered.filter(i => i.status === 'pending')

  async function generateNow() {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/news/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generate failed')
      alert(`Pipeline done: ${data.new} new items, ${data.skipped} skipped, ${data.errors} errors`)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setGenerating(false)
    }
  }

  async function approveAll() {
    if (pendingInView.length === 0) return
    const label = sectorFilter !== 'all' || categoryFilter !== 'all'
      ? `${pendingInView.length} pending item(s) in the current filter`
      : `all ${pendingInView.length} pending item(s)`
    if (!confirm(`Approve ${label}? You can still reject individual items afterward.`)) return
    setApprovingAll(true)
    try {
      const res = await fetch('/api/admin/news/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingInView.map(i => i.id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk approve failed')
      alert(`Approved ${data.approved} item(s).`)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setApprovingAll(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={generateNow} disabled={generating}
          className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-3 py-1.5 disabled:opacity-50">
          {generating ? 'Generating…' : '⚡ Generate now (fetch RSS + extract)'}
        </button>
        {pendingInView.length > 0 && (
          <button onClick={approveAll} disabled={approvingAll}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md px-3 py-1.5 disabled:opacity-50">
            {approvingAll ? 'Approving…' : `✓ Approve all (${pendingInView.length})`}
          </button>
        )}
        <div className="flex-1" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-border-strong rounded-md px-2 py-1">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All statuses</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs border border-border-strong rounded-md px-2 py-1">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          className="text-xs border border-border-strong rounded-md px-2 py-1">
          <option value="all">All industries</option>
          {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-sm text-text-tertiary">
          Nothing in this view. Click &quot;Generate now&quot; to fetch news.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => <ItemRow key={item.id} item={item} onChange={() => router.refresh()} />)}
        </div>
      )}
    </>
  )
}

function ItemRow({ item, onChange }: { item: Item; onChange: () => void }) {
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [why, setWhy] = useState(item.ai_why_it_matters || '')

  async function patch(updates: Record<string, unknown>) {
    setWorking(true)
    try {
      const res = await fetch(`/api/admin/news/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      onChange()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally { setWorking(false) }
  }

  async function destroy() {
    if (!confirm('Delete this item permanently?')) return
    setWorking(true)
    try {
      const res = await fetch(`/api/admin/news/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onChange()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally { setWorking(false) }
  }

  const statusBadge = item.status === 'approved' ? 'bg-green-100 text-success-text'
    : item.status === 'rejected' ? 'bg-red-100 text-danger-text'
    : 'bg-warning-bg text-warning-text'

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-primary">
            {item.company_name ? `${item.company_name}${item.amount_usd ? ' — $' + (item.amount_usd / 1e6).toFixed(1) + 'M' : ''}` : item.title}
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {[item.category, item.sector, item.country, item.stage, item.lead_investor && 'led by ' + item.lead_investor, item.source_name].filter(Boolean).join(' · ')}
          </div>
          {/* Publish date + 7-day window check */}
          {(() => {
            const d = item.published_at ? new Date(item.published_at) : null
            const valid = d && !isNaN(d.getTime())
            const days = valid ? Math.floor((Date.now() - d!.getTime()) / 86400000) : null
            const outOfWindow = days !== null && days > 7
            return (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[11px] ${outOfWindow ? 'text-danger-text font-medium' : 'text-text-tertiary'}`}>
                  📅 {valid ? d!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'date unknown'}
                </span>
                {days !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${outOfWindow ? 'bg-red-100 text-danger-text' : 'bg-green-100 text-success-text'}`}>
                    {outOfWindow ? `⚠ ${days}d ago (outside 7d)` : days === 0 ? 'today' : `${days}d ago ✓`}
                  </span>
                )}
              </div>
            )
          })()}
        </div>
        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${statusBadge}`}>{item.status}</span>
      </div>

      {item.ai_summary && (
        <div className="text-xs text-text-tertiary mb-2"><strong>Summary:</strong> {item.ai_summary}</div>
      )}

      {editing ? (
        <div className="mb-2">
          <textarea value={why} onChange={e => setWhy(e.target.value)} rows={3}
            className="w-full text-xs border border-border-strong rounded-md p-2 focus:outline-none focus:border-brand" />
          <div className="flex gap-2 mt-1">
            <button onClick={() => { patch({ ai_why_it_matters: why }); setEditing(false) }}
              className="text-xs bg-brand text-white rounded px-2 py-1">Save</button>
            <button onClick={() => { setWhy(item.ai_why_it_matters || ''); setEditing(false) }}
              className="text-xs text-text-tertiary">Cancel</button>
          </div>
        </div>
      ) : (
        item.ai_why_it_matters && (
          <div className="text-xs text-text-primary bg-surface-muted border border-gray-100 rounded-md p-2 mb-2">
            <strong>Why it matters:</strong> {item.ai_why_it_matters}
          </div>
        )
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 flex-wrap">
        <a href={item.source_url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-brand underline">Source ↗</a>
        <div className="flex-1" />
        {item.status === 'pending' && (
          <>
            <button onClick={() => patch({ status: 'approved' })} disabled={working}
              className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 disabled:opacity-50">
              ✓ Approve
            </button>
            <button onClick={() => setEditing(true)} disabled={working}
              className="text-xs border border-border-strong hover:border-text-tertiary rounded px-2 py-1">
              ✏ Edit
            </button>
            <button onClick={() => patch({ status: 'rejected' })} disabled={working}
              className="text-xs border border-red-300 text-danger-text hover:bg-danger-bg rounded px-2 py-1">
              ✗ Reject
            </button>
          </>
        )}
        {item.status !== 'pending' && (
          <>
            <button onClick={() => patch({ status: 'pending' })} disabled={working}
              className="text-xs text-text-tertiary hover:underline">↩ Reopen</button>
            <button onClick={destroy} disabled={working}
              className="text-xs text-danger-text hover:underline">🗑 Delete</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Editor's take tab ────────────────────────────────────────

function EditorTab({ takes }: { takes: Take[] }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)

  async function generate() {
    setWorking(true)
    try {
      const res = await fetch('/api/admin/news/editors-take', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generate failed')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally { setWorking(false) }
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    setWorking(true)
    try {
      const res = await fetch('/api/admin/news/editors-take', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally { setWorking(false) }
  }

  return (
    <>
      <div className="mb-4">
        <button onClick={generate} disabled={working}
          className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-3 py-1.5 disabled:opacity-50">
          {working ? 'Generating…' : 'Generate new take (DeepSeek)'}
        </button>
        <p className="text-xs text-text-tertiary mt-1.5">Pulls last 7 days of approved items to write 3-5 sentence opinion.</p>
      </div>

      {takes.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-text-tertiary">
          No takes yet. Click &quot;Generate new take&quot; to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {takes.map(t => <TakeRow key={t.id} take={t} onPatch={patch} working={working} />)}
        </div>
      )}
    </>
  )
}

function TakeRow({ take, onPatch, working }: { take: Take; onPatch: (id: string, updates: Record<string, unknown>) => void; working: boolean }) {
  const [editing, setEditing] = useState(false)
  const [headline, setHeadline] = useState(take.headline || '')
  const [body, setBody] = useState(take.content || '')
  const [takeaway, setTakeaway] = useState(take.takeaway || '')

  const badge = take.status === 'approved' ? 'bg-green-100 text-success-text'
    : take.status === 'rejected' ? 'bg-red-100 text-danger-text'
    : 'bg-warning-bg text-warning-text'

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs text-text-tertiary">Week of {new Date(take.week_starting).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${badge}`}>{take.status}</span>
      </div>
      {editing ? (
        <>
          <label className="block text-[10px] uppercase tracking-wide text-text-disabled mb-1">Headline</label>
          <input value={headline} onChange={e => setHeadline(e.target.value)}
            className="w-full text-sm font-semibold border border-border-strong rounded-md p-2 mb-2 focus:outline-none focus:border-brand" />
          <label className="block text-[10px] uppercase tracking-wide text-text-disabled mb-1">Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
            className="w-full text-sm border border-border-strong rounded-md p-2 mb-2 focus:outline-none focus:border-brand" />
          <label className="block text-[10px] uppercase tracking-wide text-text-disabled mb-1">Takeaway (action line)</label>
          <input value={takeaway} onChange={e => setTakeaway(e.target.value)}
            className="w-full text-sm border border-border-strong rounded-md p-2 mb-2 focus:outline-none focus:border-brand" />
          <div className="flex gap-2">
            <button onClick={() => { onPatch(take.id, { headline, content: body, takeaway }); setEditing(false) }}
              className="text-xs bg-brand text-white rounded px-2 py-1">Save</button>
            <button onClick={() => { setHeadline(take.headline || ''); setBody(take.content || ''); setTakeaway(take.takeaway || ''); setEditing(false) }}
              className="text-xs text-text-tertiary">Cancel</button>
          </div>
        </>
      ) : (
        <>
          {/* Structured preview — exactly how it renders to users */}
          <div className="bg-[#f4f9f5] border border-brand/15 rounded-lg p-3 mb-3">
            {take.headline && <div className="text-base font-bold text-text-primary leading-snug mb-1.5">{take.headline}</div>}
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{take.content}</p>
            {take.takeaway && (
              <div className="mt-2 bg-white border-l-2 border-brand rounded-r px-2.5 py-1.5">
                <span className="text-sm text-brand font-medium">→ {take.takeaway}</span>
              </div>
            )}
          </div>
          <TopStoriesPreview stories={take.top_stories} />
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {take.status !== 'approved' && (
              <button onClick={() => onPatch(take.id, { status: 'approved' })} disabled={working}
                className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1">✓ Approve</button>
            )}
            <button onClick={() => setEditing(true)} disabled={working}
              className="text-xs border border-border-strong rounded px-2 py-1">✏ Edit</button>
            {take.status !== 'rejected' && (
              <button onClick={() => onPatch(take.id, { status: 'rejected' })} disabled={working}
                className="text-xs border border-red-300 text-danger-text rounded px-2 py-1">✗ Reject</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Send digest tab ──────────────────────────────────────────

function SendTab({ subscriberCount, subscribers, approvedItems, takes }: { subscriberCount: number; subscribers: Subscriber[]; approvedItems: Item[]; takes: Take[] }) {
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const sevenDaysAgo = Date.now() - 7 * 86400 * 1000
  const inWindow = approvedItems.filter(i => i.published_at && new Date(i.published_at).getTime() >= sevenDaysAgo)
  const approvedTake = takes.find(t => t.status === 'approved')

  async function send() {
    setWorking(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/news/send-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setResult(`Sent to ${data.recipients} subscribers · ${data.items} items · digest_id ${data.digest_id}`)
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Error')
    } finally { setWorking(false) }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-border rounded-xl p-3">
          <div className="text-[10px] uppercase text-text-tertiary">Subscribers</div>
          <div className="text-lg font-semibold mt-0.5">{subscriberCount}</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-3">
          <div className="text-[10px] uppercase text-text-tertiary">Approved items (7d)</div>
          <div className="text-lg font-semibold mt-0.5">{inWindow.length}</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-3">
          <div className="text-[10px] uppercase text-text-tertiary">Editor&apos;s take</div>
          <div className="text-sm font-semibold mt-0.5">{approvedTake ? '✓ Approved' : '⚠ None'}</div>
        </div>
      </div>

      <div className="bg-warning-bg border border-warning-border rounded-xl p-4 mb-4">
        <div className="text-sm font-semibold text-warning-text mb-1">Pre-flight check</div>
        <ul className="text-xs text-warning-text space-y-0.5">
          <li>{inWindow.length >= 3 ? '✓' : '⚠'} At least 3 approved items in last 7 days ({inWindow.length})</li>
          <li>{approvedTake ? '✓' : '⚠'} Editor&apos;s take approved (optional)</li>
          <li>{subscriberCount > 0 ? '✓' : '⚠'} Subscribers exist ({subscriberCount})</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => window.open('/api/admin/news/preview-digest', '_blank')} disabled={working}
          className="bg-white border border-border-strong hover:border-text-tertiary text-sm rounded-md px-3 py-1.5">
          👁 Preview email
        </button>
        <button onClick={() => send()} disabled={working || inWindow.length < 1 || subscriberCount < 1}
          className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-3 py-1.5 disabled:opacity-50">
          📨 Send digest now
        </button>
      </div>

      <div className="text-xs text-text-tertiary mb-4">
        💡 <strong>Preview email</strong> opens the exact email in a new tab (nothing sent). <strong>Send digest now</strong> sends to all enabled subscribers below.
      </div>

      {result && (
        <div className="bg-surface-muted border border-border rounded-md p-3 text-xs text-text-primary font-mono">
          {result}
        </div>
      )}

      {/* Recipients */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary">Recipients ({subscribers.length})</h3>
        </div>
        <div className="bg-warning-bg border border-warning-border rounded-lg p-3 mb-3 text-xs text-warning-text">
          ⚠ <strong>Testing mode:</strong> until a domain is verified in Resend, emails only deliver to your own Resend account address. So even though {subscribers.length} subscriber{subscribers.length === 1 ? '' : 's'} {subscribers.length === 1 ? 'is' : 'are'} enabled below, only the address you signed up to Resend with will actually receive it. The others will show a 403 in logs (expected). This resolves once you verify a domain in production.
        </div>
        <div className="border border-border rounded-lg divide-y divide-gray-100">
          {subscribers.length === 0 ? (
            <div className="p-4 text-sm text-text-tertiary text-center">No subscribers yet. Users enable the digest in their Settings.</div>
          ) : subscribers.map(s => <RecipientRow key={s.id} sub={s} />)}
        </div>
      </div>
    </>
  )
}

function RecipientRow({ sub }: { sub: Subscriber }) {
  const [enabled, setEnabled] = useState(true)
  const [working, setWorking] = useState(false)

  async function toggle() {
    setWorking(true)
    try {
      const res = await fetch('/api/admin/news/recipients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: sub.id, enabled: !enabled }),
      })
      if (res.ok) setEnabled(!enabled)
    } finally { setWorking(false) }
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{sub.full_name || sub.email}</div>
        <div className="text-xs text-text-tertiary truncate">{sub.email}{sub.sectors.length > 0 ? ` · ${sub.sectors.slice(0, 3).join(', ')}` : ''}</div>
      </div>
      <button onClick={toggle} disabled={working}
        className={`text-xs font-medium rounded-full px-3 py-1 border transition flex-shrink-0 ${
          enabled ? 'bg-success-bg text-success-text border-green-300' : 'bg-surface-muted text-text-tertiary border-border-strong'
        }`}>
        {enabled ? '✓ Enabled' : 'Disabled'}
      </button>
    </div>
  )
}
