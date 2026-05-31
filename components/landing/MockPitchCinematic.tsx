// ═══════════════════════════════════════════════════════════════
// components/landing/MockPitchCinematic.tsx
//
// Dedicated Mock Pitch cinematic for the mid-page Feature 2 section.
// Showcases the voice-pitch flow in more depth than the hero cinematic.
//
// 4 phases (~17s total loop):
//   Phase 1 (3.0s): PICKER     — choose deck, choose mode, click start
//   Phase 2 (5.5s): RECORDING  — mic, timer, waveform, transcript building
//   Phase 3 (2.0s): ANALYZING  — spinner with analysis steps
//   Phase 4 (6.5s): DEBRIEF    — score reveal, dimension breakdown, suggested Q
//
// Same behavior as HeroCinematic: auto-loop, pause on tab blur,
// respect prefers-reduced-motion, tappable phase indicator.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Mic, MessageSquare, CheckCircle2, Sparkles, Target, Play, Clock
} from 'lucide-react'
import { cn } from '@/lib/cn'

const PHASES = [
  { key: 'picker',    label: 'Pick',      duration: 3000 },
  { key: 'recording', label: 'Recording', duration: 5500 },
  { key: 'analyzing', label: 'Analyzing', duration: 2000 },
  { key: 'debrief',   label: 'Debrief',   duration: 6500 },
] as const

type PhaseKey = (typeof PHASES)[number]['key']

export function MockPitchCinematic() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    if (mq.matches) setPhaseIdx(3)
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
      {/* Window chrome */}
      <div className="bg-surface-muted border-b border-border-muted px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="w-2 h-2 rounded-full bg-border-strong" />
        <span className="ml-3 text-[11px] text-text-tertiary font-medium truncate">
          Mock Pitch · {PHASES[phaseIdx].label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {PHASES.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPhaseIdx(i)}
              aria-label={`Jump to ${p.label}`}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i === phaseIdx ? 'w-5 bg-brand' : 'w-1.5 bg-border-strong hover:bg-text-tertiary'
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative h-[460px] overflow-hidden bg-surface-page">
        <Layer active={currentKey === 'picker'}>    <PickerPhase    active={currentKey === 'picker'}    /> </Layer>
        <Layer active={currentKey === 'recording'}> <RecordingPhase active={currentKey === 'recording'} /> </Layer>
        <Layer active={currentKey === 'analyzing'}> <AnalyzingPhase active={currentKey === 'analyzing'} /> </Layer>
        <Layer active={currentKey === 'debrief'}>   <DebriefPhase   active={currentKey === 'debrief'}   /> </Layer>
      </div>
    </div>
  )
}

function Layer({ active, children }: { active: boolean; children: React.ReactNode }) {
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

// ─── Phase 1: PICKER ───────────────────────────────────────────────

function PickerPhase({ active }: { active: boolean }) {
  const [selectedMode, setSelectedMode] = useState<'pitch' | 'qa'>('pitch')
  const [buttonPulse, setButtonPulse] = useState(false)

  useEffect(() => {
    if (!active) { setSelectedMode('pitch'); setButtonPulse(false); return }
    const t1 = setTimeout(() => setSelectedMode('pitch'), 800)
    const t2 = setTimeout(() => setButtonPulse(true), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [active])

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-text-primary tracking-tight">Practice your pitch</h3>
        <p className="text-[11px] text-text-tertiary mt-0.5">Pick a deck and a mode</p>
      </div>

      {/* Deck card */}
      <div className="bg-surface-card border border-brand rounded-xl p-3.5 mb-4 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-10 bg-brand-soft rounded-md flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-brand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-text-primary">TechCorp · v3</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">Seed · B2B SaaS · Analyzed 2 days ago · 78/100</div>
          </div>
          <CheckCircle2 className="w-4 h-4 text-brand shrink-0" strokeWidth={2} />
        </div>
      </div>

      {/* Mode picker — 2 cards */}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Mode</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={cn(
          'border rounded-xl p-3 transition-all duration-300 cursor-pointer',
          selectedMode === 'pitch'
            ? 'border-brand bg-brand-soft/40 shadow-subtle'
            : 'border-border bg-surface-card'
        )}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-semibold text-text-primary">Full pitch</span>
            {selectedMode === 'pitch' && <CheckCircle2 className="w-3.5 h-3.5 text-brand" strokeWidth={2} />}
          </div>
          <div className="text-[10px] text-text-tertiary leading-relaxed">Run through your whole deck. 3 or 5 min.</div>
        </div>
        <div className="border border-border bg-surface-card rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-semibold text-text-primary">Investor Q&A</span>
          </div>
          <div className="text-[10px] text-text-tertiary leading-relaxed">AI drills the hard questions.</div>
        </div>
      </div>

      {/* Duration sub-picker */}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Duration</div>
      <div className="flex gap-2 mb-5">
        {['3 min', '5 min', '10 min'].map((d, i) => (
          <span
            key={d}
            className={cn(
              'text-[10px] px-2.5 py-1 rounded-md border',
              i === 1
                ? 'bg-brand text-text-inverse border-brand font-medium'
                : 'bg-surface-card text-text-secondary border-border-strong'
            )}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Start button (with pulse hint) */}
      <button
        className={cn(
          'self-start inline-flex items-center gap-2 bg-brand text-text-inverse text-sm font-medium rounded-md px-4 py-2 transition-all',
          buttonPulse && 'shadow-elevated scale-[1.03]'
        )}
      >
        <Play className="w-3.5 h-3.5" strokeWidth={2} />
        Start pitch
      </button>
    </div>
  )
}

// ─── Phase 2: RECORDING ────────────────────────────────────────────

function RecordingPhase({ active }: { active: boolean }) {
  const transcriptChunks = [
    'Hi, I\'m the founder of TechCorp.',
    'We\'re tackling a $4B problem in SEA SME finance.',
    'Last year, 60% of small businesses in Indonesia and Vietnam still ran their bookkeeping manually.',
    'Our AI invoicing automation cuts that work by 80%.',
    'We hit $40K MRR in our first 6 months, growing 22% month over month…',
  ]
  const [time, setTime] = useState(180)
  const [transcriptIdx, setTranscriptIdx] = useState(0)

  useEffect(() => {
    if (!active) { setTime(180); setTranscriptIdx(0); return }
    const timeInt = setInterval(() => setTime(t => Math.max(0, t - 3)), 100)
    const trInt = setInterval(() => setTranscriptIdx(i => Math.min(i + 1, transcriptChunks.length)), 950)
    return () => { clearInterval(timeInt); clearInterval(trInt) }
  }, [active, transcriptChunks.length])

  const mins = Math.floor(time / 60), secs = time % 60
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">Recording your pitch</h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">Speak naturally. AI transcribes + scores live.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-danger-bg text-danger-text">
          <span className="w-1.5 h-1.5 rounded-full bg-danger-solid animate-pulse" />
          REC
        </span>
      </div>

      <div className="flex-1 bg-surface-card border border-border rounded-xl p-5 flex flex-col items-center">
        {/* Mic + timer */}
        <div className="flex items-center gap-5 mb-4">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping" />
            <span className="absolute inset-1 rounded-full bg-brand/20 animate-ping" style={{ animationDelay: '0.4s' }} />
            <div className="relative w-12 h-12 bg-brand text-text-inverse rounded-full flex items-center justify-center shadow-elevated">
              <Mic className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="flex flex-col items-start">
            <div className="text-2xl font-semibold text-text-primary tabular-nums tracking-tight">{timeStr}</div>
            <div className="text-[10px] text-text-tertiary">of 3:00 remaining</div>
          </div>
        </div>

        {/* Waveform */}
        <div className="flex items-center gap-1 h-8 mb-4">
          {[...Array(36)].map((_, i) => (
            <span
              key={i}
              className="w-0.5 bg-brand rounded-full animate-pulse"
              style={{
                height: `${25 + Math.abs(Math.sin(i * 0.5) * 60) + Math.abs(Math.cos(i * 1.3) * 25)}%`,
                animationDelay: `${i * 0.06}s`,
                animationDuration: `${0.5 + (i % 4) * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* Live transcript */}
        <div className="w-full bg-surface-muted rounded-lg px-4 py-3 flex-1 overflow-hidden">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            Live transcript
          </div>
          <div className="text-[11px] text-text-secondary leading-relaxed">
            {transcriptChunks.slice(0, transcriptIdx).map((chunk, i) => (
              <span key={i}>{chunk} </span>
            ))}
            {transcriptIdx < transcriptChunks.length && <span className="inline-block w-0.5 h-3 bg-brand animate-pulse align-middle" />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Phase 3: ANALYZING ───────────────────────────────────────────

function AnalyzingPhase({ active }: { active: boolean }) {
  return (
    <div className="h-full p-5 md:p-7 flex flex-col items-center justify-center">
      <div className="bg-surface-card border border-border rounded-xl p-8 flex flex-col items-center max-w-sm">
        <div className="relative w-14 h-14">
          <span className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand" strokeWidth={1.5} />
          </div>
        </div>
        <div className="text-base font-semibold text-text-primary mt-4">Analyzing your delivery</div>
        <div className="text-[11px] text-text-tertiary mt-1">Pace · Coverage · Defense · Story arc</div>

        {/* Steps ticker */}
        <div className="mt-4 space-y-1.5 w-full">
          {['Transcribing audio', 'Mapping to deck slides', 'Scoring 8 dimensions', 'Generating debrief'].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-[11px] text-text-secondary transition-all duration-500"
              style={{
                opacity:   active ? 1 : 0,
                transform: active ? 'translateX(0)' : 'translateX(-4px)',
                transitionDelay: `${i * 250}ms`,
              }}
            >
              <CheckCircle2 className="w-3 h-3 text-success-solid shrink-0" strokeWidth={2} />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Phase 4: DEBRIEF ──────────────────────────────────────────────

function DebriefPhase({ active }: { active: boolean }) {
  const targetScore = 82
  const circumference = 264
  const dashFull = (targetScore / 100) * circumference
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (!active) { setScore(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / 1300, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setScore(Math.round(targetScore * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active])

  return (
    <div className="h-full p-5 md:p-7 flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">Your pitch score</h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">3-min pitch · TechCorp v3</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success-bg text-success-text">
          Investor-ready
        </span>
      </div>

      {/* Score + slide bars */}
      <div className="bg-surface-card border border-border rounded-xl p-4 flex items-center gap-5 mb-3">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-muted)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="var(--brand)" strokeWidth="6"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={active ? `${circumference - dashFull}` : `${circumference}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-text-primary tabular-nums">{score}</span>
            <span className="text-[9px] text-text-tertiary mt-0.5">of 100</span>
          </div>
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Slide-by-slide</div>
          {[
            { label: 'Problem',  pct: 92, pace: 'good' },
            { label: 'Solution', pct: 64, pace: 'silent' },
            { label: 'Market',   pct: 88, pace: 'good' },
            { label: 'Team',     pct: 71, pace: 'fast' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary w-14 shrink-0">{s.label}</span>
              <span className={cn(
                'text-[8px] font-medium px-1 py-px rounded',
                s.pace === 'good' ? 'bg-success-bg text-success-text' :
                s.pace === 'silent' ? 'bg-surface-muted text-text-tertiary' :
                'bg-warning-bg text-warning-text'
              )}>
                {s.pace}
              </span>
              <div className="flex-1 h-1 bg-border-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    s.pct >= 80 ? 'bg-success-solid' : s.pct >= 70 ? 'bg-brand' : 'bg-warning-solid'
                  )}
                  style={{ width: active ? `${s.pct}%` : '0%', transitionDuration: '800ms', transitionDelay: `${700 + i * 100}ms` }}
                />
              </div>
              <span className="text-[10px] font-medium text-text-primary w-7 text-right tabular-nums">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Q from investor */}
      <div
        className="bg-brand-soft/40 border border-brand/20 rounded-md p-3 transition-all duration-500"
        style={{
          opacity:   active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(6px)',
          transitionDelay: '1400ms',
        }}
      >
        <div className="flex items-start gap-2.5">
          <MessageSquare className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-brand">Likely follow-up Q</div>
            <div className="text-[11px] text-text-primary mt-1 leading-relaxed">
              "Your Solution slide was 23 seconds shorter than recommended. What's the one-sentence answer for what makes you different?"
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
