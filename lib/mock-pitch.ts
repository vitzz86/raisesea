// ═══════════════════════════════════════════════════════════════
// lib/mock-pitch.ts — Mock Pitch + Q&A shared types.
// ═══════════════════════════════════════════════════════════════

export type Mode = 'pitch' | 'qa'
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned'

export const PITCH_DURATIONS = [3, 5] as const
export const QA_DURATIONS = [5, 10] as const

// Q&A: roughly 2.5 minutes per question → 5min=2q, 10min=4q
export function questionCountForDuration(durationMin: number): number {
  return Math.max(2, Math.round(durationMin / 2.5))
}

// Pre-generated question for Q&A
export type Question = {
  q: string
  area: string  // e.g. 'Market', 'Traction', 'Team', 'Business model', 'The ask'
  context?: string  // why this question — for the debrief
}

// Pitch transcript entry — what the founder said on each slide
export type PitchTurn = {
  slide: number
  text: string
  ts: string  // ISO timestamp
  duration_seconds?: number
}

// Q&A transcript entry — question + answer pair
export type QATurn = {
  q: string
  a: string
  ts: string
}

// Session record (what's in the DB)
export type MockSession = {
  id: string
  user_id: string
  submission_id: string | null
  mode: Mode
  duration_min: number
  questions: Question[] | null
  transcript: (PitchTurn | QATurn)[] | null
  debrief: Debrief | null
  status: SessionStatus
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Per-dimension scoring (same shape as DeckAnalysis.dimensions)
export type DimensionScore = {
  score: number          // 0-100
  max_score: number      // typically 100
  weight_pct: number     // 0-100, how much it contributes to overall
  found: string[]        // what was demonstrated
  missing: string[]      // what was missing
  best_practice: string  // how a strong founder would do this
  fix_effort: string     // 'low' | 'medium' | 'high'
  score_impact: string   // how much this dimension would lift overall if fixed
}

// Per-slide breakdown (Pitch mode)
export type SlideBreakdown = {
  slide: number
  score: number          // 0-100
  pace: 'silent' | 'too fast' | 'good' | 'too slow'
  what_worked: string[]
  what_to_improve: string[]
  best_practice: string  // how a strong founder would pitch this slide
  how_to_be_better: string  // specific advice for this user
}

// Per-question breakdown (Q&A mode)
export type QuestionBreakdown = {
  q: string
  area: string
  score: number          // 0-100
  what_worked: string[]
  what_was_missing: string[]
  best_practice_answer: string  // how a strong founder would answer
  how_to_be_better: string      // specific advice
  follow_ups: { q: string; talking_points: string[] }[]  // likely follow-ups + how to handle
}

// "Other questions investors may ask" bonus (Q&A mode)
export type SuggestedQuestion = {
  area: string  // Market | Traction | Team | Business model | The ask
  q: string
  talking_points: string[]
}

// Priority fix (mirrors DeckAnalysis.priority_fixes)
export type PriorityFix = {
  priority: 'critical' | 'high' | 'polish'
  title: string
  description: string
  score_impact: string
  effort: string
}

// Content-coverage breakdown (Pitch mode) — mirrors the deck-analysis content
// dimensions (the 8 minus "Narrative & design") so founders see the SAME
// dimensions across their deck analysis and their spoken pitch. Replaces the
// old per_slide breakdown (which exploded on long decks).
export type ContentDimension = {
  key: string            // 'traction' | 'problem' | 'solution' | 'team' | 'market_size' | 'business_model' | 'financials'
  label: string          // deck-matching label, e.g. 'Problem & opportunity'
  score: number          // 0-100 (diagnostic; overall_score still comes from delivery dimensions)
  slides: number[]       // every slide where the founder addressed this (empty if not covered)
  found: string[]        // WHAT EXISTS — what they actually said (transcript-grounded)
  missing: string[]      // what was weak or absent
  best_practice: string  // how to deliver it well (sector-specific)
}

// Debrief structure returned by Gemini after the session
export type Debrief = {
  overall_score: number    // 0-100 (consistent with deck analysis)
  investor_readiness: 'Strong' | 'Good' | 'Needs Work' | 'Weak'
  summary: string          // 2-3 sentence overall takeaway
  // Pitch dimensions: Opening, Storytelling, Pacing, Clarity, Confidence, Coverage
  // Q&A dimensions:    Market, Traction, Team, Business model, The ask
  dimensions: Record<string, DimensionScore>
  content_dimensions?: ContentDimension[]  // Pitch mode (NEW — replaces per_slide)
  per_slide?: SlideBreakdown[]          // Pitch mode (LEGACY — old debriefs only)
  per_question?: QuestionBreakdown[]    // Q&A mode
  suggested_questions?: SuggestedQuestion[]  // Q&A mode bonus: 5 more likely Qs
  priority_fixes: PriorityFix[]
  actionable_next_steps: string[]
}
