// ═══════════════════════════════════════════════════════════════
// components/landing/HeroCinematic.tsx
//
// 5-phase auto-looping cinematic showing the full founder journey.
// Each phase's visual matches the ACTUAL product UI so the demo
// feels like a real product preview, not generic abstractions.
//
// Pacing (~30s total): each phase has animation time + meaningful
// hold time so viewers can actually read what they're seeing.
//
//   Phase 1 (5.0s): UPLOAD   — /apply form layout filling in
//   Phase 2 (5.0s): ANALYZE  — analysis-in-progress with dim checks
//   Phase 3 (6.0s): RESULT   — /match/[id] overview tab layout
//   Phase 4 (8.0s): PRACTICE — recording (4s) → debrief (4s)
//   Phase 5 (6.0s): CRM      — /crm table layout with filters
//
// Behavior: auto-loop, pause on tab blur, respect prefers-reduced-motion,
// phase indicator dots are tappable.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useEffect, useRef } from 'react'
import {
  FileText, Sparkles, BarChart3, Target, Mic, Building2, CheckCircle2,
  Calendar, Filter, Search, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/cn'

const PHASES = [
  { key: 'upload',   label: 'Submit',   duration: 5000 },
  { key: 'analyze',  label: 'Analyze',  duration: 5000 },
  { key: 'result',   label: 'Result',   duration: 6000 },
  { key: 'practice', label: 'Practice', duration: 8000 },
  { key: 'crm',      label: 'CRM',      duration: 6000 },
] as const

type PhaseKey = (typeof PHASES)[number]['key']

const phaseCaptions: Record<PhaseKey, string> = {
  upload:   'Submit your company details and pitch deck.',
  analyze:  'AI scores 8 dimensions and benchmarks against SEA raises.',
  result:   'Get your deck score, valuation, and matched SEA investors.',
  practice: 'Practice the pitch out loud. AI scores your delivery.',
  crm:      'Track every investor conversation in one place.',
}

export function HeroCinematic() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    if (mq.matches) setPhaseIdx(2) // Show "Result" as static representative
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (reducedMotion || paused) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setPhaseIdx(i => (i + 1) % PHASES.length)
    }, PHASES[phaseIdx].duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phaseIdx, reducedMotion, paused])

  const currentKey = PHASES[phaseIdx].key

  return (
    <div className="bg-surface-card border border-border rounded-2xl shadow-elevated overflow-hidden">
      {/* App chrome — looks like our real DashboardShell */}
      <div className="bg-surface-muted border-b border-border-muted px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="ml-3 text-[11px] text-text-tertiary font-medium truncate">
          raisesea.com · {PHASES[phaseIdx].label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {PHASES.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPhaseIdx(i)}
              aria-label={`Jump to ${p.label} phase`}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i === phaseIdx
                  ? 'w-5 bg-brand'
                  : 'w-1.5 bg-border-strong hover:bg-text-tertiary'
              )}
            />
          ))}
        </div>
      </div>

      {/* Stage — taller to accommodate denser, more accurate layouts */}
      <div className="relative h-[480px] md:h-[520px] overflow-hidden bg-surface-page">
        <PhaseLayer active={currentKey === 'upload'}>   <UploadPhase   active={currentKey === 'upload'}   /> </PhaseLayer>
        <PhaseLayer active={currentKey === 'analyze'}>  <AnalyzePhase  active={currentKey === 'analyze'}  /> </PhaseLayer>
        <PhaseLayer active={currentKey === 'result'}>   <ResultPhase   active={currentKey === 'result'}   /> </PhaseLayer>
        <PhaseLayer active={currentKey === 'practice'}> <PracticePhase active={currentKey === 'practice'} /> </PhaseLayer>
        <PhaseLayer active={currentKey === 'crm'}>      <CrmPhase      active={currentKey === 'crm'}      /> </PhaseLayer>
      </div>

      {/* Caption + status */}
      <div className="bg-surface-muted/60 border-t border-border-muted px-5 py-3 flex items-center justify-between">
        <div className="text-[11px] text-text-secondary">
          <span className="font-semibold text-text-primary">{PHASES[phaseIdx].label}.</span>{' '}
          {phaseCaptions[currentKey]}
        </div>
        {!reducedMotion && (
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <span className={cn('w-1.5 h-1.5 rounded-full', paused ? 'bg-text-disabled' : 'bg-success-solid animate-pulse')} />
            {paused ? 'Paused' : 'Auto-play'}
          </div>
        )}
      </div>
    </div>
  )
}

function PhaseLayer({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-500',
        active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1 — UPLOAD (matches /apply form layout)
// ═══════════════════════════════════════════════════════════════

function UploadPhase({ active }: { active: boolean }) {
  const fields = [
    { label: 'Company',  value: 'TechCorp Pte Ltd',     delay: 200 },
    { label: 'Sector',   value: 'B2B SaaS',             delay: 600 },
    { label: 'Stage',    value: 'Seed',                 delay: 1000 },
    { label: 'Raising',  value: '$1.5M on $8M cap',     delay: 1400 },
  ]
  const [fileAttached, setFileAttached] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!active) { setFileAttached(false); setSubmitted(false); return }
    const f = setTimeout(() => setFileAttached(true), 2200)
    const s = setTimeout(() => setSubmitted(true), 3800)
    return () => { clearTimeout(f); clearTimeout(s) }
  }, [active])

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      {/* Mini "page header" — matches PageHeader style */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary tracking-tight">New deck analysis</h3>
        <p className="text-[11px] text-text-tertiary mt-0.5">Fill in your company details. Upload your deck. We do the rest.</p>
      </div>

      {/* Card wrapping the form — like real /apply */}
      <div className="flex-1 bg-surface-card border border-border rounded-xl p-4 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Company</div>

        {/* Form field grid */}
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f, i) => (
            <FormField
              key={i}
              label={f.label}
              value={f.value}
              active={active}
              delay={f.delay}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border-muted my-3" />

        {/* Deck upload row */}
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Pitch deck</div>
        <div className={cn(
          'border border-dashed rounded-lg p-3 flex items-center gap-3 transition-all duration-500',
          fileAttached ? 'border-success-solid bg-success-bg/40' : 'border-border-strong'
        )}>
          {fileAttached ? (
            <>
              <div className="w-9 h-10 bg-surface-card border border-border rounded-md flex flex-col items-center justify-center shrink-0 shadow-subtle">
                <FileText className="w-4 h-4 text-brand" strokeWidth={1.5} />
                <span className="text-[7px] font-semibold text-text-tertiary mt-0.5">PDF</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-text-primary truncate">techcorp_deck_v3.pdf</div>
                <div className="text-[9px] text-text-tertiary mt-0.5">14 slides · 8.2 MB · Uploaded</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-success-solid shrink-0" strokeWidth={2} />
            </>
          ) : (
            <>
              <div className="w-9 h-10 bg-surface-muted rounded-md flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-text-tertiary" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-text-secondary">Drop your deck or click to upload</div>
                <div className="text-[9px] text-text-tertiary mt-0.5">PDF, PPT, or Keynote · up to 20 MB</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        className={cn(
          'mt-4 self-end flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all duration-500',
          submitted
            ? 'bg-success-solid text-text-inverse'
            : fileAttached
              ? 'bg-brand text-text-inverse shadow-subtle'
              : 'bg-border-strong text-text-tertiary cursor-not-allowed'
        )}
        disabled={!fileAttached}
      >
        {submitted ? (<><CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Submitted — analyzing now…</>) : 'Submit for analysis →'}
      </button>
    </div>
  )
}

function FormField({ label, value, active, delay }: { label: string; value: string; active: boolean; delay: number }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) { setShown(false); return }
    const t = setTimeout(() => setShown(true), delay)
    return () => clearTimeout(t)
  }, [active, delay])

  return (
    <div>
      <label className="block text-[10px] font-medium text-text-tertiary mb-1">{label}</label>
      <div className="bg-surface-page border border-border-strong rounded-md px-2.5 py-1.5 h-[28px] flex items-center transition-all duration-300">
        <span className={cn(
          'text-[11px] text-text-primary truncate transition-all duration-400',
          shown ? 'opacity-100' : 'opacity-0'
        )}>
          {value}
        </span>
        {!shown && active && (
          <span className="w-0.5 h-3 bg-brand animate-pulse" />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — ANALYZE
// ═══════════════════════════════════════════════════════════════

function AnalyzePhase({ active }: { active: boolean }) {
  const dims = ['Problem', 'Market sizing', 'Product', 'Traction', 'Team', 'Financials', 'Go-to-market', 'The ask']
  const [completed, setCompleted] = useState(0)

  useEffect(() => {
    if (!active) { setCompleted(0); return }
    let i = 0
    const interval = setInterval(() => {
      i++; setCompleted(Math.min(i, dims.length))
      if (i >= dims.length) clearInterval(interval)
    }, 350)
    return () => clearInterval(interval)
  }, [active, dims.length])

  const pct = Math.round((completed / dims.length) * 100)

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary tracking-tight">Analyzing your deck</h3>
        <p className="text-[11px] text-text-tertiary mt-0.5">Benchmarked on real SEA raises · ~60 seconds</p>
      </div>

      <div className="flex-1 bg-surface-card border border-border rounded-xl p-5 flex flex-col">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-brand" strokeWidth={2} />
            Scoring 8 dimensions
          </span>
          <span className="text-[11px] font-semibold text-brand tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 bg-border-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-brand transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Dimension list — vertical with status icons */}
        <div className="space-y-1.5 flex-1">
          {dims.map((d, i) => {
            const isComplete = i < completed
            const isActive   = i === completed && active && completed < dims.length
            return (
              <div
                key={d}
                className={cn(
                  'flex items-center gap-3 px-3 py-1.5 rounded-md transition-all duration-300',
                  isComplete ? 'bg-success-bg' : isActive ? 'bg-surface-muted' : 'bg-transparent'
                )}
              >
                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-success-text" strokeWidth={2} />
                  ) : isActive ? (
                    <span className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border-2 border-border-strong" />
                  )}
                </div>
                <span className={cn(
                  'text-[11px] flex-1',
                  isComplete ? 'text-text-primary font-medium' : isActive ? 'text-text-primary' : 'text-text-tertiary'
                )}>{d}</span>
                {isComplete && (
                  <span className="text-[10px] font-semibold text-success-text tabular-nums">
                    {[85, 72, 76, 91, 80, 58, 74, 82][i]}/100
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3 — RESULT (matches /match/[id] overview tab)
// ═══════════════════════════════════════════════════════════════

function ResultPhase({ active }: { active: boolean }) {
  const targetScore = 78
  const circumference = 264
  const dashFull = (targetScore / 100) * circumference
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (!active) { setScore(0); return }
    const start = Date.now()
    const dur = 1400
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / dur, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setScore(Math.round(targetScore * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active])

  const dims = [
    { name: 'Problem',       score: 85, color: 'success' },
    { name: 'Market sizing', score: 72, color: 'brand' },
    { name: 'Traction',      score: 91, color: 'success' },
    { name: 'Financials',    score: 58, color: 'warning' },
  ]

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      {/* Header with company name + score badge */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">TechCorp · Deck Analysis</h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">Completed just now · Investor-ready</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success-bg text-success-text">
          Complete
        </span>
      </div>

      {/* Tab strip — matches real MatchView */}
      <div className="border-b border-border-muted mb-3 flex gap-3 text-[11px]">
        <span className="border-b-2 border-brand text-brand font-medium px-1 pb-1.5">Overview</span>
        <span className="text-text-tertiary px-1 pb-1.5">Deck score</span>
        <span className="text-text-tertiary px-1 pb-1.5">Market</span>
        <span className="text-text-tertiary px-1 pb-1.5">Competitors</span>
        <span className="text-text-tertiary px-1 pb-1.5">Investors</span>
      </div>

      {/* 4 metric cards — matches OverviewTab layout exactly */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <MetricCard label="Deck score"   value={`${score}/100`} sub="Strong"           accent="success" delay={0} active={active} />
        <MetricCard label="Valuation"    value="$8M–$12M"       sub="SEA seed"                          delay={200} active={active} />
        <MetricCard label="Moat score"   value="7/10"           sub="Solid"                             delay={400} active={active} />
        <MetricCard label="Investors"    value="34 matches"     sub="Top: Vertex"      accent="success" delay={600} active={active} />
      </div>

      {/* Score circle + dimension bars side by side */}
      <div className="flex-1 bg-surface-card border border-border rounded-xl p-4 flex items-center gap-5">
        {/* Big score circle */}
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-muted)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="var(--brand)" strokeWidth="6"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={active ? `${circumference - dashFull}` : `${circumference}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-text-primary tabular-nums">{score}</span>
            <span className="text-[9px] text-text-tertiary mt-0.5">of 100</span>
          </div>
        </div>

        {/* Dimension bars — 4 top dimensions */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Top dimensions</div>
          {dims.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2.5">
              <div className="text-[10px] text-text-secondary w-20 shrink-0">{d.name}</div>
              <div className="flex-1 h-1 bg-border-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000 ease-out',
                    d.color === 'success' ? 'bg-success-solid' : d.color === 'warning' ? 'bg-warning-solid' : 'bg-brand'
                  )}
                  style={{
                    width: active ? `${d.score}%` : '0%',
                    transitionDelay: `${800 + i * 130}ms`,
                  }}
                />
              </div>
              <div className="text-[10px] font-medium text-text-primary w-6 text-right tabular-nums">
                {active ? d.score : 0}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent, delay, active }: {
  label: string; value: string; sub: string; accent?: 'success'; delay: number; active: boolean
}) {
  return (
    <div
      className="bg-surface-card border border-border rounded-lg p-2 sm:p-2.5 transition-all duration-500 min-w-0 overflow-hidden"
      style={{
        opacity:   active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(6px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary truncate">{label}</div>
      <div className={cn('text-xs sm:text-sm font-semibold mt-0.5 tabular-nums truncate', accent === 'success' ? 'text-success-text' : 'text-text-primary')}>
        {value}
      </div>
      <div className="text-[9px] text-text-tertiary mt-0.5 truncate">{sub}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — PRACTICE (recording + debrief)
// ═══════════════════════════════════════════════════════════════

function PracticePhase({ active }: { active: boolean }) {
  const targetScore = 82
  const circumference = 264
  const dashFull = (targetScore / 100) * circumference

  const [stage, setStage] = useState<'recording' | 'analyzing' | 'debrief'>('recording')
  const [score, setScore] = useState(0)
  const [time, setTime] = useState(180)
  const [transcriptIdx, setTranscriptIdx] = useState(0)

  const transcriptChunks = [
    'Hi, I\'m the founder of TechCorp.',
    'We help SEA SMEs automate invoicing.',
    'Market is $4B in Indonesia alone, growing 28% YoY.',
    'We hit $40K MRR in our first 6 months…',
  ]

  useEffect(() => {
    if (!active) {
      setStage('recording'); setScore(0); setTime(180); setTranscriptIdx(0)
      return
    }

    // Timer ticks
    const timeInt = setInterval(() => setTime(t => Math.max(0, t - 3)), 100)
    // Transcript builds up
    const trInt = setInterval(() => setTranscriptIdx(i => Math.min(i + 1, transcriptChunks.length)), 800)

    // Transition: recording → analyzing
    const t1 = setTimeout(() => {
      clearInterval(timeInt); clearInterval(trInt); setStage('analyzing')
    }, 3800)

    // Transition: analyzing → debrief, animate score
    const t2 = setTimeout(() => {
      setStage('debrief')
      const start = Date.now()
      const tick = () => {
        const elapsed = Date.now() - start
        const t = Math.min(elapsed / 1100, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        setScore(Math.round(targetScore * eased))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, 4900)

    return () => {
      clearInterval(timeInt); clearInterval(trInt)
      clearTimeout(t1); clearTimeout(t2)
    }
  }, [active, transcriptChunks.length])

  const mins = Math.floor(time / 60), secs = time % 60
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            {stage === 'debrief' ? 'TechCorp Pitch Debrief' : 'Mock Pitch · TechCorp deck'}
          </h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {stage === 'recording' && 'Recording your pitch — speak naturally'}
            {stage === 'analyzing' && 'Analyzing your delivery…'}
            {stage === 'debrief'   && 'AI scored every dimension'}
          </p>
        </div>
        {stage === 'recording' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-danger-bg text-danger-text">
            <span className="w-1.5 h-1.5 rounded-full bg-danger-solid animate-pulse" />
            REC
          </span>
        )}
        {stage === 'debrief' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success-bg text-success-text">
            Investor-ready
          </span>
        )}
      </div>

      <div className="flex-1 bg-surface-card border border-border rounded-xl p-5 flex items-center justify-center">
        {stage === 'recording' && (
          <div className="w-full max-w-sm flex flex-col items-center">
            {/* Pulsing mic */}
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping" />
              <span className="absolute inset-1 rounded-full bg-brand/20 animate-ping" style={{ animationDelay: '0.4s' }} />
              <div className="relative w-12 h-12 bg-brand text-text-inverse rounded-full flex items-center justify-center shadow-elevated">
                <Mic className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-3 text-xl font-semibold text-text-primary tabular-nums tracking-tight">{timeStr}</div>

            {/* Waveform */}
            <div className="mt-3 flex items-center gap-1 h-7">
              {[...Array(24)].map((_, i) => (
                <span
                  key={i}
                  className="w-0.5 bg-brand rounded-full animate-pulse"
                  style={{
                    height: `${30 + Math.abs(Math.sin(i * 0.7) * 50) + Math.abs(Math.cos(i) * 25)}%`,
                    animationDelay: `${i * 0.07}s`,
                    animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>

            {/* Live transcript */}
            <div className="mt-4 w-full bg-surface-muted rounded-md px-3 py-2 text-left min-h-[60px]">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Live transcript</div>
              <div className="text-[11px] text-text-secondary leading-relaxed">
                {transcriptChunks.slice(0, transcriptIdx).map((chunk, i) => (
                  <span key={i} className="inline">{chunk} </span>
                ))}
                {transcriptIdx < transcriptChunks.length && <span className="inline-block w-0.5 h-3 bg-brand animate-pulse" />}
              </div>
            </div>
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="flex flex-col items-center">
            <div className="relative w-12 h-12">
              <span className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            </div>
            <div className="text-sm font-medium text-text-primary mt-3">Analyzing your delivery</div>
            <div className="text-[11px] text-text-tertiary mt-1">Transcription, pace, coverage, defense quality…</div>
          </div>
        )}

        {stage === 'debrief' && (
          <div className="flex items-center gap-5 w-full">
            {/* Score circle */}
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-muted)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="var(--brand)" strokeWidth="6"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={`${circumference - dashFull}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-text-primary tabular-nums">{score}</span>
                <span className="text-[9px] text-text-tertiary mt-0.5">of 100</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Per-slide breakdown</div>
              {[
                { label: 'Problem',  pct: 92 },
                { label: 'Solution', pct: 64 },
                { label: 'Market',   pct: 88 },
                { label: 'Team',     pct: 71 },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-[10px] text-text-secondary w-14">{s.label}</span>
                  <div className="flex-1 h-1 bg-border-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        s.pct >= 80 ? 'bg-success-solid' : s.pct >= 70 ? 'bg-brand' : 'bg-warning-solid'
                      )}
                      style={{ width: `${s.pct}%`, transitionDuration: '800ms', transitionDelay: `${500 + i * 100}ms` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-text-primary w-7 text-right tabular-nums">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — CRM (matches /crm table layout)
// ═══════════════════════════════════════════════════════════════

function CrmPhase({ active }: { active: boolean }) {
  const rows = [
    { priority: 'high',   priorityColor: 'bg-danger-bg text-danger-text',     name: 'Sarah Chen',    firm: 'Vertex Ventures SEA', stage: 'In talks',   stageColor: 'bg-success-bg text-success-text',  next: 'Send Q3 traction',     date: 'Tomorrow' },
    { priority: 'high',   priorityColor: 'bg-danger-bg text-danger-text',     name: 'Andre Liu',     firm: 'East Ventures',       stage: 'In talks',   stageColor: 'bg-success-bg text-success-text',  next: 'Schedule partner call', date: 'Jun 3' },
    { priority: 'medium', priorityColor: 'bg-warning-bg text-warning-text',   name: 'Priya Singh',   firm: 'Cocoon Capital',      stage: 'Contacted',  stageColor: 'bg-brand-soft text-brand',         next: 'Reply to email thread', date: 'Jun 5' },
    { priority: 'medium', priorityColor: 'bg-warning-bg text-warning-text',   name: 'Ridwan Putra',  firm: 'Alpha JWC',           stage: 'Contacted',  stageColor: 'bg-brand-soft text-brand',         next: 'Send updated deck',     date: 'Jun 7' },
    { priority: 'low',    priorityColor: 'bg-surface-muted text-text-tertiary', name: 'Wei Zhang',   firm: 'Insignia Ventures',   stage: 'Researched', stageColor: 'bg-surface-sunken text-text-secondary', next: 'Find warm intro',      date: '—' },
  ]

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">Investor CRM</h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">25 active investors · TechCorp's raise</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[10px] font-medium px-2 py-1 rounded bg-surface-card border border-border-strong text-text-secondary flex items-center gap-1">
            <Filter className="w-3 h-3" strokeWidth={1.75} /> Filter
          </button>
          <button className="text-[10px] font-medium px-3 py-1 rounded bg-brand text-text-inverse">+ Add contact</button>
        </div>
      </div>

      {/* Filter chips row */}
      <div
        className="flex items-center gap-1.5 mb-3 transition-all duration-500"
        style={{
          opacity:   active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(4px)',
          transitionDelay: '200ms',
        }}
      >
        <Search className="w-3 h-3 text-text-tertiary" strokeWidth={1.75} />
        <span className="text-[10px] text-text-tertiary mr-1">Filters:</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">Priority: High</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">Stage: In talks</span>
        <span className="text-[10px] text-brand ml-1">+ 1 more</span>
      </div>

      {/* Table — matches real CRM table */}
      <div className="flex-1 bg-surface-card border border-border rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[60px_1.4fr_1fr_90px_1.2fr_70px] gap-2 bg-surface-muted/70 border-b border-border-muted px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">
          <div>Priority</div>
          <div>Name</div>
          <div>Firm</div>
          <div>Stage</div>
          <div>Next action</div>
          <div>Due</div>
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[60px_1.4fr_1fr_90px_1.2fr_70px] gap-2 px-3 py-2.5 border-b border-border-muted last:border-b-0 text-[11px] transition-all duration-500"
            style={{
              opacity:   active ? 1 : 0,
              transform: active ? 'translateX(0)' : 'translateX(-8px)',
              transitionDelay: `${400 + i * 120}ms`,
            }}
          >
            <div>
              <span className={cn('inline-block text-[9px] font-medium px-1.5 py-0.5 rounded', r.priorityColor)}>
                {r.priority}
              </span>
            </div>
            <div className="text-text-primary font-medium truncate">{r.name}</div>
            <div className="text-text-tertiary truncate">{r.firm}</div>
            <div>
              <span className={cn('inline-block text-[9px] font-medium px-1.5 py-0.5 rounded', r.stageColor)}>
                {r.stage}
              </span>
            </div>
            <div className="text-text-secondary truncate flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-brand shrink-0" strokeWidth={1.75} />
              <span className="truncate">{r.next}</span>
            </div>
            <div className="text-text-tertiary tabular-nums flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" strokeWidth={1.75} />
              {r.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
