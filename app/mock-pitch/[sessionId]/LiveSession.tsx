'use client'

import PitchSession from './PitchSession'
import QASession from './QASession'

type Question = { q: string; area: string; context?: string }

export default function LiveSession({ sessionId, mode, durationMin, questions, company, deckUrl, deckExternalUrl }: {
  sessionId: string
  mode: 'pitch' | 'qa'
  durationMin: number
  questions: Question[] | null
  company: string
  deckUrl: string | null
  deckExternalUrl: string | null
}) {
  if (mode === 'pitch') {
    return <PitchSession sessionId={sessionId} durationMin={durationMin} company={company} deckUrl={deckUrl} deckExternalUrl={deckExternalUrl} />
  }
  return <QASession sessionId={sessionId} durationMin={durationMin} company={company} questions={questions || []} />
}
