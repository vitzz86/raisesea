'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSpeechRecognition, isSpeechRecognitionSupported } from '@/lib/use-speech'
import type { PitchTurn } from '@/lib/mock-pitch'

export default function PitchSession({ sessionId, durationMin, company, deckUrl, deckExternalUrl }: {
  sessionId: string; durationMin: number; company: string; deckUrl: string | null; deckExternalUrl: string | null
}) {
  const router = useRouter()
  const totalSeconds = durationMin * 60
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [slide, setSlide] = useState(1)
  const [turns, setTurns] = useState<PitchTurn[]>([])
  const [finishing, setFinishing] = useState(false)
  const [textMode, setTextMode] = useState(false)
  const [textInput, setTextInput] = useState('')

  const slideEnteredAt = useRef<number>(Date.now())
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [iframeFailed, setIframeFailed] = useState(false)
  const [slideLoading, setSlideLoading] = useState(false)
  const speech = useSpeechRecognition({ continuous: true, lang: 'en-US' })
  const supported = isSpeechRecognitionSupported()

  // Show a brief "Loading slide…" overlay when the slide changes. The iframe
  // is remounted (via key={slide}) to actually navigate the PDF, which causes
  // a quick reload — this overlay softens that visual change.
  useEffect(() => {
    if (!started || !deckUrl) return
    setSlideLoading(true)
    const t = setTimeout(() => setSlideLoading(false), 600)
    return () => clearTimeout(t)
  }, [slide, started, deckUrl])

  // After starting, give the iframe 8 seconds to load. If it never fires onLoad,
  // assume the embed was blocked (X-Frame-Options, network, mobile browser) and
  // show a fallback that lets the founder open the deck in a new tab to keep
  // pitching. Resets if `slide` changes (we navigate without re-mounting now,
  // so onLoad won't fire again — only track first load).
  useEffect(() => {
    if (!started || !deckUrl) return
    setIframeFailed(false)
    const timeout = setTimeout(() => {
      // If iframe never loaded, mark as failed. The iframe might still load
      // eventually — but we show the fallback proactively so the user has options.
      const ifr = iframeRef.current
      if (!ifr) return
      try {
        // contentDocument throws if cross-origin; that's fine — it MIGHT have loaded
        // and we just can't see inside. So check ReadyState via a softer test.
        const doc = ifr.contentDocument
        if (doc && doc.readyState !== 'complete') setIframeFailed(true)
      } catch {
        // Cross-origin or blocked: treat as failed to surface the fallback. The
        // iframe stays visible — if it DID load despite this, both are visible.
        setIframeFailed(true)
      }
    }, 8000)
    return () => clearTimeout(timeout)
  }, [started, deckUrl])

  // Timer
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

  // Capture transcript chunks tagged to current slide
  const lastTranscriptRef = useRef('')
  useEffect(() => {
    if (!speech.transcript || speech.transcript === lastTranscriptRef.current) return
    const newChunk = speech.transcript.slice(lastTranscriptRef.current.length).trim()
    lastTranscriptRef.current = speech.transcript
    if (!newChunk) return
    const now = Date.now()
    setTurns(prev => [...prev, {
      slide, text: newChunk, ts: new Date().toISOString(),
      duration_seconds: Math.round((now - slideEnteredAt.current) / 1000),
    }])
  }, [speech.transcript, slide])

  function commitTextInput() {
    if (!textInput.trim()) return
    const now = Date.now()
    setTurns(prev => [...prev, {
      slide, text: textInput.trim(), ts: new Date().toISOString(),
      duration_seconds: Math.round((now - slideEnteredAt.current) / 1000),
    }])
    setTextInput('')
  }

  function start() {
    setStarted(true); setPaused(false)
    slideEnteredAt.current = Date.now()
    if (!textMode && supported) speech.start()
  }

  function togglePause() {
    if (paused) {
      setPaused(false)
      slideEnteredAt.current = Date.now()
      if (!textMode && supported) speech.start()
    } else {
      setPaused(true)
      speech.stop()
    }
  }

  function restart() {
    if (!confirm('Restart the pitch from the beginning? Your current progress will be cleared.')) return
    speech.stop()
    speech.reset()
    lastTranscriptRef.current = ''
    setTurns([])
    setSlide(1)
    setElapsed(0)
    setTextInput('')
    setPaused(false)
    slideEnteredAt.current = Date.now()
    if (!textMode && supported) speech.start()
  }

  function nextSlide() {
    if (textMode && textInput) commitTextInput()
    slideEnteredAt.current = Date.now()
    setSlide(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function prevSlide() {
    if (textMode && textInput) commitTextInput()
    slideEnteredAt.current = Date.now()
    setSlide(s => Math.max(1, s - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function finishSession(status: 'completed' | 'abandoned') {
    if (finishing) return
    setFinishing(true)
    speech.stop()
    let finalTurns = turns
    if (textMode && textInput.trim()) {
      finalTurns = [...turns, { slide, text: textInput.trim(), ts: new Date().toISOString(), duration_seconds: Math.round((Date.now() - slideEnteredAt.current) / 1000) }]
    }
    await fetch(`/api/mock-pitch/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: finalTurns, status }),
    })
    if (status === 'completed') {
      // Push to debrief page IMMEDIATELY — it will show the "generating" loading state.
      // Fire debrief generation in the background; the debrief page will poll/wait.
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
  const totalForSlide = turns.filter(t => t.slide === slide).reduce((sum, t) => sum + (t.duration_seconds || 0), 0)
  const recentText = turns.filter(t => t.slide === slide).map(t => t.text).join(' ').slice(-300)

  if (finishing) return <SessionSubmitting />

  return (
    <div className="max-w-5xl">
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">🎙️ Pitching {company}</h1>
          <p className="text-xs text-text-tertiary">{durationMin}-minute mock pitch. Walk through your deck slide by slide.</p>
        </div>
        <div className={`text-2xl font-mono font-bold ${paused ? 'text-warning-text' : lowTime ? 'text-danger-text' : 'text-text-primary'}`}>
          {paused && '⏸ '}{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
      </div>

      {!started ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🎙️</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Ready to pitch?</h2>
          <p className="text-sm text-text-tertiary mb-4 max-w-md mx-auto">
            You have {durationMin} minutes. Walk through your deck slide by slide as if pitching to a VC.
            Click &quot;Next slide&quot; when you&apos;re ready to advance. The timer starts when you click Begin.
          </p>
          {!supported && (
            <div className="bg-warning-bg border border-warning-border rounded-md p-3 text-xs text-warning-text mb-3 max-w-md mx-auto">
              Your browser doesn&apos;t support speech recognition — switching to text mode.
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            {supported && (
              <label className="text-xs text-text-tertiary flex items-center gap-1.5">
                <input type="checkbox" checked={textMode} onChange={e => setTextMode(e.target.checked)} />
                Type instead of speaking
              </label>
            )}
          </div>
          <button onClick={start} className="mt-4 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-5 py-2">
            ▶ Begin pitch
          </button>
        </div>
      ) : (
        <>
          {/* === TOP CONTROL BAR (above slide so user doesn't scroll) === */}
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
              <button onClick={() => finishSession('completed')}
                className="text-sm bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5">
                ✓ Finish & get debrief
              </button>
            </div>
          </div>

          {/* Slide viewer */}
          <div className="bg-gray-900 rounded-xl aspect-video flex items-center justify-center mb-2 relative overflow-hidden">
            {deckUrl && !iframeFailed ? (
              <iframe
                key={slide}
                ref={iframeRef}
                src={`${deckUrl}#page=${slide}&toolbar=0&navpanes=0&view=FitH`}
                className="w-full h-full bg-white"
                title="Deck"
                onLoad={() => { setIframeFailed(false); setSlideLoading(false) }}
              />
            ) : deckUrl && iframeFailed ? (
              <div className="text-white text-center p-8 max-w-md">
                <div className="text-3xl mb-2">📄</div>
                <h3 className="text-base font-semibold mb-1">Couldn&apos;t embed your deck</h3>
                <p className="text-xs text-gray-300 mb-3">The PDF source blocks inline preview (some browsers + Drive links do this). You can still pitch — open the deck in a new tab and advance pages there as you talk.</p>
                {deckExternalUrl && (
                  <a href={deckExternalUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-white text-text-primary text-xs font-medium rounded-md px-3 py-1.5 hover:bg-surface-muted">
                    📄 Open deck in new tab →
                  </a>
                )}
                <p className="text-[10px] text-text-tertiary mt-3">The AI still hears your pitch and tracks per-slide timing.</p>
              </div>
            ) : (
              <div className="text-white text-center p-8">
                <div className="text-3xl sm:text-5xl font-bold mb-2">Slide {slide}</div>
                <p className="text-sm text-gray-300">Talk through this slide as if you&apos;re presenting it.</p>
                <p className="text-[11px] text-text-tertiary mt-2">(No deck preview available — but the AI still hears your pitch.)</p>
              </div>
            )}

            {/* Brief loading overlay during iframe reload (soften the page-1 flash) */}
            {slideLoading && deckUrl && !iframeFailed && (
              <div className="absolute inset-0 bg-gray-900/85 flex items-center justify-center pointer-events-none">
                <div className="text-white text-center">
                  <div className="text-2xl animate-pulse mb-1">📄</div>
                  <p className="text-sm font-medium">Loading slide {slide}…</p>
                </div>
              </div>
            )}

            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
              📍 Slide {slide} · {Math.round(totalForSlide)}s
            </div>
          </div>

          {/* Always show "open in new tab" link if we have any URL — even when iframe works */}
          {deckExternalUrl && (
            <div className="text-center mb-3">
              <a href={deckExternalUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-text-tertiary hover:text-brand hover:underline">
                ↗ Can&apos;t see the deck above? Open it in a new tab
              </a>
            </div>
          )}

          {/* Slide nav row */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <button onClick={prevSlide} disabled={slide === 1} className="text-xs border border-border-strong rounded-md px-3 py-1.5 disabled:opacity-30">◀ Previous slide</button>
            <div className="text-xs text-text-secondary font-medium">Currently on slide <span className="text-brand font-bold">{slide}</span></div>
            <button onClick={nextSlide} className="text-xs bg-brand text-white rounded-md px-3 py-1.5 hover:bg-brand-hover">Next slide ▶</button>
          </div>

          {/* Mic / Text input */}
          {textMode ? (
            <div className="bg-white border border-border rounded-xl p-3">
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)} rows={3}
                placeholder={`What are you saying for slide ${slide}? (Click Next to commit + move on.)`}
                className="w-full text-sm border border-border rounded-md p-2 focus:outline-none focus:border-brand" />
            </div>
          ) : (
            <div className={`rounded-xl p-3 ${paused ? 'bg-warning-bg border border-warning-border' : speech.listening ? 'bg-danger-bg border border-danger-border' : 'bg-surface-muted border border-border'}`}>
              <div className="flex items-center gap-2 text-xs">
                {paused ? (
                  <><span className="w-2 h-2 rounded-full bg-warning-solid" /><span className="text-warning-text font-medium">Paused</span></>
                ) : speech.listening ? (
                  <><span className="w-2 h-2 rounded-full bg-danger-solid animate-pulse" /><span className="text-danger-text font-medium">Recording — speak naturally</span></>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-gray-400" /><span className="text-text-secondary">Idle</span></>
                )}
                {speech.error && <span className="text-warning-text text-[10px]">⚠ {speech.error}</span>}
              </div>
              {(recentText || speech.interim) && (
                <div className="mt-2 text-xs text-text-secondary bg-white/60 border border-border rounded-md p-2 max-h-24 overflow-y-auto">
                  {recentText && <span>{recentText} </span>}
                  {speech.interim && <span className="italic text-text-tertiary">{speech.interim}</span>}
                </div>
              )}
              <p className="text-[10px] text-text-disabled mt-1.5">{turns.length} chunks captured · the AI sees this transcript live</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Submitting state ───────────────────────────────────────────────
function SessionSubmitting() {
  return (
    <div className="max-w-3xl mx-auto py-16 text-center">
      <div className="text-5xl mb-4 animate-pulse">🧠</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">Generating your debrief…</h2>
      <p className="text-sm text-text-tertiary max-w-md mx-auto">The AI is analyzing your pitch, scoring each slide, and preparing actionable feedback. This usually takes 30-60 seconds.</p>
      <div className="mt-6 flex justify-center">
        <div className="h-1 w-48 bg-surface-sunken rounded-full overflow-hidden">
          <div className="h-full bg-brand animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}
