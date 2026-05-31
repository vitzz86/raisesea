// ═══════════════════════════════════════════════════════════════
// components/calculator/DilutionInsight.tsx
//
// Shared advisory component for Equity + Convertible calculators.
// Shows the dilution %, where it falls vs typical SEA benchmarks,
// and a one-liner of contextual advice.
//
// Benchmarks by stage (SEA market — sources: Carta SEA data,
// Iconiq seed/Series A reports, Cento Ventures SEA outlook 2026):
//
//   • Pre-seed (<$500K raise):  8–15% typical, sweet spot 10–12%
//   • Seed ($500K–$2M):         15–25% typical, sweet spot 18–22%
//   • Series A ($2M–$15M):      15–25% typical, sweet spot 18–22%
//   • Series B+ (>$15M):        10–20% typical, sweet spot 12–18%
//
// If a stage is passed in (from the user's deck analysis), the
// advice is benchmarked to that stage. Otherwise it infers from
// raise size.
// ═══════════════════════════════════════════════════════════════

import { TrendingUp, AlertTriangle, CheckCircle2, TrendingDown, Info } from 'lucide-react'

export type FundingStage = 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus'

export interface DilutionBenchmark {
  stageName:        string
  typicalMinPct:    number
  typicalMaxPct:    number
  sweetSpotMinPct:  number
  sweetSpotMaxPct:  number
}

export const STAGE_BENCHMARKS: Record<FundingStage, DilutionBenchmark> = {
  pre_seed:      { stageName: 'pre-seed',     typicalMinPct:  8, typicalMaxPct: 15, sweetSpotMinPct: 10, sweetSpotMaxPct: 12 },
  seed:          { stageName: 'seed',         typicalMinPct: 15, typicalMaxPct: 25, sweetSpotMinPct: 18, sweetSpotMaxPct: 22 },
  series_a:      { stageName: 'Series A',     typicalMinPct: 15, typicalMaxPct: 25, sweetSpotMinPct: 18, sweetSpotMaxPct: 22 },
  series_b:      { stageName: 'Series B',     typicalMinPct: 10, typicalMaxPct: 20, sweetSpotMinPct: 12, sweetSpotMaxPct: 18 },
  series_c_plus: { stageName: 'Series C+',    typicalMinPct:  8, typicalMaxPct: 18, sweetSpotMinPct: 10, sweetSpotMaxPct: 15 },
}

// Infer stage from raise size (USD) when no explicit stage is passed
export function inferStageFromRaise(raiseUsd: number): FundingStage {
  if (raiseUsd <  500_000)  return 'pre_seed'
  if (raiseUsd <  2_000_000) return 'seed'
  if (raiseUsd < 15_000_000) return 'series_a'
  if (raiseUsd < 50_000_000) return 'series_b'
  return 'series_c_plus'
}

// Normalize a stage string (from submissions table) to our enum
export function normalizeStageString(stage: string | null | undefined): FundingStage | null {
  if (!stage) return null
  const s = stage.toLowerCase().replace(/[-_\s]+/g, '')
  if (s === 'preseed')      return 'pre_seed'
  if (s === 'seed')         return 'seed'
  if (s === 'seriesa' || s === 'a')  return 'series_a'
  if (s === 'seriesb' || s === 'b')  return 'series_b'
  if (s === 'seriesc' || s === 'c' || s === 'seriesd' || s === 'd' || s.startsWith('series'))  return 'series_c_plus'
  return null
}

// ─── Verdict logic ────────────────────────────────────────────────

type Verdict = 'conservative' | 'sweet_spot' | 'reasonable' | 'aggressive' | 'very_aggressive'

interface VerdictResult {
  verdict:     Verdict
  label:       string
  message:     string
  color:       'success' | 'brand' | 'warning' | 'danger'
  icon:        React.ComponentType<{ className?: string; strokeWidth?: number }>
}

function getVerdict(dilutionPct: number, b: DilutionBenchmark, stageLabel: string): VerdictResult {
  if (dilutionPct < b.typicalMinPct) {
    return {
      verdict: 'conservative',
      label:   'Conservative',
      message: `Below the typical ${b.typicalMinPct}–${b.typicalMaxPct}% range for SEA ${stageLabel}. You might be giving up too little — investors at this stage usually expect meaningful equity for the risk they take. Consider whether you're raising enough to hit your next milestone, or if you can negotiate a higher valuation.`,
      color:   'brand',
      icon:    TrendingDown,
    }
  }
  if (dilutionPct >= b.sweetSpotMinPct && dilutionPct <= b.sweetSpotMaxPct) {
    return {
      verdict: 'sweet_spot',
      label:   'Sweet spot',
      message: `Right in the ${b.sweetSpotMinPct}–${b.sweetSpotMaxPct}% sweet spot for SEA ${stageLabel}. Most investors will see this as fair without much pushback. You keep meaningful control; they get a stake that's worth their time.`,
      color:   'success',
      icon:    CheckCircle2,
    }
  }
  if (dilutionPct <= b.typicalMaxPct) {
    return {
      verdict: 'reasonable',
      label:   'Reasonable',
      message: `Within the typical ${b.typicalMinPct}–${b.typicalMaxPct}% range for SEA ${stageLabel}. Defensible in negotiations — though if you're closer to the upper end, expect pushback on terms beyond price.`,
      color:   'success',
      icon:    CheckCircle2,
    }
  }
  if (dilutionPct < b.typicalMaxPct + 8) {
    return {
      verdict: 'aggressive',
      label:   'Aggressive',
      message: `Above the typical ${b.typicalMinPct}–${b.typicalMaxPct}% range for SEA ${stageLabel}. Founders giving up this much usually have either raised too much for stage, or accepted a low valuation. Consider negotiating a higher cap, smaller round, or splitting into two closes.`,
      color:   'warning',
      icon:    AlertTriangle,
    }
  }
  return {
    verdict: 'very_aggressive',
    label:   'Very aggressive',
    message: `Significantly above SEA ${stageLabel} norms (${b.typicalMinPct}–${b.typicalMaxPct}%). This level of dilution can damage future rounds — investors at Series A/B will note your founder ownership and may pass. Strongly consider raising less, finding a higher cap, or pursuing alternative instruments like debt or grants.`,
    color:   'danger',
    icon:    AlertTriangle,
  }
}

// ─── Component ────────────────────────────────────────────────────

interface DilutionInsightProps {
  /** Dilution % (founder ownership lost) */
  dilutionPct: number
  /** Raise amount in USD — used for stage inference if no stage provided */
  raiseUsd:    number
  /** Optional explicit stage (from user's deck submission) */
  stage?:      FundingStage | null
  /** Whether the stage came from the user's actual deck analysis (vs inferred) */
  fromUserDeck?: boolean
}

export function DilutionInsight({ dilutionPct, raiseUsd, stage, fromUserDeck }: DilutionInsightProps) {
  const inferredStage = stage || inferStageFromRaise(raiseUsd)
  const benchmark    = STAGE_BENCHMARKS[inferredStage]
  const verdict      = getVerdict(dilutionPct, benchmark, benchmark.stageName)
  const Icon         = verdict.icon

  const colorClasses = {
    success: 'bg-success-bg border-success-border text-success-text',
    brand:   'bg-brand-soft border-brand/20 text-brand',
    warning: 'bg-warning-bg border-warning-border text-warning-text',
    danger:  'bg-danger-bg border-danger-border text-danger-text',
  }[verdict.color]

  return (
    <div className={`rounded-xl border p-4 ${colorClasses}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h4 className="text-sm font-semibold">
              {dilutionPct.toFixed(1)}% dilution — {verdict.label}
            </h4>
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
              vs SEA {benchmark.stageName}
            </span>
          </div>
          <p className="text-xs leading-relaxed">
            {verdict.message}
          </p>

          {/* Benchmark bar */}
          <div className="mt-3 relative h-2 bg-white/50 rounded-full overflow-hidden">
            {/* Sweet spot zone */}
            <div
              className="absolute h-full bg-current opacity-40"
              style={{
                left:  `${Math.min(100, (benchmark.sweetSpotMinPct / 40) * 100)}%`,
                width: `${Math.min(100, ((benchmark.sweetSpotMaxPct - benchmark.sweetSpotMinPct) / 40) * 100)}%`,
              }}
            />
            {/* Current dilution marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-current rounded-sm"
              style={{ left: `${Math.min(100, Math.max(0, (dilutionPct / 40) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] mt-1 opacity-70 tabular-nums">
            <span>0%</span>
            <span className="font-medium">Sweet spot: {benchmark.sweetSpotMinPct}–{benchmark.sweetSpotMaxPct}%</span>
            <span>40%</span>
          </div>

          {/* Citation */}
          <div className="mt-3 pt-3 border-t border-current/20 flex items-center gap-1.5 text-[10px] opacity-70">
            <Info className="w-3 h-3" strokeWidth={1.75} />
            {fromUserDeck
              ? <span>Benchmarked against your deck&apos;s {benchmark.stageName} stage · Source: Carta SEA + Iconiq + Cento Ventures 2026</span>
              : <span>Stage inferred from raise size · Source: Carta SEA + Iconiq + Cento Ventures 2026</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
