'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileText,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import type { IncubatorStartupView } from '../incubator'

type UploadProps = {
  startups: IncubatorStartupView[]
  schemaReady: boolean
  schemaError?: string
}

type Mode = 'new' | 'existing'
type Stage = 'idle' | 'checking' | 'uploading' | 'analyzing'

const STEPS: Record<Exclude<Stage, 'idle'>, string[]> = {
  checking: ['Fingerprinting deck file', 'Preparing secure upload', 'Checking Unpad startup record'],
  uploading: ['Creating signed upload session', 'Uploading PDF to Supabase Storage', 'Verifying deck file'],
  analyzing: ['Reading deck content', 'Scoring investor readiness', 'Comparing with prior deck versions', 'Saving Unpad progress record'],
}

const EMPTY_FORM = {
  startupId: '',
  startupName: '',
  founderName: '',
  founderEmail: '',
  faculty: '',
  cohort: 'Unpad 2026 Batch A',
  sector: 'Deep Tech',
  stage: 'Seed',
  status: 'Applied',
  mentorName: '',
  oneLiner: '',
  country: 'Indonesia',
  raiseTargetUsd: '',
  businessModel: 'B2B',
}

export default function UploadSimulation({ startups, schemaReady, schemaError }: UploadProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>(startups.length > 0 ? 'existing' : 'new')
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedStartup = useMemo(
    () => startups.find(startup => startup.id === form.startupId) || null,
    [startups, form.startupId]
  )
  const activeSteps = stage === 'idle' ? [] : STEPS[stage]
  const progressPct = stage === 'idle'
    ? 0
    : stage === 'checking'
      ? 18 + stepIndex * 10
      : stage === 'uploading'
        ? 38 + uploadProgress * 0.22
        : Math.min(96, 68 + stepIndex * 8)

  function update(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function selectStartup(startupId: string) {
    const startup = startups.find(item => item.id === startupId)
    if (!startup) {
      update('startupId', startupId)
      return
    }
    setForm(current => ({
      ...current,
      startupId,
      startupName: startup.name,
      founderName: startup.founder === 'Founder not set' ? '' : startup.founder,
      founderEmail: startup.founderEmail,
      faculty: startup.faculty === 'Faculty not set' ? '' : startup.faculty,
      cohort: startup.cohort,
      sector: startup.sector === 'Sector not set' ? current.sector : startup.sector,
      stage: startup.stage === 'Stage not set' ? current.stage : startup.stage,
      status: startup.status,
      mentorName: startup.mentor === 'Unassigned mentor' ? '' : startup.mentor,
      oneLiner: startup.oneLiner === 'No one-liner recorded yet.' ? '' : startup.oneLiner,
    }))
  }

  function handleFile(nextFile: File | null) {
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf' && !nextFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF deck.')
      return
    }
    if (nextFile.size > 25 * 1024 * 1024) {
      setError('Deck must be under 25MB.')
      return
    }
    setFile(nextFile)
    setError('')
    setSuccess('')
  }

  async function submit() {
    if (!schemaReady) {
      setError('The Unpad Supabase tables are not ready yet. Run migration v22 first.')
      return
    }
    if (mode === 'existing' && !form.startupId) {
      setError('Choose the startup this deck belongs to.')
      return
    }
    if (!form.startupName.trim()) {
      setError('Startup name is required.')
      return
    }
    if (!form.founderName.trim() || !form.founderEmail.trim()) {
      setError('Founder name and email are required so the startup can monitor progress later.')
      return
    }
    if (!file) {
      setError('Upload one PDF deck.')
      return
    }

    setError('')
    setSuccess('')
    setUploadProgress(0)

    try {
      setStage('checking')
      setStepIndex(0)
      const deckSha256 = await sha256File(file)
      setStepIndex(1)

      const signedRes = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/pdf',
          deck_sha256: deckSha256,
        }),
      })
      const signed = await signedRes.json()
      if (!signedRes.ok) throw new Error(signed.error || 'Could not prepare secure upload')

      setStage('uploading')
      setStepIndex(0)
      await uploadToSignedUrl(signed.uploadUrl, file, pct => {
        setUploadProgress(pct)
        setStepIndex(pct < 80 ? 1 : 2)
      })

      setStage('analyzing')
      setStepIndex(0)
      const stepTimer = window.setInterval(() => {
        setStepIndex(step => Math.min(step + 1, STEPS.analyzing.length - 1))
      }, 1600)

      const metadata = {
        company_name: form.startupName.trim(),
        founder_name: form.founderName.trim(),
        founder_email: form.founderEmail.trim(),
        country: form.country,
        stage: form.stage,
        sector: form.sector,
        raise_target_usd: form.raiseTargetUsd.replace(/[^0-9]/g, '') || '0',
        business_model: form.businessModel,
        current_investors: '',
        storage_path: signed.storagePath,
        slug: signed.slug,
        deck_sha256: deckSha256,
        institution_slug: 'unpad',
        incubator_startup_id: mode === 'existing' ? form.startupId : '',
        incubator_startup_name: form.startupName.trim(),
        incubator_founder_name: form.founderName.trim(),
        incubator_founder_email: form.founderEmail.trim(),
        incubator_faculty: form.faculty.trim(),
        incubator_cohort: form.cohort.trim(),
        incubator_status: form.status,
        incubator_mentor_name: form.mentorName.trim(),
        incubator_one_liner: form.oneLiner.trim(),
      }

      const submitRes = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      })
      const result = await submitRes.json()
      window.clearInterval(stepTimer)

      if (!submitRes.ok) {
        if (result.existing_url) {
          router.push(result.existing_url)
          return
        }
        throw new Error(result.error || 'Deck analysis failed')
      }

      setSuccess(`Deck v${result.deck_version || 'new'} saved for ${form.startupName}.`)
      router.push(`/unpad/startups/${result.incubator_startup_id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload and analyze this deck.')
      setStage('idle')
    }
  }

  return (
    <div className="grid xl:grid-cols-[.95fr_1.05fr] gap-5">
      <section className="bg-white border border-[#d9dfd2] rounded-lg p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a]">Super-admin operator</div>
        <h2 className="text-lg font-semibold text-[#102033] mt-1">Upload a real Unpad startup deck</h2>
        <p className="text-xs text-[#687468] leading-relaxed mt-2">
          This uses the same signed upload, AI analysis, duplicate checking, and Supabase storage flow as RaiseSEA deck analysis.
        </p>

        {!schemaReady && (
          <div className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]">
            Run `supabase/migrations/v22_incubator_unpad_workspace.sql` in Supabase first. {schemaError ? `Current error: ${schemaError}` : ''}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`h-10 rounded-md border text-sm font-medium ${mode === 'new' ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-[#102033] border-[#cfd9cf]'}`}
          >
            New startup
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`h-10 rounded-md border text-sm font-medium ${mode === 'existing' ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-[#102033] border-[#cfd9cf]'}`}
          >
            Existing startup
          </button>
        </div>

        {mode === 'existing' && (
          <label className="block mt-4">
            <span className="text-xs font-semibold text-[#425246]">Startup</span>
            <select
              value={form.startupId}
              onChange={event => selectStartup(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-[#cfd9cf] bg-white px-3 text-sm text-[#102033] outline-none focus:border-[#1a4d2e] focus:ring-2 focus:ring-[#1a4d2e]/10"
            >
              <option value="">Choose startup</option>
              {startups.map(startup => (
                <option key={startup.id} value={startup.id}>{startup.name} · v{startup.latestVersion}</option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <Field label="Startup name" value={form.startupName} onChange={value => update('startupName', value)} />
          <Field label="Founder name" value={form.founderName} onChange={value => update('founderName', value)} />
          <Field label="Founder email" value={form.founderEmail} onChange={value => update('founderEmail', value)} />
          <Field label="Faculty" value={form.faculty} onChange={value => update('faculty', value)} />
          <Field label="Cohort" value={form.cohort} onChange={value => update('cohort', value)} />
          <Field label="Mentor" value={form.mentorName} onChange={value => update('mentorName', value)} />
          <SelectField label="Sector" value={form.sector} onChange={value => update('sector', value)} options={['AI/ML', 'Deep Tech', 'Healthtech', 'Agritech', 'Consumer', 'Fintech', 'Edtech', 'SaaS']} />
          <SelectField label="Stage" value={form.stage} onChange={value => update('stage', value)} options={['Pre-seed', 'Seed', 'Pre-Series A', 'Series A']} />
          <SelectField label="Status" value={form.status} onChange={value => update('status', value)} options={['Applied', 'Screening', 'Accepted', 'Incubating', 'Demo Day Ready', 'Alumni']} />
          <Field label="Raise target USD" value={form.raiseTargetUsd} onChange={value => update('raiseTargetUsd', value)} />
        </div>

        <label className="block mt-3">
          <span className="text-xs font-semibold text-[#425246]">One-liner</span>
          <textarea
            value={form.oneLiner}
            onChange={event => update('oneLiner', event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-[#cfd9cf] bg-white px-3 py-2 text-sm text-[#102033] outline-none focus:border-[#1a4d2e] focus:ring-2 focus:ring-[#1a4d2e]/10"
          />
        </label>

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') fileRef.current?.click()
          }}
          onDragOver={event => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={event => {
            event.preventDefault()
            setDragOver(false)
            handleFile(event.dataTransfer.files?.[0] || null)
          }}
          className={`mt-5 rounded-lg border-2 border-dashed p-7 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-[#1a4d2e] bg-[#eef4ef]' : file ? 'border-[#1a4d2e] bg-[#f7fbf7]' : 'border-[#cfd9cf] bg-[#fbfcfa] hover:border-[#1a4d2e]/60'
          }`}
        >
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={event => handleFile(event.target.files?.[0] || null)} />
          <div className="w-12 h-12 rounded-lg bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center mx-auto">
            {file ? <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} /> : <UploadCloud className="w-5 h-5" strokeWidth={1.75} />}
          </div>
          <div className="text-sm font-semibold text-[#102033] mt-3">{file ? file.name : 'Upload PDF deck'}</div>
          <div className="text-xs text-[#687468] mt-1">Duplicate PDFs are blocked for the same Unpad startup.</div>
        </div>

        {stage !== 'idle' && (
          <div className="mt-5 rounded-lg border border-[#d9dfd2] bg-[#fbfcfa] p-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 shrink-0">
                <span className="absolute inset-0 rounded-full border-2 border-[#cfe0d2] border-t-[#1a4d2e] animate-spin" />
                <span className="absolute inset-3 rounded-full bg-[#1a4d2e]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#102033]">{stageLabel(stage)}</div>
                <div className="text-xs text-[#687468] mt-1">{activeStep(activeSteps, stepIndex)}</div>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-[#e8ede6] overflow-hidden">
              <div className="h-full rounded-full bg-[#1a4d2e] transition-all" style={{ width: `${Math.max(8, Math.min(98, progressPct))}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b] flex gap-2">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg border border-[#badfc1] bg-[#edf7ee] p-3 text-sm text-[#1f6b3b] flex gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={stage !== 'idle'}
          className="mt-5 h-11 w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#1a4d2e] text-white text-sm font-semibold hover:bg-[#153f26] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" strokeWidth={1.75} />
          Upload and analyze deck
        </button>
      </section>

      <section className="space-y-5">
        <div className="bg-[#102f4f] text-white rounded-lg p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Real workflow</div>
          <h2 className="text-lg font-semibold mt-2">What happens after submit</h2>
          <div className="mt-5 space-y-3">
            {[
              ['1', 'Deck is uploaded to Supabase Storage through a signed URL.'],
              ['2', 'RaiseSEA runs the same AI deck analysis and investor matching used by founders.'],
              ['3', 'The result is saved as an incubator deck version for this startup.'],
              ['4', 'The startup page compares the new score and dimensions against the prior deck.'],
            ].map(([num, text]) => (
              <div key={num} className="flex gap-3 rounded-md border border-white/15 bg-white/5 p-3">
                <div className="w-6 h-6 rounded bg-[#d8a640] text-[#102f4f] text-xs font-semibold flex items-center justify-center shrink-0">{num}</div>
                <div className="text-sm text-white/82 leading-relaxed">{text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#d9dfd2] rounded-lg p-5">
          <div className="flex items-center gap-2 text-[#1a4d2e]">
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            <div className="text-[11px] font-semibold uppercase tracking-wider">Existing Unpad startups</div>
          </div>
          <div className="mt-4 space-y-3">
            {startups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d9dfd2] p-5 text-sm text-[#687468] text-center">
                No Unpad startups yet. Create the first startup from this form.
              </div>
            ) : startups.map(startup => (
              <div key={startup.id} className="border border-[#e3e8df] rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#102033]">{startup.name}</div>
                    <div className="text-xs text-[#687468] mt-1">{startup.founder} · {startup.faculty}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-[#102033]">{startup.deckScore ?? '—'}</div>
                    <div className="text-[11px] text-[#687468]">Deck v{startup.latestVersion}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('existing')
                    selectStartup(startup.id)
                  }}
                  className="mt-3 h-8 inline-flex items-center gap-1.5 rounded-md border border-[#cfd9cf] px-3 text-xs font-medium text-[#102033] hover:border-[#94a394]"
                >
                  Use for next deck
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#425246]">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[#cfd9cf] bg-white px-3 text-sm text-[#102033] outline-none focus:border-[#1a4d2e] focus:ring-2 focus:ring-[#1a4d2e]/10"
      />
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#425246]">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[#cfd9cf] bg-white px-3 text-sm text-[#102033] outline-none focus:border-[#1a4d2e] focus:ring-2 focus:ring-[#1a4d2e]/10"
      >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

async function sha256File(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function uploadToSignedUrl(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf')
    xhr.send(file)
  })
}

function stageLabel(stage: Stage) {
  if (stage === 'checking') return 'Checking deck'
  if (stage === 'uploading') return 'Uploading deck'
  if (stage === 'analyzing') return 'Analyzing with RaiseSEA'
  return ''
}

function activeStep(steps: string[], index: number) {
  return steps[Math.min(index, steps.length - 1)] || 'Preparing'
}
