// ═══════════════════════════════════════════════════════════════
// lib/beta-tasks.ts
//
// Single source of truth for beta-tester task list.
// Used by:
//   - <BetaProgressCard /> on dashboard (renders task list + status)
//   - <FeedbackModal />  (per-task question + rating labels)
//   - /admin/feedback page (display labels + filtering)
// ═══════════════════════════════════════════════════════════════

export type BetaTaskKey =
  | 'deck_analysis'
  | 'mock_pitch'
  | 'calculator'
  | 'crm'
  | 'meeting_request'
  | 'final_overall'

export type BetaTask = {
  key:              BetaTaskKey
  title:            string             // shown in progress card
  description:      string             // shown under title in card
  cta_label:        string             // button text in card
  cta_href:         string             // where to send user to do the task
  feedback_question: string            // header in feedback modal
  rating_min_label: string             // shown at "1" end of slider
  rating_max_label: string             // shown at "10" end
  optional?:        boolean            // marks "skip if not relevant" tasks
}

export const BETA_TASKS: BetaTask[] = [
  {
    key:               'deck_analysis',
    title:             'Analyze your pitch deck',
    description:       'Upload a deck and review the AI analysis report',
    cta_label:         'Start analysis',
    cta_href:          '/apply',
    feedback_question: 'How accurate was the deck analysis?',
    rating_min_label:  'Completely off',
    rating_max_label:  'Spot on',
  },
  {
    key:               'mock_pitch',
    title:             'Practice your pitch with AI',
    description:       'Record a 5-min practice pitch and review the debrief',
    cta_label:         'Try mock pitch',
    cta_href:          '/mock-pitch',
    feedback_question: 'How useful was the practice session?',
    rating_min_label:  'Waste of time',
    rating_max_label:  'Game-changer',
  },
  {
    key:               'calculator',
    title:             'Try the founder calculators',
    description:       'Use the equity, debt, or SAFE calculator',
    cta_label:         'Open calculator',
    cta_href:          '/tools/calculator',
    feedback_question: 'How clear were the calculator results?',
    rating_min_label:  'Confusing',
    rating_max_label:  'Crystal clear',
  },
  {
    key:               'crm',
    title:             'Track an investor in your CRM',
    description:       'Add at least one investor to your CRM pipeline',
    cta_label:         'Open CRM',
    cta_href:          '/crm',
    feedback_question: 'How easy was the CRM to use?',
    rating_min_label:  'Frustrating',
    rating_max_label:  'Effortless',
  },
  {
    key:               'meeting_request',
    title:             'Request a meeting (optional)',
    description:       'Browse matched investors and try the request flow',
    cta_label:         'See matches',
    cta_href:          '/dashboard',         // their match results live here
    feedback_question: 'How smooth was the meeting flow?',
    rating_min_label:  'Broken',
    rating_max_label:  'Seamless',
    optional:          true,
  },
]

// Final survey is rendered separately — not a task users navigate to.
// Triggered automatically after the 4 required tasks above are done.
export const FINAL_SURVEY: BetaTask = {
  key:               'final_overall',
  title:             'Overall experience',
  description:       'Help us understand how RaiseSEA fits your fundraising',
  cta_label:         'Share final thoughts',
  cta_href:          '',                                   // not navigable, opens modal directly
  feedback_question: 'How likely are you to recommend RaiseSEA to other founders?',
  rating_min_label:  'Definitely not',
  rating_max_label:  'Definitely yes',
}

// All tasks, including final, for admin filtering / display
export const ALL_TASKS: BetaTask[] = [...BETA_TASKS, FINAL_SURVEY]

// Required tasks (non-optional). Used to compute "all done" → trigger final survey
export const REQUIRED_TASKS: BetaTask[] = BETA_TASKS.filter(t => !t.optional)
