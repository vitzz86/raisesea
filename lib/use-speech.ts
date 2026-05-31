'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Minimal types for the browser Speech APIs ─────────────────────
// These don't exist in lib.dom.d.ts by default in all setups, so we declare them.
type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>
}
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition as new () => SpeechRecognitionLike)
    || (w.webkitSpeechRecognition as new () => SpeechRecognitionLike)
    || null
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getRecognitionCtor()
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// ─── useSpeechRecognition — listens to the mic, returns transcript ──
export function useSpeechRecognition(opts?: { lang?: string; continuous?: boolean }) {
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  // Keep transcript across continuous restarts — the API resets on `.start()` so we accumulate manually.
  const accumulatedRef = useRef<string>('')

  const start = useCallback(() => {
    setError(null)
    const Ctor = getRecognitionCtor()
    if (!Ctor) { setError('Speech recognition not supported in this browser'); return }
    try {
      const r = new Ctor()
      r.continuous = opts?.continuous ?? true
      r.interimResults = true
      r.lang = opts?.lang || 'en-US'
      r.onresult = (e) => {
        let finalChunk = ''
        let interimChunk = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          const text = res[0]?.transcript || ''
          if (res.isFinal) finalChunk += text + ' '
          else interimChunk += text
        }
        if (finalChunk) {
          accumulatedRef.current = (accumulatedRef.current + ' ' + finalChunk).trim()
          setTranscript(accumulatedRef.current)
        }
        setInterim(interimChunk)
      }
      r.onerror = (e) => {
        setError(e.error || 'recognition error')
        setListening(false)
      }
      r.onend = () => {
        // If continuous mode and we didn't stop deliberately, restart.
        if (opts?.continuous && recogRef.current === r) {
          try { r.start() } catch { setListening(false) }
        } else {
          setListening(false)
        }
      }
      recogRef.current = r
      r.start()
      setListening(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start')
      setListening(false)
    }
  }, [opts?.lang, opts?.continuous])

  const stop = useCallback(() => {
    const r = recogRef.current
    recogRef.current = null  // signal onend handler not to auto-restart
    if (r) {
      try { r.stop() } catch {}
    }
    setListening(false)
    setInterim('')
  }, [])

  const reset = useCallback(() => {
    accumulatedRef.current = ''
    setTranscript('')
    setInterim('')
  }, [])

  useEffect(() => () => { stop() }, [stop])

  return { transcript, interim, listening, error, start, stop, reset, supported: isSpeechRecognitionSupported() }
}

// ─── speak — text-to-speech via SpeechSynthesis ─────────────────────
// Pick the best available voice on this device. We bias toward known-good
// natural voices (Apple Samantha, Google US English, Microsoft Aria/Jenny).
function pickBestVoice(): SpeechSynthesisVoice | undefined {
  if (!isSpeechSynthesisSupported()) return undefined
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return undefined
  // Preference order: macOS Samantha → Google Wavenet → Microsoft Aria/Jenny → any en-US neural → any en-US → first available
  const preferences = [
    (v: SpeechSynthesisVoice) => /samantha/i.test(v.name) && /en/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /(google.*us.*english)/i.test(v.name),
    (v: SpeechSynthesisVoice) => /(aria|jenny|guy|ava)/i.test(v.name) && /en/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /(natural|neural|premium|enhanced)/i.test(v.name) && /en-?US/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /(female|woman)/i.test(v.name) && /en-?US/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /en-?US/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /^en/i.test(v.lang),
  ]
  for (const pref of preferences) {
    const found = voices.find(pref)
    if (found) return found
  }
  return voices[0]
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; voice?: SpeechSynthesisVoice; onEnd?: () => void }) {
  if (!isSpeechSynthesisSupported() || !text.trim()) { opts?.onEnd?.(); return }
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = opts?.rate ?? 1.0
  utter.pitch = opts?.pitch ?? 1.0
  const voice = opts?.voice || pickBestVoice()
  if (voice) utter.voice = voice
  if (opts?.onEnd) utter.onend = () => opts.onEnd?.()
  window.speechSynthesis.cancel()
  // On some browsers (Chrome desktop), voices list is loaded async — kick off speech immediately
  // but a tiny delay helps it use the chosen voice rather than the default.
  setTimeout(() => window.speechSynthesis.speak(utter), 50)
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}
