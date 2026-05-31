'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RotateCw, MessageSquareMore, Users } from 'lucide-react'
import { NextActionsBlock, Card } from '@/components/ui'
import { mockPitchDebriefNextActions } from '@/lib/next-actions'
import type { Debrief, DimensionScore, SlideBreakdown, QuestionBreakdown, SuggestedQuestion, PriorityFix } from '@/lib/mock-pitch'

type TabId = 'overview' | 'dimensions' | 'slides' | 'questions' | 'other' | 'priorities'

export default function DebriefView({ sessionId, mode, durationMin, company, companySlug, debrief, startedAt, isGenerating }: {
  sessionId: string
  mode: 'pitch' | 'qa'
  durationMin: number
  company: string
  companySlug: string
  debrief: Debrief | null
  startedAt: string
  isGenerating: boolean
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [waiting, setWaiting] = useState(isGenerating)

  // Poll while debrief is being generated
  useEffect(() => {
    if (!isGenerating || debrief) return
    let cancelled = false
    let elapsed = 0
    const poll = async () => {
      while (!cancelled && elapsed < 180) {  // up to 3 minutes
        await new Promise(r => setTimeout(r, 4000))
        elapsed += 4
        try {
          const res = await fetch(`/api/mock-pitch/sessions/${sessionId}`, { cache: 'no-store' })
          if (!res.ok) continue
          const data = await res.json()
          if (data.session?.debrief) {
            router.refresh()
            setWaiting(false)
            return
          }
        } catch {}
      }
    }
    poll()
    return () => { cancelled = true }
  }, [sessionId, isGenerating, debrief, router])

  // Loading state — no debrief yet
  if (!debrief || waiting) {
    return <DebriefLoading />
  }

  const tabs = buildTabs(mode, debrief)
  const downloadUrl = `/api/mock-pitch/debrief-pdf?sessionId=${sessionId}`

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">📋 Session debrief</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {company} · {mode === 'pitch' ? `🎙️ ${durationMin}-min pitch` : `❓ ${durationMin}-min Q&A`} · {new Date(startedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary whitespace-nowrap">
            📄 Download PDF
          </a>
          <Link href="/mock-pitch" className="text-xs border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary whitespace-nowrap">← All sessions</Link>
          {companySlug && (
            <Link href={`/match/${companySlug}`} className="text-xs text-brand hover:underline whitespace-nowrap">View deck analysis →</Link>
          )}
        </div>
      </div>

      {/* Headline score card */}
      <ScoreHeader debrief={debrief} />

      {/* Tabs */}
      <div className="border-b border-border mb-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`text-sm whitespace-nowrap px-3 py-2 border-b-2 transition ${activeTab === t.id ? 'border-brand text-brand font-medium' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
              {t.label}{t.count != null && t.count > 0 && <span className="ml-1 text-[10px] text-text-disabled">({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'overview' && <OverviewTab debrief={debrief} mode={mode} />}
        {activeTab === 'dimensions' && <DimensionsTab debrief={debrief} />}
        {activeTab === 'slides' && debrief.per_slide && <SlidesTab slides={debrief.per_slide} />}
        {activeTab === 'questions' && debrief.per_question && <QuestionsTab questions={debrief.per_question} />}
        {activeTab === 'other' && debrief.suggested_questions && <OtherTab suggested={debrief.suggested_questions} />}
        {activeTab === 'priorities' && <PrioritiesTab debrief={debrief} />}
      </div>

      {/* What's next — journey-ending CTAs. Renders BELOW all tabs
          (regardless of which tab is active) so it always feels like
          the closing section of the debrief — the natural transition
          to the next step in the founder's journey. */}
      <NextActionsForDebrief debrief={debrief} mode={mode} />

      <p className="text-[11px] text-text-disabled text-center mt-8">
        Your audio was never stored — only the text transcript powered this debrief.
      </p>
    </div>
  )
}

// ─── Tab builder ───────────────────────────────────────────────────
function buildTabs(mode: 'pitch' | 'qa', d: Debrief): { id: TabId; label: string; count?: number }[] {
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'dimensions', label: '📈 Dimensions', count: Object.keys(d.dimensions || {}).length },
  ]
  if (mode === 'pitch' && d.per_slide?.length) {
    tabs.push({ id: 'slides', label: '🎞️ Per-slide', count: d.per_slide.length })
  }
  if (mode === 'qa' && d.per_question?.length) {
    tabs.push({ id: 'questions', label: '❓ Per-question', count: d.per_question.length })
  }
  if (mode === 'qa' && d.suggested_questions?.length) {
    tabs.push({ id: 'other', label: '💼 Other likely Qs', count: d.suggested_questions.length })
  }
  tabs.push({ id: 'priorities', label: '🎯 Priority fixes', count: d.priority_fixes.length })
  return tabs
}

// ─── What's next CTAs (directed-graph wiring) ──────────────────────
function NextActionsForDebrief({ debrief, mode }: { debrief: Debrief; mode: 'pitch' | 'qa' }) {
  // Find the weakest dimension to suggest a focused re-run
  const weakest = useMemo(() => {
    const dims = Object.entries(debrief.dimensions || {})
    if (dims.length === 0) return null
    dims.sort((a, b) => a[1].score - b[1].score)
    return dims[0][0]
  }, [debrief.dimensions])

  const actions = mockPitchDebriefNextActions({
    sessionType:      mode,
    overallScore:     debrief.overall_score ?? null,
    weakestDimension: weakest,
    retryIcon:  <RotateCw className="w-5 h-5" strokeWidth={1.5} />,
    switchIcon: <MessageSquareMore className="w-5 h-5" strokeWidth={1.5} />,
    expertIcon: <Users className="w-4 h-4" strokeWidth={1.5} />,
  })

  if (actions.length === 0) return null

  return (
    <Card className="mt-6">
      <NextActionsBlock
        title="What's next"
        subtitle={
          debrief.overall_score != null && debrief.overall_score < 65
            ? `Score ${debrief.overall_score}/100 — let's close the gap.`
            : `Score ${debrief.overall_score}/100 — solid run. Time to stress-test it.`
        }
        actions={actions}
      />
    </Card>
  )
}

// ─── Loading state ─────────────────────────────────────────────────
function DebriefLoading() {
  return (
    <div className="max-w-3xl mx-auto py-16 text-center">
      <div className="text-5xl mb-4 animate-pulse">🧠</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">Generating your debrief…</h2>
      <p className="text-sm text-text-tertiary max-w-md mx-auto">The AI is analyzing your session — scoring each part, identifying strengths and gaps, and preparing actionable feedback. This usually takes 30-90 seconds.</p>
      <div className="mt-6 flex justify-center">
        <div className="h-1 w-48 bg-surface-sunken rounded-full overflow-hidden">
          <div className="h-full bg-brand animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
      <p className="text-[11px] text-text-disabled mt-6">This page will update automatically when ready.</p>
    </div>
  )
}

// ─── Score header ──────────────────────────────────────────────────
function ScoreHeader({ debrief }: { debrief: Debrief }) {
  const score = debrief.overall_score
  const readinessColor = readinessClasses(debrief.investor_readiness)
  return (
    <div className="bg-gradient-to-br from-[#1a4d2e] to-[#143d24] text-white rounded-xl p-5 mb-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Overall score</div>
          <div className="text-4xl sm:text-5xl font-bold leading-none">{score}<span className="text-2xl opacity-70"> / 100</span></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Investor readiness</div>
          <div className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${readinessColor}`}>{debrief.investor_readiness}</div>
        </div>
      </div>
      <p className="text-sm opacity-95 mt-3 leading-relaxed">{debrief.summary}</p>
      <div className="text-[10px] opacity-70 mt-3 border-t border-white/15 pt-2">
        <strong>Scoring guide:</strong> 0-44 Weak · 45-64 Needs Work · 65-79 Good · 80+ Strong
      </div>
    </div>
  )
}

// ─── Tab: Overview ──────────────────────────────────────────────────
function OverviewTab({ debrief, mode }: { debrief: Debrief; mode: 'pitch' | 'qa' }) {
  // Top + bottom dimension highlights
  const dimEntries = Object.entries(debrief.dimensions || {})
  const sorted = dimEntries.sort((a, b) => b[1].score - a[1].score)
  const top3 = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()

  return (
    <div className="space-y-4">
      {/* Mini dimension overview */}
      {dimEntries.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-sm font-semibold text-text-primary mb-3">Dimension scores at a glance</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {dimEntries.map(([key, dim]) => (
              <div key={key} className="border border-gray-100 rounded-lg p-2">
                <div className="text-[10px] uppercase tracking-wide text-text-tertiary">{prettyDimName(key)}</div>
                <div className={`text-xl font-bold ${scoreColor(dim.score)}`}>{dim.score}</div>
                <div className="w-full h-1 bg-surface-muted rounded-full overflow-hidden mt-1">
                  <div className={`h-full ${barColor(dim.score)}`} style={{ width: `${dim.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-success-bg border border-success-border rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-success-text mb-2">✓ Where you scored highest</div>
          <ul className="space-y-1.5">
            {top3.map(([key, dim]) => (
              <li key={key} className="text-sm text-emerald-900">
                <strong>{prettyDimName(key)} ({dim.score}):</strong> {dim.found[0] || dim.best_practice.slice(0, 100)}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-danger-bg border border-danger-border rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-danger-text mb-2">⚠ Biggest gaps</div>
          <ul className="space-y-1.5">
            {bottom3.map(([key, dim]) => (
              <li key={key} className="text-sm text-red-900">
                <strong>{prettyDimName(key)} ({dim.score}):</strong> {dim.missing[0] || 'See Dimensions tab for detail.'}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {debrief.actionable_next_steps.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-900 mb-2">📌 Before your next {mode === 'pitch' ? 'pitch' : 'Q&A'}</div>
          <ol className="space-y-1.5 list-decimal list-inside">
            {debrief.actionable_next_steps.map((s, i) => (
              <li key={i} className="text-sm text-blue-900 leading-relaxed">{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Dimensions ───────────────────────────────────────────────
function DimensionsTab({ debrief }: { debrief: Debrief }) {
  return (
    <div className="grid gap-3">
      {Object.entries(debrief.dimensions || {}).map(([key, dim]) => (
        <DimensionCard key={key} name={prettyDimName(key)} dim={dim} />
      ))}
    </div>
  )
}

function DimensionCard({ name, dim }: { name: string; dim: DimensionScore }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-semibold text-text-primary">{name}</div>
          <div className="text-[10px] text-text-tertiary">Weight: {dim.weight_pct}%</div>
        </div>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBadge(dim.score)}`}>{dim.score} / {dim.max_score}</div>
      </div>
      <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden mb-3">
        <div className={`h-full ${barColor(dim.score)}`} style={{ width: `${(dim.score / Math.max(dim.max_score, 1)) * 100}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {dim.found.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-success-text font-semibold mb-1">✓ Found</div>
            <ul className="space-y-0.5">{dim.found.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}</ul>
          </div>
        )}
        {dim.missing.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-danger-text font-semibold mb-1">⚠ Missing</div>
            <ul className="space-y-0.5">{dim.missing.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}</ul>
          </div>
        )}
      </div>
      {dim.best_practice && (
        <div className="bg-blue-50 border border-blue-100 rounded-md p-2 mt-2">
          <div className="text-[10px] uppercase tracking-wide text-blue-900 font-semibold mb-0.5">💡 Best practice</div>
          <p className="text-xs text-blue-900 leading-relaxed">{dim.best_practice}</p>
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-text-tertiary mt-2 flex-wrap gap-2">
        {dim.score_impact && <span>{dim.score_impact}</span>}
        {dim.fix_effort && <span>Effort: <strong>{dim.fix_effort}</strong></span>}
      </div>
    </div>
  )
}

// ─── Tab: Slides (Pitch) ───────────────────────────────────────────
function SlidesTab({ slides }: { slides: SlideBreakdown[] }) {
  return (
    <div className="space-y-3">
      {slides.map((s, i) => <SlideCard key={i} slide={s} />)}
    </div>
  )
}

function SlideCard({ slide }: { slide: SlideBreakdown }) {
  const paceColor = slide.pace === 'good' ? 'bg-emerald-100 text-success-text' : slide.pace === 'silent' ? 'bg-surface-muted text-text-tertiary' : 'bg-warning-bg text-warning-text'
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">Slide {slide.slide}</span>
          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${paceColor}`}>{slide.pace}</span>
        </div>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBadge(slide.score)}`}>{slide.score} / 100</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {slide.what_worked.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-success-text font-semibold mb-1">✓ Worked</div>
            <ul className="space-y-0.5">{slide.what_worked.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}</ul>
          </div>
        )}
        {slide.what_to_improve.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-danger-text font-semibold mb-1">⚠ Improve</div>
            <ul className="space-y-0.5">{slide.what_to_improve.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}</ul>
          </div>
        )}
      </div>
      {slide.best_practice && (
        <div className="bg-blue-50 border border-blue-100 rounded-md p-2 mt-2">
          <div className="text-[10px] uppercase tracking-wide text-blue-900 font-semibold mb-0.5">💡 How a top founder would pitch this slide</div>
          <p className="text-xs text-blue-900 leading-relaxed">{slide.best_practice}</p>
        </div>
      )}
      {slide.how_to_be_better && (
        <div className="bg-purple-50 border border-purple-100 rounded-md p-2 mt-2">
          <div className="text-[10px] uppercase tracking-wide text-purple-900 font-semibold mb-0.5">🎯 How you can be better</div>
          <p className="text-xs text-purple-900 leading-relaxed">{slide.how_to_be_better}</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Questions (Q&A) ──────────────────────────────────────────
function QuestionsTab({ questions }: { questions: QuestionBreakdown[] }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => <QuestionCard key={i} qb={q} index={i + 1} />)}
    </div>
  )
}

function QuestionCard({ qb, index }: { qb: QuestionBreakdown; index: number }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Q{index} · {qb.area}</div>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBadge(qb.score)}`}>{qb.score} / 100</div>
      </div>
      <p className="text-sm font-medium text-text-primary mb-3 leading-snug">{qb.q}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {qb.what_worked.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-success-text font-semibold mb-1">✓ Worked</div>
            <ul className="space-y-0.5">{qb.what_worked.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}</ul>
          </div>
        )}
        {qb.what_was_missing.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-danger-text font-semibold mb-1">⚠ Missing</div>
            <ul className="space-y-0.5">{qb.what_was_missing.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}</ul>
          </div>
        )}
      </div>
      {qb.best_practice_answer && (
        <div className="bg-blue-50 border border-blue-100 rounded-md p-2 mt-2">
          <div className="text-[10px] uppercase tracking-wide text-blue-900 font-semibold mb-0.5">💡 Best-practice answer</div>
          <p className="text-xs text-blue-900 leading-relaxed">{qb.best_practice_answer}</p>
        </div>
      )}
      {qb.how_to_be_better && (
        <div className="bg-purple-50 border border-purple-100 rounded-md p-2 mt-2">
          <div className="text-[10px] uppercase tracking-wide text-purple-900 font-semibold mb-0.5">🎯 How you can be better</div>
          <p className="text-xs text-purple-900 leading-relaxed">{qb.how_to_be_better}</p>
        </div>
      )}
      {qb.follow_ups.length > 0 && (
        <div className="bg-warning-bg border border-amber-100 rounded-md p-2 mt-2">
          <div className="text-[10px] uppercase tracking-wide text-warning-text font-semibold mb-1">⚡ Likely follow-ups</div>
          {qb.follow_ups.map((f, i) => (
            <div key={i} className="mt-1.5 first:mt-0">
              <p className="text-xs font-medium text-warning-text">→ {f.q}</p>
              <ul className="ml-3 mt-0.5 space-y-0.5">
                {f.talking_points.map((tp, j) => <li key={j} className="text-[11px] text-warning-text">• {tp}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Other (Q&A bonus) ────────────────────────────────────────
function OtherTab({ suggested }: { suggested: SuggestedQuestion[] }) {
  return (
    <div className="space-y-3">
      <div className="bg-warning-bg border border-warning-border rounded-md p-3 text-xs text-warning-text">
        💡 These are additional questions investors are likely to ask in a real pitch. Use the talking points to prepare.
      </div>
      {suggested.map((q, i) => <SuggestedCard key={i} q={q} />)}
    </div>
  )
}

function SuggestedCard({ q }: { q: SuggestedQuestion }) {
  return (
    <div className="bg-white border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wide bg-surface-muted text-text-secondary px-1.5 py-0.5 rounded-full">{q.area}</span>
      </div>
      <p className="text-sm font-medium text-text-primary mb-2 leading-snug">{q.q}</p>
      {q.talking_points.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-blue-900 font-semibold mb-1">💡 Talking points</div>
          <ul className="space-y-0.5">
            {q.talking_points.map((tp, i) => <li key={i} className="text-xs text-text-secondary">• {tp}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Priorities ───────────────────────────────────────────────
function PrioritiesTab({ debrief }: { debrief: Debrief }) {
  if (!debrief.priority_fixes.length) {
    return <div className="text-sm text-text-tertiary text-center py-8">No critical fixes — your pitch is solid on the basics.</div>
  }
  return (
    <div className="space-y-2">
      {debrief.priority_fixes.map((p, i) => <PriorityCard key={i} fix={p} />)}
    </div>
  )
}

function PriorityCard({ fix }: { fix: PriorityFix }) {
  const colors = {
    critical: 'bg-danger-bg border-danger-border text-red-900',
    high:     'bg-warning-bg border-warning-border text-warning-text',
    polish:   'bg-surface-muted border-border text-text-primary',
  }
  const label = { critical: '🔴 Critical', high: '🟡 High', polish: '🔵 Polish' }
  return (
    <div className={`border rounded-lg p-3 ${colors[fix.priority]}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold">{label[fix.priority]}</span>
          <span className="text-sm font-semibold">{fix.title}</span>
        </div>
        <div className="text-[10px] flex items-center gap-2">
          {fix.score_impact && <span>{fix.score_impact}</span>}
          {fix.effort && <span>Effort: <strong>{fix.effort}</strong></span>}
        </div>
      </div>
      <p className="text-xs leading-relaxed">{fix.description}</p>
    </div>
  )
}

// ─── helpers ───────────────────────────────────────────────────────
function scoreColor(s: number): string {
  if (s >= 80) return 'text-success-text'
  if (s >= 65) return 'text-warning-text'
  if (s >= 45) return 'text-orange-600'
  return 'text-danger-text'
}
function scoreBadge(s: number): string {
  if (s >= 80) return 'text-success-text bg-success-bg'
  if (s >= 65) return 'text-warning-text bg-warning-bg'
  if (s >= 45) return 'text-orange-700 bg-orange-50'
  return 'text-danger-text bg-danger-bg'
}
function barColor(s: number): string {
  if (s >= 80) return 'bg-success-solid'
  if (s >= 65) return 'bg-warning-solid'
  if (s >= 45) return 'bg-orange-500'
  return 'bg-danger-solid'
}
function readinessClasses(r: Debrief['investor_readiness']): string {
  switch (r) {
    case 'Strong': return 'bg-success-solid/30 text-emerald-100 border border-emerald-300/40'
    case 'Good': return 'bg-warning-solid/30 text-amber-100 border border-amber-300/40'
    case 'Needs Work': return 'bg-orange-500/30 text-orange-100 border border-orange-300/40'
    case 'Weak': return 'bg-danger-solid/30 text-red-100 border border-red-300/40'
  }
}
function prettyDimName(key: string): string {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
