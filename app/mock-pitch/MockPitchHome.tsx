'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target } from 'lucide-react'
import { PITCH_DURATIONS, QA_DURATIONS, questionCountForDuration, type Mode } from '@/lib/mock-pitch'

type Sub = { id: string; unique_slug: string; company_name: string; stage: string | null; sector: string | null; created_at: string }
type Session = {
  id: string
  submission_id: string | null
  mode: string
  duration_min: number
  status: string
  started_at: string
  completed_at: string | null
  debrief: { overall_score?: number; summary?: string } | null
  submission: Sub | null
}

export default function MockPitchHome({ submissions, sessions }: { submissions: Sub[]; sessions: Session[] }) {
  const router = useRouter()
  const [picker, setPicker] = useState<{ sub: Sub; mode: Mode } | null>(null)
  const [starting, setStarting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function startSession(sub: Sub, mode: Mode, durationMin: number) {
    setStarting(true); setErr(null)
    try {
      const res = await fetch('/api/mock-pitch/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: sub.id, mode, durationMin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      router.push(`/mock-pitch/${data.sessionId}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to start')
      setStarting(false)
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Practice your pitch</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Run a full pitch or drill investor questions — using your own deck.
        </p>
      </div>

      {/* Recommended order hint — only shown when user has no completed sessions */}
      {sessions.filter(s => s.status === 'completed').length === 0 && submissions.length > 0 && (
        <div className="mb-5 bg-brand-soft border border-brand/20 rounded-lg px-4 py-3 flex items-start gap-3">
          <Target className="w-4 h-4 text-brand shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">Recommended order:</span>{' '}
            start with a full pitch run-through. Once your story flows well, drill investor Q&A to test how you handle pushback.
          </div>
        </div>
      )}

      {err && <div className="bg-danger-bg border border-danger-border text-danger-text text-sm rounded-md p-2.5 mb-4">{err}</div>}

      {/* Pick a deck */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Pick a deck to practice with</h2>
        {submissions.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-8 text-center">
            <div className="text-3xl opacity-30 mb-2">📋</div>
            <h3 className="text-base font-semibold text-text-primary mb-1">Analyze a deck first</h3>
            <p className="text-sm text-text-tertiary mb-3">Mock pitch uses your actual deck. Upload one to get started — takes 60 seconds.</p>
            <a href="/apply" className="text-xs bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5 inline-block">
              Analyze a deck →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {submissions.map(sub => (
              <button key={sub.id} onClick={() => setPicker({ sub, mode: 'pitch' })}
                className="bg-white border border-border rounded-xl p-4 text-left hover:border-brand hover:shadow-sm transition">
                <div className="text-sm font-semibold text-text-primary">{sub.company_name}</div>
                <div className="text-[11px] text-text-tertiary mt-0.5">{sub.stage || '?'} · {sub.sector || '?'}</div>
                <div className="text-[10px] text-text-disabled mt-2">Analyzed {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div className="text-[11px] text-brand mt-2 font-medium">Practice this deck →</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Past sessions */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Past sessions</h2>
          <div className="bg-white border border-border rounded-xl divide-y divide-gray-100">
            {sessions.map(s => (
              <div key={s.id} className="p-3 flex items-center justify-between gap-3 hover:bg-surface-muted">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {s.submission?.company_name || '(deleted deck)'} · {s.mode === 'pitch' ? '🎙️ Pitch' : '❓ Q&A'} · {s.duration_min}min
                  </div>
                  <div className="text-[11px] text-text-tertiary flex items-center gap-2">
                    {new Date(s.started_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    {s.status === 'completed' && s.debrief?.overall_score != null && (
                      <span className="bg-[#f4f9f5] text-brand px-1.5 py-0.5 rounded-full">Score {s.debrief.overall_score}/100</span>
                    )}
                    {s.status === 'in_progress' && <span className="bg-warning-bg text-warning-text px-1.5 py-0.5 rounded-full">In progress</span>}
                    {s.status === 'abandoned' && <span className="bg-surface-muted text-text-tertiary px-1.5 py-0.5 rounded-full">Abandoned</span>}
                  </div>
                </div>
                <a href={s.status === 'completed' ? `/mock-pitch/${s.id}/debrief` : `/mock-pitch/${s.id}`}
                  className="text-xs text-brand hover:underline flex-shrink-0">
                  {s.status === 'completed' ? 'View debrief' : 'Continue'}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode + duration picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => !starting && setPicker(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Practice: {picker.sub.company_name}</h2>
                <p className="text-[11px] text-text-tertiary">Pick a mode + duration.</p>
              </div>
              <button onClick={() => !starting && setPicker(null)} className="text-text-disabled hover:text-text-secondary">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Mode */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPicker({ ...picker, mode: 'pitch' })}
                    className={`text-left border rounded-lg p-3 transition ${picker.mode === 'pitch' ? 'border-brand bg-[#f4f9f5]' : 'border-border'}`}>
                    <div className="text-sm font-semibold">🎙️ Pitch only</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">Walk through your deck. AI listens.</div>
                  </button>
                  <button onClick={() => setPicker({ ...picker, mode: 'qa' })}
                    className={`text-left border rounded-lg p-3 transition ${picker.mode === 'qa' ? 'border-brand bg-[#f4f9f5]' : 'border-border'}`}>
                    <div className="text-sm font-semibold">❓ Q&A only</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">AI grills you with VC questions.</div>
                  </button>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {(picker.mode === 'pitch' ? PITCH_DURATIONS : QA_DURATIONS).map(d => (
                    <button key={d} onClick={() => startSession(picker.sub, picker.mode, d)} disabled={starting}
                      className="border border-border-strong rounded-lg p-3 hover:border-brand hover:bg-[#f4f9f5] transition disabled:opacity-50">
                      <div className="text-base font-bold text-text-primary">{d} min</div>
                      {picker.mode === 'qa' && (
                        <div className="text-[10px] text-text-tertiary mt-0.5">{questionCountForDuration(d)} questions</div>
                      )}
                    </button>
                  ))}
                </div>
                {starting && <div className="text-xs text-text-tertiary mt-3">⏳ {picker.mode === 'qa' ? 'Generating questions…' : 'Starting…'}</div>}
              </div>

              <div className="text-[10px] text-text-disabled leading-relaxed border-t border-gray-100 pt-3">
                🎙️ Your microphone is processed locally in your browser. Audio is never uploaded or stored — only the transcribed text is saved.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
