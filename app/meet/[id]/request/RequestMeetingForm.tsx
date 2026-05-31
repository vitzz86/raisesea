'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Vc = {
  id: string
  display_name: string
  fund_or_firm: string | null
  title: string | null
  avatar_url: string | null
  calendar_connected: boolean
}

type Submission = {
  id: string
  company_name: string
  unique_slug: string
  deck_url: string | null
  stage: string | null
  raise_target_usd: number | null
}

type Slot = {
  start_iso:  string
  end_iso:    string
  day_label:  string  // "Tue, Jun 2"
  time_label: string  // "10:00 AM"
  tz_abbr:    string  // "SGT"
  iso_date:   string  // "2025-06-02"
}

type Props = {
  vc: Vc
  founder: { id: string; email: string; full_name: string }
  submissions: Submission[]
}

const MEETING_GOALS = [
  { value: 'pitch_intro',           label: 'Pitch / first intro' },
  { value: 'investment_discussion', label: 'Investment discussion' },
  { value: 'product_feedback',      label: 'Product / deck feedback' },
  { value: 'market_advice',         label: 'Market or strategy advice' },
  { value: 'intro_request',         label: 'Request for introductions' },
  { value: 'other',                 label: 'Other (explain below)' },
]

export default function RequestMeetingForm({ vc, founder, submissions }: Props) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  const [selectedSlots, setSelectedSlots] = useState<string[]>([])  // ISO start times, up to 3
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)  // iso_date for showing times
  const [submissionId, setSubmissionId] = useState<string>(submissions[0]?.id || '')
  const [goal, setGoal]         = useState('pitch_intro')
  const [notes, setNotes]       = useState('')
  const [questions, setQuestions] = useState(['', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setSlotsLoading(true)
      setSlotsError(null)
      try {
        const res = await fetch(`/api/meet/${vc.id}/slots`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setSlotsError(data.error || 'Failed to load slots')
        } else if (data.reason) {
          setSlotsError(data.reason)
        } else {
          const fetchedSlots = (data.slots || []) as Slot[]
          setSlots(fetchedSlots)
          // Auto-select first day with availability
          if (fetchedSlots.length > 0 && !selectedDate) {
            setSelectedDate(fetchedSlots[0].iso_date)
          }
        }
      } catch {
        if (!cancelled) setSlotsError('Network error loading slots')
      } finally {
        if (!cancelled) setSlotsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [vc.id])

  function toggleSlot(iso: string) {
    if (selectedSlots.includes(iso)) {
      setSelectedSlots(selectedSlots.filter(s => s !== iso))
    } else if (selectedSlots.length < 3) {
      setSelectedSlots([...selectedSlots, iso])
    }
  }

  // Group slots by ISO date for the calendar grid
  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    if (!acc[slot.iso_date]) acc[slot.iso_date] = []
    acc[slot.iso_date].push(slot)
    return acc
  }, {})
  const availableDates = Object.keys(slotsByDate).sort()
  const slotsForSelectedDay = selectedDate ? slotsByDate[selectedDate] || [] : []
  const tzAbbrForDay = slotsForSelectedDay[0]?.tz_abbr || ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (selectedSlots.length === 0) { setError('Pick at least one preferred slot'); return }
    if (selectedSlots.length > 3) { setError('Pick up to 3 slots'); return }
    if (!submissionId) { setError('Choose a submission / deck to share with the expert'); return }
    if (!notes.trim() || notes.trim().length < 30) { setError('Add at least a 30-character note about why you want to meet'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/meetings/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vc_profile_id:   vc.id,
          submission_id:   submissionId,
          meeting_goal:    goal,
          meeting_notes:   notes.trim(),
          key_questions:   questions.filter(q => q.trim().length > 0),
          preferred_slots: selectedSlots,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `HTTP ${res.status}`)
      }
      setSuccess(true)
      // Brief pause so user sees confirmation, then redirect to /dashboard/meetings
      setTimeout(() => router.push('/dashboard/meetings'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">✓</div>
        <h1 className="text-lg font-semibold text-green-900 mb-1">Request sent</h1>
        <p className="text-sm text-green-800">{vc.display_name} will review and respond. Redirecting to your meetings…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* VC header */}
      <div className="bg-white border border-border rounded-xl p-5">
        <Link href={`/meet/${vc.id}`} className="text-xs text-gray-600 hover:underline">← Back to profile</Link>
        <div className="flex items-center gap-3 mt-3">
          {vc.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vc.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1a4d2e] text-white flex items-center justify-center text-lg font-semibold">
              {vc.display_name[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900">Request meeting with {vc.display_name}</h1>
            {vc.title && vc.fund_or_firm && <p className="text-xs text-gray-600">{vc.title} at {vc.fund_or_firm}</p>}
          </div>
        </div>
      </div>

      {/* Submission picker */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Which startup are you pitching?</h2>
        <p className="text-xs text-gray-600 mb-3">{vc.display_name} will see this submission&apos;s deck + analysis as your &quot;application&quot;.</p>
        {submissions.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            You don&apos;t have any submissions yet. <Link href="/apply" className="underline">Submit your first deck →</Link>
          </div>
        ) : (
          <select value={submissionId} onChange={e => setSubmissionId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-strong rounded-md focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
            {submissions.map(s => (
              <option key={s.id} value={s.id}>
                {s.company_name}{s.stage ? ` · ${s.stage}` : ''}{s.raise_target_usd ? ` · raising $${(s.raise_target_usd / 1e6).toFixed(1)}M` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Meeting goal */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">What&apos;s the meeting about?</h2>
        <select value={goal} onChange={e => setGoal(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border-strong rounded-md mb-4">
          {MEETING_GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>

        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Context note (30+ chars) — why this expert specifically? *
        </label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="e.g. I read your post on SEA B2B sales playbooks. We're hitting $40K MRR and want feedback on our pricing tier structure before raising."
          className="w-full px-3 py-2 text-sm border border-border-strong rounded-md focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors mb-1" />
        <div className="text-xs text-gray-500">{notes.length} chars</div>

        <h3 className="text-xs font-medium text-gray-700 mt-4 mb-1.5">Key questions you want to discuss (optional)</h3>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <input key={i} type="text" value={q}
              onChange={e => setQuestions(questions.map((qq, ii) => ii === i ? e.target.value : qq))}
              placeholder={`Question ${i + 1}`}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-md focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors" />
          ))}
        </div>
      </div>

      {/* Slot picker */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Pick up to 3 preferred times <span className="text-gray-500">({selectedSlots.length}/3 selected)</span>
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          The expert will pick one. All slots are 30 minutes. Times shown in their local timezone.
        </p>

        {!vc.calendar_connected ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            This expert hasn&apos;t connected their calendar yet — can&apos;t accept meeting requests right now.
          </div>
        ) : slotsLoading ? (
          <div className="text-sm text-gray-500 py-3">Loading available slots…</div>
        ) : slotsError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            {slotsError}
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-gray-50 border border-border rounded-lg p-4 text-sm text-gray-600 text-center">
            No open slots in the next 14 days. Check back soon, or try another expert.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
            {/* Day picker (left) — Calendly-style list of available days */}
            <div className="border border-border rounded-lg overflow-hidden bg-gray-50">
              <div className="px-3 py-2 border-b border-border text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-white">
                Available days
              </div>
              <div className="max-h-80 overflow-y-auto">
                {availableDates.map(date => {
                  const dayLabel = slotsByDate[date][0].day_label
                  const count = slotsByDate[date].length
                  const isActive = selectedDate === date
                  const hasSelected = slotsByDate[date].some(s => selectedSlots.includes(s.start_iso))
                  return (
                    <button
                      type="button"
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-0 transition ${
                        isActive
                          ? 'bg-white border-l-2 border-l-[#1a4d2e]'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-sm ${isActive ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {dayLabel}
                          </div>
                          <div className="text-[11px] text-gray-500">{count} slot{count === 1 ? '' : 's'}</div>
                        </div>
                        {hasSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#1a4d2e] flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots (right) — for the selected day */}
            <div className="border border-border rounded-lg p-3 min-h-[200px]">
              {selectedDate ? (
                <>
                  <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {slotsByDate[selectedDate]?.[0]?.day_label || ''}
                    </h3>
                    {tzAbbrForDay && (
                      <span className="text-[11px] text-gray-500">All times {tzAbbrForDay}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
                    {slotsForSelectedDay.map(slot => {
                      const active = selectedSlots.includes(slot.start_iso)
                      const disabled = !active && selectedSlots.length >= 3
                      return (
                        <button
                          type="button"
                          key={slot.start_iso}
                          onClick={() => toggleSlot(slot.start_iso)}
                          disabled={disabled}
                          className={`text-sm px-2 py-2 rounded-md border transition ${
                            active
                              ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]'
                              : disabled
                                ? 'bg-gray-50 text-gray-400 border-border cursor-not-allowed'
                                : 'bg-white text-gray-700 border-border-strong hover:border-[#1a4d2e]'
                          }`}
                        >
                          {slot.time_label}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 text-center py-8">
                  Pick a day on the left to see available times
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={submitting || submissions.length === 0}
          className="bg-[#1a4d2e] hover:bg-[#143d24] text-white text-sm font-medium rounded-lg px-6 py-2.5 disabled:opacity-50">
          {submitting ? 'Sending…' : 'Send meeting request'}
        </button>
        <span className="text-xs text-gray-500">
          Submitting as {founder.email}
        </span>
      </div>
    </form>
  )
}
