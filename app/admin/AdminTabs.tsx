'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  tab: 'overview' | 'submissions' | 'users' | 'admins' | 'experts' | 'feedback'
  data: Record<string, unknown>
}

export default function AdminTabs({ tab, data }: Props) {
  if (tab === 'overview')    return <OverviewTab stats={(data.stats as Record<string, unknown>) || {}} />
  if (tab === 'submissions') return <SubmissionsTab submissions={(data.submissions as SubmissionRow[]) || []} />
  if (tab === 'users')       return <UsersTab users={(data.users as UserRow[]) || []} />
  if (tab === 'admins')      return <AdminsTab admins={(data.admins as AdminRow[]) || []} />
  if (tab === 'experts')     return <ExpertsTab experts={(data.experts as ExpertRow[]) || []} />
  if (tab === 'feedback')    return <FeedbackTab feedback={(data.feedback as FeedbackRow[]) || []} />
  return null
}

// ─────── Overview ───────────────────────────────────────────────
function OverviewTab({ stats }: { stats: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Total submissions"    value={stats.total_submissions} />
      <Stat label="Registered users"     value={stats.total_users} />
      <Stat label="Submitted today"      value={stats.submissions_today} />
      <Stat label="This week"            value={stats.submissions_this_week} />
      <Stat label="Complete analyses"    value={stats.complete_analyses} />
      <Stat label="Failed analyses"      value={stats.failed_analyses} />
      <Stat label="Avg deck score"       value={stats.avg_deck_score} />
      <Stat label="Total raise target"
        value={typeof stats.total_raise_target_usd === 'number'
          ? `$${(stats.total_raise_target_usd / 1e6).toFixed(1)}M`
          : '—'} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className="text-2xl font-semibold text-text-primary">{value == null || value === '' ? '—' : String(value)}</div>
    </div>
  )
}

// ─────── Submissions ────────────────────────────────────────────
type SubmissionRow = {
  id: string
  unique_slug: string
  company_name: string
  country: string | null
  stage: string | null
  sector: string | null
  raise_target_usd: number | null
  founder_email: string
  analysis_status: string | null
  top_match_score: number | null
  created_at: string
  is_public: boolean | null
  user_id: string | null
}

function SubmissionsTab({ submissions }: { submissions: SubmissionRow[] }) {
  const router = useRouter()
  const [working, setWorking] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const filtered = submissions.filter(s => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      s.company_name?.toLowerCase().includes(q) ||
      s.founder_email?.toLowerCase().includes(q) ||
      s.sector?.toLowerCase().includes(q)
    )
  })

  async function togglePublic(id: string, current: boolean) {
    setWorking(id)
    try {
      const res = await fetch(`/api/admin/submissions/${id}/toggle-public`, { method: 'POST' })
      if (!res.ok) throw new Error('Toggle failed')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setWorking(null)
    }
  }

  async function deleteSubmission(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove the submission and its deck file. Cannot be undone.`)) return
    setWorking(id)
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <input
          type="text"
          placeholder="Filter by company, email, sector…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-72 px-3 py-1.5 text-sm border border-border-strong rounded-md focus:outline-none focus:border-brand"
        />
        <span className="text-xs text-text-tertiary">
          {filtered.length} of {submissions.length} shown · 100 most recent
        </span>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <Th>Company</Th><Th>Founder</Th><Th>Stage</Th><Th>Country</Th>
                <Th>Score</Th><Th>Date</Th><Th>Public</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-surface-muted">
                  <Td>
                    <div className="font-medium text-text-primary">{s.company_name || '—'}</div>
                    <div className="text-xs text-text-tertiary">{s.sector}</div>
                  </Td>
                  <Td>
                    <div className="text-xs text-text-secondary">{s.founder_email}</div>
                    {s.user_id ? <div className="text-[10px] text-success-text">claimed</div> : <div className="text-[10px] text-text-disabled">anonymous</div>}
                  </Td>
                  <Td>{s.stage || '—'}</Td>
                  <Td>{s.country || '—'}</Td>
                  <Td>{s.top_match_score ?? '—'}</Td>
                  <Td className="text-xs text-text-tertiary">{new Date(s.created_at).toLocaleDateString()}</Td>
                  <Td>
                    <button
                      onClick={() => togglePublic(s.id, !!s.is_public)}
                      disabled={working === s.id}
                      className={`text-xs px-2 py-0.5 rounded-full ${s.is_public ? 'bg-green-100 text-success-text' : 'bg-surface-muted text-text-tertiary'} disabled:opacity-50`}
                    >
                      {s.is_public ? 'public' : 'private'}
                    </button>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Link href={`/match/${s.unique_slug}`} className="text-xs text-brand hover:underline">View</Link>
                      <button
                        onClick={() => deleteSubmission(s.id, s.company_name)}
                        disabled={working === s.id}
                        className="text-xs text-danger-text hover:text-danger-text disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-text-tertiary">No submissions match filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────── Users ──────────────────────────────────────────────────
type UserRow = {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  country: string | null
  role: string
  plan: string
  submissions_count: number
  created_at: string
}

function UsersTab({ users }: { users: UserRow[] }) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 text-xs text-text-tertiary">
        {users.length} users · 100 most recent
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <Th>Email</Th><Th>Name</Th><Th>Company</Th><Th>Country</Th>
              <Th>Role</Th><Th>Plan</Th><Th>Submissions</Th><Th>Joined</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-surface-muted">
                <Td><div className="text-xs">{u.email}</div></Td>
                <Td>{u.full_name || '—'}</Td>
                <Td>{u.company_name || '—'}</Td>
                <Td>{u.country || '—'}</Td>
                <Td className="capitalize">{u.role}</Td>
                <Td className="capitalize">{u.plan}</Td>
                <Td>{u.submissions_count}</Td>
                <Td className="text-xs text-text-tertiary">{new Date(u.created_at).toLocaleDateString()}</Td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-sm text-text-tertiary">No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────── Super Admins ───────────────────────────────────────────
type AdminRow = {
  id: string
  email: string
  user_id: string | null
  notes: string | null
  created_at: string
}

function AdminsTab({ admins }: { admins: AdminRow[] }) {
  const router = useRouter()
  const [working, setWorking] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newNotes, setNewNotes] = useState('')

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.includes('@')) { alert('Invalid email'); return }
    setWorking('add')
    try {
      const res = await fetch('/api/admin/super-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), notes: newNotes.trim() }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Add failed') }
      setNewEmail(''); setNewNotes('')
      router.refresh()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
    finally { setWorking(null) }
  }

  async function removeAdmin(id: string, email: string) {
    if (!confirm(`Remove ${email} as super admin?`)) return
    setWorking(id)
    try {
      const res = await fetch(`/api/admin/super-admins/${id}`, { method: 'DELETE' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Remove failed') }
      router.refresh()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
    finally { setWorking(null) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">Add super admin</h3>
        <form onSubmit={addAdmin} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-text-tertiary mb-1">Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="trusted@company.com" className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-md" required />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-text-tertiary mb-1">Notes (optional)</label>
            <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
              placeholder="Why they're getting access" className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-md" />
          </div>
          <button type="submit" disabled={working === 'add'}
            className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-4 py-1.5 disabled:opacity-50">
            {working === 'add' ? 'Adding…' : '+ Add'}
          </button>
        </form>
        <p className="text-xs text-text-tertiary mt-3">
          Tip: <code className="bg-surface-muted px-1 rounded">samudravito4@gmail.com</code> is also in <code className="bg-surface-muted px-1 rounded">SUPER_ADMIN_EMAILS</code> env var as a hardcoded fallback.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr><Th>Email</Th><Th>Linked?</Th><Th>Notes</Th><Th>Added</Th><Th>Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map(a => (
              <tr key={a.id} className="hover:bg-surface-muted">
                <Td>{a.email}</Td>
                <Td>{a.user_id ? <span className="text-xs text-success-text">✓ signed up</span> : <span className="text-xs text-text-tertiary">pending</span>}</Td>
                <Td className="text-xs text-text-tertiary">{a.notes || '—'}</Td>
                <Td className="text-xs text-text-tertiary">{new Date(a.created_at).toLocaleDateString()}</Td>
                <Td>
                  <button onClick={() => removeAdmin(a.id, a.email)} disabled={working === a.id}
                    className="text-xs text-danger-text hover:text-danger-text disabled:opacity-50">
                    Remove
                  </button>
                </Td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-sm text-text-tertiary">No super admins yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────── Expert applications ────────────────────────────────────
type ExpertRow = {
  id: string
  user_id: string
  display_name: string
  fund_or_firm: string | null
  title: string | null
  bio: string | null
  what_i_offer: string | null
  linkedin_url: string | null
  company_linkedin_url: string | null
  company_website: string | null
  website: string | null
  avatar_url: string | null
  profile_types: string[]
  expertise_areas: string[]
  hq_country: string | null
  application_status: 'pending' | 'active' | 'rejected'
  application_notes: string | null
  created_at: string
  reviewed_at: string | null
  email: string | null
}

function ExpertsTab({ experts }: { experts: ExpertRow[] }) {
  const router = useRouter()
  const [working, setWorking] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = experts.filter(e => filter === 'all' ? true : e.application_status === filter)
  const pendingCount = experts.filter(e => e.application_status === 'pending').length

  async function approve(id: string) {
    setWorking(id)
    try {
      const res = await fetch(`/api/admin/experts/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Approve failed')
      router.refresh()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
    finally { setWorking(null); setExpanded(null) }
  }

  async function reject(id: string) {
    const notes = prompt('Reason for rejection (optional, sent to applicant):')
    if (notes === null) return  // cancelled
    setWorking(id)
    try {
      const res = await fetch(`/api/admin/experts/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('Reject failed')
      router.refresh()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
    finally { setWorking(null); setExpanded(null) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {(['pending', 'active', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${
              filter === f ? 'bg-brand text-white' : 'bg-white text-text-secondary border border-border-strong hover:border-text-tertiary'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-warning-solid text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-tertiary">{filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-sm text-text-tertiary">
          No applications in this category yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <div key={e.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {e.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {(e.display_name[0] || 'E').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-text-primary">{e.display_name}</h3>
                      {e.application_status === 'pending' && <span className="text-[10px] uppercase bg-warning-bg text-warning-text px-1.5 py-0.5 rounded">pending</span>}
                      {e.application_status === 'active' && <span className="text-[10px] uppercase bg-green-100 text-success-text px-1.5 py-0.5 rounded">approved</span>}
                      {e.application_status === 'rejected' && <span className="text-[10px] uppercase bg-red-100 text-danger-text px-1.5 py-0.5 rounded">rejected</span>}
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {[e.title, e.fund_or_firm].filter(Boolean).join(' at ')}
                      {e.hq_country && ` · ${e.hq_country}`}
                    </p>
                    {e.email && <p className="text-[11px] text-text-tertiary mt-0.5">{e.email}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(e.profile_types || []).map(t => (
                        <span key={t} className="text-[10px] uppercase bg-brand/10 text-brand px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                    className="text-xs text-text-tertiary hover:text-text-primary">
                    {expanded === e.id ? '▲ Hide' : '▼ Details'}
                  </button>
                  {e.application_status === 'pending' && (
                    <>
                      <button onClick={() => approve(e.id)} disabled={working === e.id}
                        className="text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50">
                        ✓ Approve
                      </button>
                      <button onClick={() => reject(e.id)} disabled={working === e.id}
                        className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50">
                        ✗ Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expanded === e.id && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-surface-muted">
                  <div className="flex flex-wrap gap-3 mb-2">
                    {e.linkedin_url && <a href={e.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">Personal LinkedIn ↗</a>}
                    {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">Personal site ↗</a>}
                    {e.company_linkedin_url && <a href={e.company_linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">Company LinkedIn ↗</a>}
                    {e.company_website && <a href={e.company_website} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">Company site ↗</a>}
                  </div>
                  {e.bio && (<><p className="text-[10px] uppercase text-text-tertiary mt-2">Bio</p><p className="text-xs text-text-secondary whitespace-pre-wrap">{e.bio}</p></>)}
                  {e.what_i_offer && (<><p className="text-[10px] uppercase text-text-tertiary mt-2">What they offer</p><p className="text-xs text-text-secondary whitespace-pre-wrap">{e.what_i_offer}</p></>)}
                  {(e.expertise_areas || []).length > 0 && (<>
                    <p className="text-[10px] uppercase text-text-tertiary mt-2">Expertise</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {e.expertise_areas.map(a => <span key={a} className="text-[10px] bg-white border border-border px-1.5 py-0.5 rounded">{a}</span>)}
                    </div>
                  </>)}
                  {e.application_notes && (<>
                    <p className="text-[10px] uppercase text-text-tertiary mt-2">Rejection note</p>
                    <p className="text-xs text-danger-text">{e.application_notes}</p>
                  </>)}
                  <p className="text-[10px] text-text-disabled mt-3">
                    Applied {new Date(e.created_at).toLocaleString()}
                    {e.reviewed_at && ` · Reviewed ${new Date(e.reviewed_at).toLocaleString()}`}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wide px-4 py-2.5">{children}</th>
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}

// ─────── Feedback ────────────────────────────────────────────────
type FeedbackRow = {
  id: string
  user_id: string
  user_email: string
  task_key: string
  rating: number
  message: string | null
  page_url: string | null
  created_at: string
  updated_at: string
}

function FeedbackTab({ feedback }: { feedback: FeedbackRow[] }) {
  // Per-task aggregates
  const byTask: Record<string, { count: number; sum: number }> = {}
  for (const f of feedback) {
    if (!byTask[f.task_key]) byTask[f.task_key] = { count: 0, sum: 0 }
    byTask[f.task_key].count += 1
    byTask[f.task_key].sum   += f.rating
  }
  const taskLabels: Record<string, string> = {
    deck_analysis:   'Deck analysis',
    mock_pitch:      'Mock pitch',
    calculator:      'Calculator',
    crm:             'CRM',
    meeting_request: 'Meeting request',
    final_overall:   'Overall (NPS)',
  }

  return (
    <div className="space-y-6">
      {/* Aggregates row */}
      <div>
        <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Average rating per task</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(taskLabels).map(([key, label]) => {
            const stats = byTask[key]
            const avg = stats ? (stats.sum / stats.count).toFixed(1) : '—'
            const color = !stats ? 'text-text-disabled' :
              stats.sum / stats.count >= 7 ? 'text-green-600' :
              stats.sum / stats.count >= 5 ? 'text-amber-600' :
                                              'text-red-600'
            return (
              <div key={key} className="bg-surface-card border border-border rounded-lg p-3">
                <div className="text-xs text-text-tertiary truncate">{label}</div>
                <div className={`text-xl font-semibold mt-1 tabular-nums ${color}`}>
                  {avg}{stats && <span className="text-xs text-text-disabled">/10</span>}
                </div>
                <div className="text-[10px] text-text-disabled mt-0.5">
                  {stats ? `${stats.count} response${stats.count === 1 ? '' : 's'}` : 'No responses yet'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detailed responses */}
      <div>
        <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">All responses ({feedback.length})</h2>
        {feedback.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-lg p-8 text-center text-text-tertiary text-sm">
            No feedback yet. Beta testers will submit feedback as they work through the tasks.
          </div>
        ) : (
          <div className="space-y-2">
            {feedback.map(f => {
              const ratingColor = f.rating >= 7 ? 'text-green-600 bg-green-50 border-green-200' :
                                  f.rating >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                  'text-red-600 bg-red-50 border-red-200'
              return (
                <div key={f.id} className="bg-surface-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center justify-center min-w-[44px] h-7 px-2 text-xs font-bold rounded border tabular-nums ${ratingColor}`}>
                        {f.rating}/10
                      </span>
                      <span className="text-xs font-medium text-text-secondary bg-surface-muted px-2 py-1 rounded">
                        {taskLabels[f.task_key] || f.task_key}
                      </span>
                      <span className="text-xs text-text-tertiary">{f.user_email}</span>
                    </div>
                    <span className="text-[11px] text-text-disabled tabular-nums">
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  </div>
                  {f.message ? (
                    <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed mt-2">
                      {f.message}
                    </p>
                  ) : (
                    <p className="text-xs text-text-disabled italic mt-2">No comment provided</p>
                  )}
                  {f.page_url && (
                    <div className="text-[10px] text-text-disabled mt-2 font-mono">
                      from {f.page_url}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
