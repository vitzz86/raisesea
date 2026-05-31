'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Common SEA timezones — picker keeps things clean
const TIMEZONES = [
  { value: 'Asia/Singapore', label: 'Singapore / Malaysia / Philippines (UTC+8)' },
  { value: 'Asia/Jakarta',   label: 'Jakarta / Bangkok / Vietnam (UTC+7)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong / Taiwan (UTC+8)' },
  { value: 'Asia/Tokyo',     label: 'Tokyo / Seoul (UTC+9)' },
  { value: 'UTC',            label: 'UTC' },
]

type Window = {
  id?:          string
  day_of_week:  number
  start_time:   string  // 'HH:MM'
  end_time:     string
  timezone:     string
  is_active:    boolean
}

type Props = {
  vcProfileId:        string
  calendarConnected:  boolean
  initialWindows:     Window[]
}

function normalizeTime(t: string): string {
  // Convert 'HH:MM:SS' or 'HH:MM' to 'HH:MM'
  if (!t) return '09:00'
  const parts = t.split(':')
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

export default function AvailabilityForm({ vcProfileId, calendarConnected, initialWindows }: Props) {
  const router = useRouter()
  const [windows, setWindows] = useState<Window[]>(
    initialWindows.map(w => ({ ...w, start_time: normalizeTime(w.start_time), end_time: normalizeTime(w.end_time) }))
  )
  const [defaultTz, setDefaultTz] = useState<string>(initialWindows[0]?.timezone || 'Asia/Singapore')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function addWindow() {
    setWindows([
      ...windows,
      { day_of_week: 2, start_time: '10:00', end_time: '12:00', timezone: defaultTz, is_active: true },
    ])
  }

  function updateWindow(idx: number, patch: Partial<Window>) {
    setWindows(windows.map((w, i) => i === idx ? { ...w, ...patch } : w))
  }

  function removeWindow(idx: number) {
    setWindows(windows.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    // Client-side validation
    for (const w of windows) {
      if (w.end_time <= w.start_time) {
        setMessage({ kind: 'error', text: 'End time must be after start time' })
        setSaving(false)
        return
      }
    }
    try {
      const res = await fetch('/api/experts/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vc_profile_id: vcProfileId, windows }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || 'Save failed')
      }
      setMessage({ kind: 'success', text: 'Availability saved.' })
      router.refresh()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Calendar? Founders will no longer be able to book meetings until you reconnect.')) return
    try {
      const res = await fetch('/api/google/calendar/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Google Calendar connection card */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Google Calendar</h2>
        <p className="text-xs text-gray-600 mb-4">
          Required for accepting meetings. We read your busy times to compute free slots, and create events with Google Meet links on your calendar.
        </p>
        {calendarConnected ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
            <button onClick={handleDisconnect} className="text-xs text-red-600 hover:underline">
              Disconnect
            </button>
          </div>
        ) : (
          <a
            href="/api/google/calendar/connect"
            className="inline-flex items-center gap-2 bg-white border border-border-strong hover:border-text-tertiary rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition"
          >
            <GoogleIcon />
            Connect Google Calendar
          </a>
        )}
      </div>

      {/* Weekly hours */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Weekly hours</h2>
          <span className="text-xs text-gray-500">{windows.length} window{windows.length === 1 ? '' : 's'}</span>
        </div>
        <p className="text-xs text-gray-600 mb-4">
          Add the time windows when you&apos;re available for founder meetings.
          Founders can request 30-min slots within these windows. Minimum 48 hours lead time enforced automatically.
        </p>

        {windows.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-border-strong rounded-lg p-6 text-center mb-3">
            <p className="text-sm text-text-tertiary mb-3">Set the times you're free. Founders can only book slots you've added here.</p>
            <button onClick={addWindow} className="text-sm font-medium text-[#1a4d2e] hover:underline">
              + Add your first window
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {windows.map((w, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-gray-50">
                <select value={w.day_of_week} onChange={e => updateWindow(i, { day_of_week: parseInt(e.target.value, 10) })}
                  className="text-sm px-2 py-1.5 rounded-md border border-border-strong bg-white">
                  {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
                </select>
                <input type="time" value={w.start_time} onChange={e => updateWindow(i, { start_time: e.target.value })}
                  className="text-sm px-2 py-1.5 rounded-md border border-border-strong bg-white" />
                <span className="text-xs text-gray-500">to</span>
                <input type="time" value={w.end_time} onChange={e => updateWindow(i, { end_time: e.target.value })}
                  className="text-sm px-2 py-1.5 rounded-md border border-border-strong bg-white" />
                <select value={w.timezone} onChange={e => updateWindow(i, { timezone: e.target.value })}
                  className="text-sm px-2 py-1.5 rounded-md border border-border-strong bg-white flex-1 min-w-0">
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
                <button onClick={() => removeWindow(i)}
                  className="text-xs text-red-600 hover:text-red-800 px-2">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {windows.length > 0 && (
          <button onClick={addWindow} className="mt-3 text-sm font-medium text-[#1a4d2e] hover:underline">
            + Add another window
          </button>
        )}

        <div className="mt-5 flex items-center gap-3 pt-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="bg-[#1a4d2e] hover:bg-[#143d24] text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save availability'}
          </button>
          {message && (
            <span className={`text-sm ${message.kind === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
