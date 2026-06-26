// ═══════════════════════════════════════════════════════════════
// lib/next-actions.ts
//
// Pure factory functions that build NextAction arrays from
// completion-point data (deck analysis, mock-pitch debrief, etc.).
//
// Used at every "completion" moment in the app to keep the founder
// moving forward through the journey:  Assess → Prepare → Execute.
//
// Design choices (locked in chunk 12.3+ Stage 2):
//   • No algorithmic matching to specific experts — just direct to /meet
//     and let the founder pick. We don't have enough real data to tune
//     dimension→expert mapping; bad matches would be worse than no matches.
//   • "Sharp Friend" voice: direct, specific, no fluff.
//   • Maximum 2-3 actions per block. More than that = analysis paralysis.
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import type { NextAction } from '@/components/ui/NextActionsBlock'

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Find the weakest dimension from a deck_analysis.dimensions object.
 * Returns the dimension name with the lowest score-vs-max ratio,
 * or null if no dimensions exist.
 */
export function weakestDimension(
  dimensions: Record<string, { score: number; max_score: number }> | null | undefined
): { name: string; score: number; maxScore: number; ratio: number } | null {
  if (!dimensions || Object.keys(dimensions).length === 0) return null
  const entries = Object.entries(dimensions)
    .filter(([, v]) => v && typeof v.score === 'number' && typeof v.max_score === 'number' && v.max_score > 0)
    .map(([name, v]) => ({ name, score: v.score, maxScore: v.max_score, ratio: v.score / v.max_score }))
  if (entries.length === 0) return null
  entries.sort((a, b) => a.ratio - b.ratio)
  return entries[0]
}

/** Pretty label for a dimension key (e.g. "go_to_market" → "go-to-market") */
export function dimensionLabel(name: string): string {
  const map: Record<string, string> = {
    problem:         'problem',
    market:          'market sizing',
    product:         'product',
    traction:        'traction',
    team:            'team',
    financials:      'financials',
    go_to_market:    'go-to-market',
    business_model:  'business model',
    competition:     'competitive position',
    ask:             'the ask',
    story:           'narrative',
  }
  return map[name] || name.replace(/_/g, ' ')
}

// ─── Factories — one per completion point ─────────────────────────

/**
 * After deck analysis completes (/match/[id] overview tab).
 *
 * Primary suggestion is always Mock Pitch — that's the natural next step
 * in the journey. Secondary is "find an expert" linking to /meet (no filter).
 */
export function deckAnalysisNextActions(args: {
  deckAnalysis: Record<string, unknown> | null
  practiceIcon: ReactNode
  expertIcon: ReactNode
  includeExpertAction?: boolean
}): NextAction[] {
  const { deckAnalysis, practiceIcon, expertIcon, includeExpertAction = true } = args
  if (!deckAnalysis) return []

  const score = typeof deckAnalysis.overall_score === 'number' ? deckAnalysis.overall_score : null
  const dims = deckAnalysis.dimensions as Record<string, { score: number; max_score: number }> | null
  const weakest = weakestDimension(dims)

  // Primary: practice. Description is contextual to score.
  let practiceDescription = 'Run a full pitch and an investor Q&A — find the gaps before investors do.'
  if (score != null && score < 60) {
    practiceDescription = 'Your deck has real gaps. Practice telling the story out loud before any investor sees it.'
  } else if (score != null && score >= 80) {
    practiceDescription = 'Deck looks strong. Now stress-test it — can you defend it under live questioning?'
  } else if (weakest) {
    practiceDescription = `Your ${dimensionLabel(weakest.name)} section scored lowest — practice answering questions on it.`
  }

  const actions: NextAction[] = [
    {
      priority: 'primary',
      icon:     practiceIcon,
      label:    'Practice your pitch',
      description: practiceDescription,
      href:     '/mock-pitch',
    },
  ]

  if (includeExpertAction) {
    actions.push(
    {
      priority: 'secondary',
      icon:     expertIcon,
      label:    'Find an expert',
      description: 'Talk to a mentor, VC, or domain expert about your raise. 30-minute sessions.',
      href:     '/meet',
    },
    )
  }

  return actions
}

/**
 * On the Mock Pitch home page when the founder has no sessions yet.
 *
 * Encourages "pitch first, then Q&A" as the recommended order.
 * The Q&A action is intentionally NOT a CTA here — it's just text
 * guidance for AFTER pitch completion.
 */
export function mockPitchHomeNextActions(args: {
  pitchIcon: ReactNode
  expertIcon: ReactNode
  includeExpertAction?: boolean
}): NextAction[] {
  const { pitchIcon, expertIcon, includeExpertAction = true } = args
  const actions: NextAction[] = [
    {
      priority: 'primary',
      icon:     pitchIcon,
      label:    'Start with a full pitch',
      description: 'Run through your whole deck. Then drill investor questions in a Q&A session.',
      href:     '#start-pitch',  // anchor to the picker on this page
    },
  ]

  if (includeExpertAction) {
    actions.push(
    {
      priority: 'tertiary',
      icon:     expertIcon,
      label:    'Talk to a pitch coach',
      description: 'Want a human review of your delivery? Find an expert.',
      href:     '/meet',
    },
    )
  }

  return actions
}

/**
 * After a mock-pitch (or Q&A) debrief.
 *
 * Branches on score:
 *   • Score < 65 → retry weak dimension (primary) + expert (secondary)
 *   • Score ≥ 65 → switch mode (pitch → Q&A or Q&A → pitch) (primary) + expert
 */
export function mockPitchDebriefNextActions(args: {
  sessionType:      'pitch' | 'qa'
  overallScore:     number | null
  weakestDimension: string | null
  retryIcon:        ReactNode
  switchIcon:       ReactNode
  expertIcon:       ReactNode
  includeExpertAction?: boolean
}): NextAction[] {
  const { sessionType, overallScore, weakestDimension, retryIcon, switchIcon, expertIcon, includeExpertAction = true } = args

  const switchTo = sessionType === 'pitch' ? 'qa' : 'pitch'
  const switchLabel = sessionType === 'pitch'
    ? 'Try investor Q&A next'
    : 'Run a full pitch'
  const switchDescription = sessionType === 'pitch'
    ? 'Q&A is the real test — investors will interrupt with hard questions. See how you handle it.'
    : 'Now run a full pitch end-to-end. Q&A tests defense; the pitch tests offense.'

  // Low score: retry is the priority
  if (overallScore != null && overallScore < 65) {
    const actions: NextAction[] = [
      {
        priority: 'primary',
        icon:     retryIcon,
        label:    weakestDimension
          ? `Re-run focused on ${dimensionLabel(weakestDimension)}`
          : 'Re-run with feedback applied',
        description: 'Apply what the debrief flagged and try again — usually a 5-10 point jump.',
        href:     '/mock-pitch',
      },
      {
        priority: 'secondary',
        icon:     switchIcon,
        label:    switchLabel,
        description: switchDescription,
        href:     `/mock-pitch?mode=${switchTo}`,
      },
    ]

    if (includeExpertAction) {
      actions.push(
      {
        priority: 'tertiary',
        icon:     expertIcon,
        label:    'Find an expert',
        description: 'Want a human pitch coach? Browse mentors and book 30 minutes.',
        href:     '/meet',
      },
      )
    }

    return actions
  }

  // Solid score: switch modes
  const actions: NextAction[] = [
    {
      priority: 'primary',
      icon:     switchIcon,
      label:    switchLabel,
      description: switchDescription,
      href:     `/mock-pitch?mode=${switchTo}`,
    },
    {
      priority: 'secondary',
      icon:     retryIcon,
      label:    'Run it again',
      description: 'Consistency matters — can you hit this score twice in a row?',
      href:     '/mock-pitch',
    },
  ]

  if (includeExpertAction) {
    actions.push(
    {
      priority: 'tertiary',
      icon:     expertIcon,
      label:    'Find an expert',
      description: 'Get a human read on your delivery. 30-minute sessions.',
      href:     '/meet',
    },
    )
  }

  return actions
}
