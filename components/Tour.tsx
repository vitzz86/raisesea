// ═══════════════════════════════════════════════════════════════
// components/Tour.tsx
//
// First-run guided tour. 5 modal-based steps that walk new users
// through the RaiseSEA journey: Assess → Prepare → Execute.
//
// Behavior:
//   • Shows on first dashboard visit (no localStorage flag set)
//   • Dismissible at any point (Skip or X)
//   • Re-triggerable from "?" icon in DashboardShell header
//   • Each step has prev/next/skip controls
//   • Voice: "Sharp Friend" — direct, no fluff, encouraging
//
// Storage:
//   localStorage['raisesea_tour_completed'] = 'true' once user finishes or skips
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, FileText, Target, Users, Briefcase, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'

const STORAGE_KEY = 'raisesea_tour_completed'

interface TourStep {
  icon:        React.ReactNode
  title:       string
  description: string
  highlight?:  string  // optional emphasis text
}

const STEPS: TourStep[] = [
  {
    icon:        <Sparkles className="w-6 h-6" strokeWidth={1.5} />,
    title:       'Welcome to RaiseSEA',
    description: 'You\'ve got a deck. We\'ll help you turn it into a closed round. Here\'s the 60-second tour.',
    highlight:   'Assess → Prepare → Execute',
  },
  {
    icon:        <FileText className="w-6 h-6" strokeWidth={1.5} />,
    title:       'Assess your deck',
    description: 'Upload your pitch deck and get an AI-powered analysis in 60 seconds — deck score, market sizing, competitor analysis, and matched investors from our SEA database.',
  },
  {
    icon:        <Target className="w-6 h-6" strokeWidth={1.5} />,
    title:       'Prepare your pitch',
    description: 'Practice your story with mock pitches and drill investor Q&A. The AI listens, scores, and tells you exactly where you fumbled — before a real investor catches it.',
  },
  {
    icon:        <Users className="w-6 h-6" strokeWidth={1.5} />,
    title:       'Talk to experts',
    description: 'Stuck on something? Book 30 minutes with a mentor, VC, or domain expert. Free for now. Pick someone who\'s been where you\'re going.',
  },
  {
    icon:        <Briefcase className="w-6 h-6" strokeWidth={1.5} />,
    title:       'Execute the raise',
    description: 'Track every investor you talk to in the built-in CRM. Categorize, stage them, log notes after meetings. Stop using a spreadsheet you have to babysit.',
  },
]

interface TourProps {
  open:    boolean
  onClose: () => void
}

export function Tour({ open, onClose }: TourProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1
  const current = STEPS[step]

  const handleNext = () => {
    if (isLast) {
      finish()
    } else {
      setStep(s => s + 1)
    }
  }

  const handleSkip = () => {
    finish()
  }

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* ignore */ }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-overlay"
      onClick={handleSkip}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div
        className="bg-surface-card rounded-2xl shadow-elevated max-w-md w-full p-7 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close (X) */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step
                  ? 'w-6 bg-brand'
                  : i < step
                    ? 'w-2 bg-brand/60'
                    : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-brand-soft rounded-full flex items-center justify-center text-brand">
            {current.icon}
          </div>
        </div>

        {/* Content */}
        <h2 id="tour-title" className="text-xl font-semibold text-text-primary text-center mb-2 tracking-tight">
          {current.title}
        </h2>
        <p className="text-sm text-text-secondary text-center leading-relaxed mb-2">
          {current.description}
        </p>
        {current.highlight && (
          <p className="text-xs font-medium text-brand text-center mb-2">
            {current.highlight}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={isFirst}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>

          <button
            onClick={handleSkip}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Skip
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleNext}
          >
            {isLast ? 'Get started' : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Hook to detect first-run + provide trigger ────────────────────

export function useTour(): {
  open:          boolean
  openTour:      () => void
  closeTour:     () => void
  isFirstRun:    boolean
} {
  const [open, setOpen] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)

  useEffect(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEY)
      if (!completed) {
        setIsFirstRun(true)
        // Auto-open on first visit, slight delay so layout settles
        const t = setTimeout(() => setOpen(true), 400)
        return () => clearTimeout(t)
      }
    } catch { /* ignore (SSR, privacy mode, etc.) */ }
  }, [])

  return {
    open,
    openTour:  () => setOpen(true),
    closeTour: () => setOpen(false),
    isFirstRun,
  }
}
