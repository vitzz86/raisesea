'use client'

// ═══════════════════════════════════════════════════════════════
// components/FeedbackModal.tsx
//
// Reusable feedback modal. Takes a BetaTask and shows:
//   - The task's feedback_question as headline
//   - A 1-10 rating slider with task-specific min/max labels
//   - Optional message textarea
//   - Submit → POST /api/feedback
//
// Used by:
//   - BetaProgressCard ("Share feedback" button per task)
//   - FinalSurveyModal (wraps this with the FINAL_SURVEY task)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import type { BetaTask } from '@/lib/beta-tasks'

type Props = {
  task:        BetaTask
  open:        boolean
  onClose:     () => void
  onSubmitted?: () => void   // parent re-fetches feedback list to update UI
  // Pre-fill if user is editing previous feedback
  existingRating?:  number | null
  existingMessage?: string | null
}

export default function FeedbackModal({
  task, open, onClose, onSubmitted,
  existingRating, existingMessage,
}: Props) {
  const [rating, setRating]   = useState<number>(existingRating || 7)
  const [message, setMessage] = useState<string>(existingMessage || '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Reset state when modal opens for a new task
  useEffect(() => {
    if (open) {
      setRating(existingRating || 7)
      setMessage(existingMessage || '')
      setDone(false)
      setError('')
    }
  }, [open, task.key, existingRating, existingMessage])

  // ESC closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open) return null

  async function handleSubmit() {
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_key: task.key,
          rating,
          message:  message.trim(),
          page_url: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback')

      setDone(true)
      if (onSubmitted) onSubmitted()
      // Auto-close after 1.5s "thanks" state
      setTimeout(() => { onClose() }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // Get rating color: red(1-3) → yellow(4-6) → green(7-10)
  const ratingColor =
    rating <= 3  ? '#dc2626'   :     // red-600
    rating <= 6  ? '#d97706'   :     // amber-600
                   '#16a34a'         // green-600

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-card)', borderRadius: 16,
          maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,.24)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '20px 24px 0', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--brand)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
            }}>
              Beta feedback · {task.title}
            </div>
            <h2 style={{
              fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
              lineHeight: 1.3, margin: 0,
            }}>
              {task.feedback_question}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              padding: 4, color: 'var(--text-tertiary)', borderRadius: 6,
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          {done ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '32px 0', textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--success-bg)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Check size={28} style={{ color: 'var(--success-solid)' }} strokeWidth={3} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Thanks for the feedback!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                We read every response.
              </div>
            </div>
          ) : (
            <>
              {/* Rating slider */}
              <div style={{ marginTop: 20 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', marginBottom: 8,
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {task.rating_min_label}
                  </span>
                  <span style={{
                    fontSize: 28, fontWeight: 700, color: ratingColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {rating}
                    <span style={{ fontSize: 14, color: 'var(--text-disabled)', fontWeight: 500 }}>/10</span>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {task.rating_max_label}
                  </span>
                </div>
                <input
                  type="range" min={1} max={10} step={1}
                  value={rating}
                  onChange={e => setRating(parseInt(e.target.value, 10))}
                  disabled={submitting}
                  style={{
                    width: '100%', accentColor: ratingColor, cursor: 'pointer',
                  }}
                />
                {/* Tick marks underneath the slider */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 4, fontSize: 10, color: 'var(--text-disabled)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n}>{n}</span>)}
                </div>
              </div>

              {/* Message textarea */}
              <div style={{ marginTop: 24 }}>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: 6,
                }}>
                  What worked? What didn&apos;t? <span style={{ color: 'var(--text-disabled)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  disabled={submitting}
                  rows={4}
                  maxLength={2000}
                  placeholder="The more specific, the better. What surprised you? What confused you? What would you change?"
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1px solid var(--border)', borderRadius: 8,
                    fontSize: 13, fontFamily: 'inherit', color: 'var(--text-primary)',
                    background: 'var(--surface-page)', resize: 'vertical',
                    minHeight: 90,
                  }}
                />
                <div style={{
                  fontSize: 10, color: 'var(--text-disabled)',
                  textAlign: 'right', marginTop: 2,
                }}>
                  {message.length} / 2000
                </div>
              </div>

              {error && (
                <div style={{
                  marginTop: 12, padding: '8px 12px',
                  background: 'var(--danger-bg)', color: 'var(--danger-text)',
                  borderRadius: 6, fontSize: 12,
                }}>
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 500,
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text-secondary)',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Maybe later
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    padding: '8px 18px', fontSize: 13, fontWeight: 600,
                    background: 'var(--brand)', border: 'none',
                    borderRadius: 8, color: 'white',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Sending...' : 'Send feedback'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
