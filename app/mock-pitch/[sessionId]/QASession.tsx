'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSpeechRecognition, isSpeechRecognitionSupported, speak, stopSpeaking } from '@/lib/use-speech'
import type { QATurn } from '@/lib/mock-pitch'

type Question = { q: string; area: string; context?: string }

export default function QASession({ sessionId, durationMin, company, questions }: {
  sessionId: string; durationMin: number; company: string; questions: Question[]
}) {
  const router = useRouter()
  const totalSeconds = durationMin * 60
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [qIndex, setQIndex] = useState(0)
  const [turns, setTurns] = useState<QATurn[]>([])
  const [textInput, setTextInput] = useState('')
  const [textMode, setTextMode] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [voiceQuestion, setVoiceQuestion] = useState(true)
  const questionAreaRef = useRef<HTMLDivElement | null>(null)

  const speech = useSpeechRecognition({ continuous: true, lang: 'en-US' })
  const supported = isSpeechRecognitionSupported()

  useEffect(() => {
    if (!started || paused || finishing) return
    const interval = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= totalSeconds) { finishSession('completed'); return prev }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, paused, finishing])

  useEffect(() => {
    if (!started || paused || !voiceQuestion || qIndex >= questions.length) return
    speak(questions[qIndex].q)
    return () => stopSpeaking()
  }, [qIndex, started, paused, voiceQuestion, questions])

  useEffect(() => {
    speech.reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex])

  function start() {
    setStarted(true); setPaused(false)
    if (!textMode && supported) speech.start()
  }

  function togglePause() {
    if (paused) {
      setPaused(false)
      if (!textMode && supported) speech.start()
    } else {
      setPaused(true)
      speech.stop()
      stopSpeaking()
    }
  }

  function restart() {
    if (!confirm('Restart the Q&A from the beginning? Your current progress will be cleared.')) return
    speech.stop()
    speech.reset()
    stopSpeaking()
    setTurns([])
    setQIndex(0)
    setElapsed(0)
    setTextInput('')
    setPaused(false)
    if (!textMode && supported) speech.start()
  }

  function recordAnswerAndAdvance(answerText: string) {
    if (qIndex >= questions.length) return
    setTurns(prev => [...prev, { q: questions[qIndex].q, a: answerText.trim(), ts: new Date().toISOString() }])
    setTextInput('')
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1)
    } else {
      finishSession('completed')
    }
  }

  function nextQuestion() {
    const answer = textMode ? textInput : (speech.transcript + ' ' + (speech.interim || '')).trim()
    recordAnswerAndAdvance(answer || '(no answer)')
  }

  async function finishSession(status: 'completed' | 'abandoned') {
    if (finishing) return
    setFinishing(true)
    speech.stop()
    stopSpeaking()
    let finalTurns = turns
    if (qIndex < questions.length) {
      const finalAnswer = textMode ? textInput : (speech.transcript + ' ' + (speech.interim || '')).trim()
      if (finalAnswer.length > 0 && !turns.some(t => t.q === questions[qIndex].q)) {
        finalTurns = [...turns, { q: questions[qIndex].q, a: finalAnswer, ts: new Date().toISOString() }]
      }
    }
    await fetch(`/api/mock-pitch/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: finalTurns, status }),
    })
    if (status === 'completed') {
      router.push(`/mock-pitch/${sessionId}/debrief?generating=1`)
      fetch('/api/mock-pitch/debrief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {})
    } else {
      router.push('/mock-pitch')
    }
  }

  const remaining = Math.max(0, totalSeconds - elapsed)
  const mm = Math.floor(remaining / 60); const ss = remaining % 60
  const lowTime = remaining <= 30
  const current = questions[qIndex]
  const liveAnswer = textMode ? textInput : (speech.transcript + ' ' + (speech.interim || '')).trim()

  if (finishing) return <SessionSubmitting />

  return (
    <div className="max-w-3xl" ref={questionAreaRef}>
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">❓ Q&A: {company}</h1>
          <p className="text-xs text-text-tertiary">{durationMin}-minute Q&A · {questions.length} questions</p>
        </div>
        <div className={`text-2xl font-mono font-bold ${paused ? 'text-warning-text' : lowTime ? 'text-danger-text' : 'text-text-primary'}`}>
          {paused && '⏸ '}{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
      </div>

      {!started ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">❓</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Ready for {questions.length} questions?</h2>
          <p className="text-sm text-text-tertiary mb-4 max-w-md mx-auto">
            The AI partner will ask you {questions.length} sharp, deck-specific questions over {durationMin} minutes — about {Math.round(durationMin * 60 / questions.length)}s each. Take your time but speak naturally.
          </p>
          {!supported && (
            <div className="bg-warning-bg border border-warning-border rounded-md p-3 text-xs text-warning-text mb-3 max-w-md mx-auto">
              Your browser doesn&apos;t support speech recognition — switching to text mode.
            </div>
          )}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {supported && (
              <label className="text-xs text-text-tertiary flex items-center gap-1.5">
                <input type="checkbox" checked={textMode} onChange={e => setTextMode(e.target.checked)} />
                Type answers instead
              </label>
            )}
            <label className="text-xs text-text-tertiary flex items-center gap-1.5">
              <input type="checkbox" checked={voiceQuestion} onChange={e => setVoiceQuestion(e.target.checked)} />
              Read questions aloud
            </label>
          </div>
          <button onClick={start} className="mt-4 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-5 py-2">
            ▶ Begin Q&A
          </button>
        </div>
      ) : (
        <>
          {/* === TOP CONTROL BAR === */}
          <div className="bg-white border border-border rounded-xl p-3 mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={togglePause} className="text-xs border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary">
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button onClick={restart} className="text-xs border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary">
                🔁 Restart
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => finishSession('abandoned')} className="text-xs text-danger-text hover:underline">End early</button>
              <button onClick={nextQuestion}
                className="text-sm bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5">
                {qIndex + 1 < questions.length ? 'Done · Next question →' : '✓ Finish & get debrief'}
              </button>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-5 mb-3">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Question {qIndex + 1} of {questions.length} · {current?.area}</div>
            <p className="text-lg text-text-primary leading-snug mb-2">{current?.q || '—'}</p>
            {voiceQuestion && (
              <button onClick={() => current && speak(current.q)} className="text-[11px] text-brand hover:underline">🔊 Repeat question</button>
            )}
          </div>

          {textMode ? (
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} rows={4}
              placeholder="Your answer…"
              className="w-full text-sm border border-border-strong rounded-md p-3 focus:outline-none focus:border-brand" />
          ) : (
            <div className={`rounded-xl p-3 mb-3 ${paused ? 'bg-warning-bg border border-warning-border' : speech.listening ? 'bg-danger-bg border border-danger-border' : 'bg-surface-muted border border-border'}`}>
              <div className="flex items-center gap-2 text-xs">
                {paused ? (
                  <><span className="w-2 h-2 rounded-full bg-warning-solid" /><span className="text-warning-text font-medium">Paused</span></>
                ) : speech.listening ? (
                  <><span className="w-2 h-2 rounded-full bg-danger-solid animate-pulse" /><span className="text-danger-text font-medium">Recording — answer naturally</span></>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-gray-400" /><span className="text-text-secondary">Idle</span></>
                )}
              </div>
              {liveAnswer ? (
                <p className="text-sm text-text-primary mt-2">{liveAnswer}</p>
              ) : (
                <p className="text-xs text-text-disabled mt-1.5 italic">Start speaking — your words will appear here.</p>
              )}
              {speech.error && <p className="text-[10px] text-warning-text mt-1.5">⚠ {speech.error}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SessionSubmitting() {
  return (
    <div className="max-w-3xl mx-auto py-16 text-center">
      <div className="text-5xl mb-4 animate-pulse">🧠</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">Generating your debrief…</h2>
      <p className="text-sm text-text-tertiary max-w-md mx-auto">The AI is analyzing your answers, scoring each question, and preparing actionable feedback + follow-ups. This usually takes 30-60 seconds.</p>
      <div className="mt-6 flex justify-center">
        <div className="h-1 w-48 bg-surface-sunken rounded-full overflow-hidden">
          <div className="h-full bg-brand animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}
