'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const GOAL_LABELS: Record<string, string> = {
  pitch_intro: 'Pitch / first intro',
  investment_discussion: 'Investment discussion',
  product_feedback: 'Product / deck feedback',
  market_advice: 'Market or strategy advice',
  intro_request: 'Request for introductions',
  other: 'Other',
}

type Request = {
  id: string
  status: string
  meeting_goal: string
  meeting_notes: string
  key_questions: string[]
  preferred_slots: string[]
  confirmed_slot: string | null
  google_meet_link: string | null
  soft_hold_expires_at: string | null
  created_at: string
  founder_name: string | null
  founder_email: string | null
  submission: {
    id: string
    company_name: string
    unique_slug: string
    stage: string | null
    sector: string | null
    raise_target_usd: number | null
  } | null
}

function fmtSlot(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function VcMeetingsView({ requests }: { requests: Request[] }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'history'>('all')

  const pending   = requests.filter(r => r.status === 'pending')
  const confirmed = requests.filter(r => r.status === 'confirmed')
  const past      = requests.filter(r => ['declined', 'expired', 'cancelled', 'completed'].includes(r.status))

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-10 text-center">
        <div className="text-4xl mb-3 opacity-30">📥</div>
        <h2 className="text-base font-semibold text-text-primary mb-1">Inbox is quiet</h2>
        <p className="text-sm text-text-tertiary">Founders looking for your expertise will land here. Make sure your profile is sharp and your availability is up to date.</p>
      </div>
    )
  }

  const FILTERS = [
    { key: 'all'       as const, label: 'All',       count: requests.length },
    { key: 'pending'   as const, label: 'Pending',   count: pending.length },
    { key: 'confirmed' as const, label: 'Confirmed', count: confirmed.length },
    { key: 'history'   as const, label: 'History',   count: past.length },
  ]

  const showPending   = filter === 'all' || filter === 'pending'
  const showConfirmed = filter === 'all' || filter === 'confirmed'
  const showPast      = filter === 'all' || filter === 'history'

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${
              filter === f.key
                ? 'bg-brand text-white'
                : 'bg-surface-muted text-text-tertiary hover:bg-surface-sunken'
            }`}
          >
            {f.label} <span className="opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {showPending && pending.length > 0 && (
        <Section title={`Pending review (${pending.length})`}>
          {pending.map(r => <PendingRequestCard key={r.id} request={r} />)}
        </Section>
      )}
      {showConfirmed && confirmed.length > 0 && (
        <Section title="Confirmed">
          {confirmed.map(r => <ConfirmedRequestCard key={r.id} request={r} />)}
        </Section>
      )}
      {showPast && past.length > 0 && (
        <Section title="History">
          {past.map(r => <PastRequestCard key={r.id} request={r} />)}
        </Section>
      )}

      {/* Empty state for a filter with no items */}
      {((filter === 'pending' && pending.length === 0) ||
        (filter === 'confirmed' && confirmed.length === 0) ||
        (filter === 'history' && past.length === 0)) && (
        <div className="text-sm text-text-tertiary text-center py-8">No {filter} requests.</div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function PendingRequestCard({ request }: { request: Request }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function accept() {
    if (!selectedSlot) { setErrMsg('Pick one of the proposed slots first'); return }
    setWorking(true)
    setErrMsg(null)
    try {
      const res = await fetch(`/api/meetings/${request.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosen_slot: selectedSlot }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Error accepting meeting')
    } finally {
      setWorking(false)
    }
  }

  async function decline() {
    const reason = prompt('Reason for declining (optional, sent to founder):')
    if (reason === null) return
    setWorking(true)
    setErrMsg(null)
    try {
      const res = await fetch(`/api/meetings/${request.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Error declining')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="bg-white border border-warning-border rounded-xl p-4">
      {/* Founder + submission summary */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">
            {request.founder_name || request.founder_email || 'Unknown founder'}
          </div>
          <div className="text-xs text-text-tertiary">{request.founder_email}</div>
        </div>
        <span className="text-[10px] uppercase bg-warning-bg text-warning-text px-1.5 py-0.5 rounded">Pending</span>
      </div>

      {/* Goal */}
      <div className="text-xs text-text-tertiary mb-2">
        <strong>{GOAL_LABELS[request.meeting_goal] || request.meeting_goal}</strong>
      </div>

      {/* Submission */}
      {request.submission && (
        <div className="bg-surface-muted border border-border rounded-md p-3 mb-3 text-xs">
          <div className="font-medium text-text-primary mb-0.5">
            {request.submission.company_name}
            {request.submission.stage && <span className="text-text-tertiary font-normal"> · {request.submission.stage}</span>}
            {request.submission.raise_target_usd && (
              <span className="text-text-tertiary font-normal"> · raising ${(request.submission.raise_target_usd / 1e6).toFixed(1)}M</span>
            )}
          </div>
          <Link href={`/meet/preview/${request.id}`} className="text-brand underline">
            View deck & summary →
          </Link>
        </div>
      )}

      {/* Note */}
      <div className="text-xs text-text-secondary mb-2 whitespace-pre-wrap">
        <span className="text-text-tertiary">Note:</span> {request.meeting_notes}
      </div>

      {/* Questions */}
      {request.key_questions.length > 0 && (
        <div className="text-xs text-text-secondary mb-3">
          <div className="text-text-tertiary mb-0.5">Questions:</div>
          <ul className="space-y-0.5 ml-3">
            {request.key_questions.map((q, i) => <li key={i}>• {q}</li>)}
          </ul>
        </div>
      )}

      {/* Slot picker — more obvious selection state */}
      <div className="mb-3">
        <div className="text-xs text-text-tertiary mb-1.5">Proposed slots — click one, then Accept:</div>
        <div className="flex flex-wrap gap-2">
          {request.preferred_slots.map(slot => {
            const active = selectedSlot === slot
            return (
              <button key={slot} type="button"
                onClick={() => setSelectedSlot(active ? null : slot)}
                className={`text-xs px-3 py-2 rounded-md border-2 transition ${
                  active
                    ? 'bg-brand text-white border-brand ring-2 ring-[#1a4d2e]/30'
                    : 'bg-white text-text-secondary border-border-strong hover:border-brand hover:bg-surface-muted'
                }`}>
                {active && '✓ '}{fmtSlot(slot)}
              </button>
            )
          })}
        </div>
        {selectedSlot && (
          <div className="text-[11px] text-success-text mt-1.5">
            ✓ Selected: <strong>{fmtSlot(selectedSlot)}</strong> — click Accept below
          </div>
        )}
      </div>

      {request.soft_hold_expires_at && (
        <div className="text-[10px] text-text-disabled mb-2">
          Auto-expires {fmtSlot(request.soft_hold_expires_at)}
        </div>
      )}

      {/* Error message */}
      {errMsg && (
        <div className="bg-danger-bg border border-danger-border rounded-md p-2 mb-2 text-xs text-danger-text">
          {errMsg}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button onClick={accept} disabled={working || !selectedSlot}
          className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
          {working ? 'Working…' : '✓ Accept selected slot'}
        </button>
        <button onClick={decline} disabled={working}
          className="bg-white border border-red-300 text-danger-text hover:bg-danger-bg text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50">
          ✗ Decline
        </button>
      </div>
    </div>
  )
}

function ConfirmedRequestCard({ request }: { request: Request }) {
  return (
    <div className="bg-white border border-success-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">{request.founder_name || request.founder_email}</div>
          <div className="text-xs text-text-tertiary">{request.founder_email}</div>
        </div>
        <span className="text-[10px] uppercase bg-green-100 text-success-text px-1.5 py-0.5 rounded">Confirmed</span>
      </div>
      <div className="text-sm text-text-secondary">
        <strong>{request.confirmed_slot ? fmtSlot(request.confirmed_slot) : '—'}</strong>
        {request.submission && <> · for {request.submission.company_name}</>}
      </div>
      {request.google_meet_link && (
        <a href={request.google_meet_link} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 text-xs font-medium bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5">
          Open Google Meet →
        </a>
      )}
    </div>
  )
}

function PastRequestCard({ request }: { request: Request }) {
  return (
    <div className="bg-surface-muted border border-border rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-text-secondary">
          {request.founder_name || request.founder_email}
          {request.submission && <> · {request.submission.company_name}</>}
        </div>
        <span className="text-[10px] uppercase bg-surface-sunken text-text-secondary px-1.5 py-0.5 rounded">{request.status}</span>
      </div>
      <div className="text-[10px] text-text-disabled mt-1">{new Date(request.created_at).toLocaleDateString()}</div>
    </div>
  )
}
