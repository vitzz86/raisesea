'use client'

// ═══════════════════════════════════════════════════════════════
// components/BetaProgressCard.tsx
//
// Dashboard widget for beta testers. Shows:
//   - Title + progress bar (X of N tasks done)
//   - 5 task cards with status + CTAs
//   - Each task has "Share feedback" button when ready
//   - Auto-triggers final survey when all required tasks are done
//
// "Done" = user submitted feedback for that task (we don't track
// task completion separately — the feedback IS the completion signal).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, MessageSquare, ChevronRight, Sparkles, X } from 'lucide-react'
import FeedbackModal from './FeedbackModal'
import { BETA_TASKS, FINAL_SURVEY, REQUIRED_TASKS, type BetaTask } from '@/lib/beta-tasks'

type FeedbackRecord = {
  task_key: string
  rating:   number
  message:  string | null
}

export default function BetaProgressCard() {
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [openTask, setOpenTask] = useState<BetaTask | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [finalSurveyShown, setFinalSurveyShown] = useState(false)

  // Check localStorage on mount: was the entire card dismissed?
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem('beta_card_dismissed') === '1')
      setFinalSurveyShown(localStorage.getItem('beta_final_survey_shown') === '1')
    }
  }, [])

  // Fetch the user's feedback history
  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      if (res.ok) setFeedback(data.feedback || [])
    } catch (e) {
      console.error('Failed to fetch feedback:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  // Map of task_key → feedback record (for fast lookup + edit support)
  const feedbackMap = new Map<string, FeedbackRecord>()
  for (const f of feedback) feedbackMap.set(f.task_key, f)

  // Auto-trigger final survey when all required tasks have feedback
  const requiredDoneCount = REQUIRED_TASKS.filter(t => feedbackMap.has(t.key)).length
  const allRequiredDone   = requiredDoneCount === REQUIRED_TASKS.length
  const finalDone         = feedbackMap.has(FINAL_SURVEY.key)

  useEffect(() => {
    if (!loading && allRequiredDone && !finalDone && !finalSurveyShown && !openTask) {
      // Show final survey once
      setOpenTask(FINAL_SURVEY)
      if (typeof window !== 'undefined') {
        localStorage.setItem('beta_final_survey_shown', '1')
      }
      setFinalSurveyShown(true)
    }
  }, [loading, allRequiredDone, finalDone, finalSurveyShown, openTask])

  // Hidden once everything done + dismissed
  if (dismissed && allRequiredDone && finalDone) return null

  // Hidden if user clicked the dismiss X
  if (dismissed) return null

  const totalCount = BETA_TASKS.length
  const doneCount  = BETA_TASKS.filter(t => feedbackMap.has(t.key)).length
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-soft) 0%, rgba(255,255,255,0) 100%)',
        border: '1px solid var(--brand)',
        borderRadius: 16, padding: 20, marginBottom: 24, position: 'relative',
      }}>
        {/* Dismiss X */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined') localStorage.setItem('beta_card_dismissed', '1')
            setDismissed(true)
          }}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 4, color: 'var(--text-tertiary)', borderRadius: 4,
          }}
          aria-label="Dismiss"
          title="Hide for this session"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Sparkles size={18} style={{ color: 'var(--brand)' }} />
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--brand)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Beta tester
          </div>
        </div>
        <h2 style={{
          fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
          marginTop: 4, marginBottom: 4,
        }}>
          Help us shape RaiseSEA
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
          Try each feature and share your thoughts. Takes ~15 minutes total.
        </p>

        {/* Progress bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, marginBottom: 4, color: 'var(--text-tertiary)',
            fontWeight: 500,
          }}>
            <span>{doneCount} of {totalCount} tasks</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progressPct}%</span>
          </div>
          <div style={{
            width: '100%', height: 6, background: 'rgba(255,255,255,.7)',
            borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPct}%`, height: '100%',
              background: 'var(--brand)', transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {BETA_TASKS.map(task => {
            const done = feedbackMap.has(task.key)
            const fb   = feedbackMap.get(task.key)
            return (
              <TaskRow
                key={task.key}
                task={task}
                done={done}
                rating={fb?.rating}
                onFeedback={() => setOpenTask(task)}
              />
            )
          })}
        </div>

        {/* Done state */}
        {allRequiredDone && finalDone && (
          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: 'var(--success-bg)', borderRadius: 8,
            fontSize: 12, color: 'var(--success-text)', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success-solid)' }} />
            All beta tasks complete. Thank you for shaping the product 🙌
          </div>
        )}
      </div>

      {/* Feedback modal — opens when user clicks "Share feedback" on a task */}
      {openTask && (
        <FeedbackModal
          task={openTask}
          open={true}
          onClose={() => setOpenTask(null)}
          onSubmitted={refresh}
          existingRating={feedbackMap.get(openTask.key)?.rating || null}
          existingMessage={feedbackMap.get(openTask.key)?.message || null}
        />
      )}
    </>
  )
}

// ─── TaskRow: single task in the list ────────────────────────
function TaskRow({
  task, done, rating, onFeedback,
}: {
  task: BetaTask
  done: boolean
  rating?: number
  onFeedback: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: 'white',
      border: '1px solid var(--border-muted)', borderRadius: 10,
    }}>
      {/* Status icon */}
      {done
        ? <CheckCircle2 size={18} style={{ color: 'var(--success-solid)', flexShrink: 0 }} />
        : <Circle size={18} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      }

      {/* Title + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: done ? 'var(--text-tertiary)' : 'var(--text-primary)',
          textDecoration: done ? 'line-through' : 'none',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {task.title}
          {task.optional && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: 'var(--text-disabled)',
              background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Optional
            </span>
          )}
          {done && rating !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--brand)',
              background: 'var(--brand-soft)', padding: '1px 6px', borderRadius: 4,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {rating}/10
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2,
        }}>
          {task.description}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!done && (
          <Link
            href={task.cta_href}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', fontSize: 11, fontWeight: 600,
              background: 'var(--brand)', color: 'white',
              borderRadius: 6, textDecoration: 'none',
            }}
          >
            {task.cta_label}
            <ChevronRight size={12} />
          </Link>
        )}
        <button
          onClick={onFeedback}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', fontSize: 11, fontWeight: 600,
            background: done ? 'var(--surface-muted)' : 'transparent',
            color: 'var(--text-secondary)',
            border: done ? '1px solid var(--border-muted)' : '1px solid var(--border)',
            borderRadius: 6, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <MessageSquare size={12} />
          {done ? 'Edit' : 'Feedback'}
        </button>
      </div>
    </div>
  )
}
