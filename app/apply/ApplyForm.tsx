'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// SEA-only — RaiseSEA's investor database only contains funds active in SEA, so non-SEA
// countries always returned 0 matches. Restrict the dropdown to the 11 SEA countries.
const COUNTRIES = ['Indonesia','Malaysia','Singapore','Vietnam','Thailand','Philippines','Myanmar','Cambodia','Laos','Brunei','Timor-Leste']
const SECTORS   = ['AI/ML','Fintech','SaaS / B2B','E-commerce','Healthtech','Logistics','Edtech','Agritech','Cleantech','Deep Tech','Consumer','Cybersecurity','Crypto / Web3','Other']
const STAGES    = ['Pre-seed','Seed','Pre-Series A','Series A','Series B']
const BIZ_MODELS = ['B2B','B2C','B2B2C','Marketplace','SaaS','Project / Contract','D2C','Other']
const FOUNDER_PROFILES = ['Technical founder','Domain expert','Serial entrepreneur','First-time founder','Business founder','Mixed team']
const CHECKING_STEPS = ['Fingerprinting the PDF','Checking monthly access','Preparing secure upload']
const UPLOAD_STEPS = ['Creating upload session','Uploading PDF to secure storage','Verifying upload']
const ANALYSIS_STEPS = ['Reading deck content','Scoring investor readiness','Sizing the market','Mapping competitors','Matching SEA investors','Building your report']

function formatUSD(val: string) {
  const n = val.replace(/[^0-9]/g, '')
  if (!n) return ''
  return Number(n).toLocaleString('en-US')
}
function parseUSD(val: string) { return val.replace(/[^0-9]/g, '') }

async function sha256File(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

type ApplyFormProps = {
  prefill: {
    founder_email: string     // from authenticated user — read-only
    founder_name: string      // from profile.full_name — editable
    company_name: string      // from profile.company_name — editable
    country: string           // from profile.country — editable
  }
  usage: {
    isLimited: boolean
    used: number
    limit: number
    resetLabel: string
  }
}

export default function ApplyForm({ prefill, usage }: ApplyFormProps) {
  const router = useRouter()
  const [step, setStep]     = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)  // 0-100, only shown during PDF upload phase
  const [stage_, setStage_] = useState<'idle' | 'checking' | 'uploading' | 'analyzing'>('idle')
  const [processingStep, setProcessingStep] = useState(0)
  const [error, setError]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const [form, setForm] = useState({
    company_name: prefill.company_name || '',
    country: prefill.country || 'Indonesia',
    stage: 'Seed',
    raise_target_usd: '', raise_display: '',
    sector: 'AI/ML', business_model: 'B2B',
    annual_revenue_usd: '', revenue_display: '',
    founder_name: prefill.founder_name || '',
    founder_email: prefill.founder_email,    // ALWAYS authoritative from auth
    founder_linkedin: '', founder_profile: 'Technical founder',
    current_investors: '', deck: null as File | null,
  })

  const set = (k: string, v: string | File | null) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!loading || stage_ === 'idle') return
    setProcessingStep(0)
    const steps = stage_ === 'checking'
      ? CHECKING_STEPS
      : stage_ === 'uploading'
        ? UPLOAD_STEPS
        : ANALYSIS_STEPS
    const intervalMs = stage_ === 'analyzing' ? 2200 : 1200
    const timer = window.setInterval(() => {
      setProcessingStep(step => Math.min(step + 1, steps.length - 1))
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [loading, stage_])

  function handleMoneyInput(field: string, displayField: string, raw: string) {
    const numeric = parseUSD(raw)
    setForm(f => ({ ...f, [field]: numeric, [displayField]: formatUSD(numeric) }))
  }

  function handleFile(file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file'); return }
    if (file.size > 20 * 1024 * 1024)  { setError('File must be under 20MB'); return }
    setError(''); set('deck', file); setFileName(file.name)
  }

  // Upload PDF directly to Supabase Storage via signed URL.
  // Uses XHR (not fetch) so we get real upload progress for the progress bar.
  function uploadToSignedUrl(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
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

  async function handleSubmit() {
    if (!form.deck)         { setError('Please upload your pitch deck'); return }
    if (!form.founder_email || !form.company_name) { setError('Please fill all required fields'); return }
    if (usage.isLimited && usage.used >= usage.limit) {
      setError(`Free accounts can use ${usage.limit} deck analyses each month. Your limit resets on ${usage.resetLabel}.`)
      return
    }
    setLoading(true); setError(''); setUploadProgress(0); setStage_('checking')
    try {
      const deckSha256 = await sha256File(form.deck)

      // ── Step 1: Get signed upload URL from our API ──────────
      const signedRes = await fetch('/api/upload/signed-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fileName: form.deck.name,
          fileSize: form.deck.size,
          mimeType: form.deck.type || 'application/pdf',
          deck_sha256: deckSha256,
        }),
      })
      const signed = await signedRes.json()
      if (!signedRes.ok) {
        if (signed.existing_url) {
          router.push(signed.existing_url)
          return
        }
        throw new Error(signed.error || 'Could not prepare upload')
      }

      // ── Step 2: PUT the PDF directly to Supabase Storage ────
      // This bypasses Vercel's 4.5MB function body limit. Progress tracked
      // via XHR so the user sees a real upload bar for large decks.
      setStage_('uploading')
      await uploadToSignedUrl(signed.uploadUrl, form.deck, setUploadProgress)

      // ── Step 3: POST metadata + storage path to /api/submit ─
      setStage_('analyzing')
      const metadata: Record<string, string> = {}
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'deck' || k === 'raise_display' || k === 'revenue_display') return
        if (v !== null && v !== '') metadata[k] = v as string
      })
      metadata.storage_path = signed.storagePath
      metadata.slug         = signed.slug
      if (deckSha256) metadata.deck_sha256 = deckSha256

      const res  = await fetch('/api/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(metadata),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.existing_url) {
          router.push(data.existing_url)
          return
        }
        throw new Error(data.error || 'Submission failed')
      }
      router.push(`/match/${data.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false); setStage_('idle')
    }
  }

  const steps    = ['Company', 'Deck & details', 'Confirm']
  const canNext1 = !!(form.company_name && form.raise_target_usd && form.founder_email && form.founder_name)
  const canNext2 = !!form.deck
  const deckLimitReached = usage.isLimited && usage.used >= usage.limit
  const processingSteps = stage_ === 'checking'
    ? CHECKING_STEPS
    : stage_ === 'uploading'
      ? UPLOAD_STEPS
      : ANALYSIS_STEPS
  const activeProcessingStep = stage_ === 'uploading'
    ? Math.min(Math.floor(uploadProgress / Math.max(1, 100 / processingSteps.length)), processingSteps.length - 1)
    : processingStep
  const meterPct = stage_ === 'checking'
    ? Math.min(28, 10 + activeProcessingStep * 9)
    : stage_ === 'uploading'
      ? Math.min(58, 30 + uploadProgress * 0.28)
      : Math.min(96, 62 + activeProcessingStep * (34 / Math.max(1, processingSteps.length - 1)))
  const processingTitle = stage_ === 'checking'
    ? 'Checking your deck'
    : stage_ === 'uploading'
      ? 'Uploading your deck'
      : 'Analyzing your deck'
  const processingSubtitle = stage_ === 'checking'
    ? 'We are validating your monthly access and making sure this is a new deck.'
    : stage_ === 'uploading'
      ? 'Your PDF is moving into secure storage before analysis starts.'
      : 'AI is reading the deck, scoring readiness, and preparing your investor report.'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --brand:#1a4d2e;--brand-mid:#2d7a4e;--brand-light:#E8F5E9;--brand-pale:#f0faf2;
          --ink:#0d1f14;--ink-mid:#3d5045;--ink-light:#6b7d6e;
          --border:#d6e4d9;--border-input:#8a9d8f;--bg:#fafcfa;--white:#fff;--red:#dc2626;
          --font-display:'DM Serif Display',Georgia,serif;
          --font-body:'DM Sans',system-ui,sans-serif;
        }
        html,body{font-family:var(--font-body)}

        .page{display:block;min-height:auto}

        /* RIGHT – form panel (now full width inside DashboardShell) */
        .right{background:transparent;padding:0;overflow-y:visible;display:flex;flex-direction:column;max-width:720px;margin:0 auto}

        /* Step indicators */
        .steps{display:flex;align-items:center;margin-bottom:44px}
        .si{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:500}
        .sn{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;transition:all .2s}
        .sn-done{background:var(--brand);color:white}
        .sn-active{background:var(--brand);color:white;box-shadow:0 0 0 4px rgba(26,77,46,.18)}
        .sn-pending{background:#e8e8e8;color:#aaa}
        .sl-done{color:var(--brand)}
        .sl-active{color:var(--ink);font-weight:600}
        .sl-pending{color:#bbb}
        .sline{flex:1;height:1px;background:#e5e5e5;margin:0 12px;max-width:44px}
        .sline-done{background:var(--brand)}

        /* Form header */
        .fh{font-family:var(--font-display);font-size:32px;color:var(--ink);margin-bottom:4px;line-height:1.2}
        .fs{font-size:14px;color:var(--ink-light);margin-bottom:32px;line-height:1.5}

        /* Section label */
        .sec{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-light);margin:28px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--border)}

        /* Grid */
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .full{grid-column:1/-1}

        /* Field */
        .field{display:flex;flex-direction:column;gap:5px}
        .field label{font-size:12px;font-weight:600;color:var(--ink-mid);display:flex;align-items:center;gap:4px}
        .req{color:var(--red)}
        .opt{color:var(--ink-light);font-weight:400;font-size:11px}
        .hint{font-size:11px;color:var(--ink-light);margin-top:3px}

        /* Inputs */
        .field input,.field select{
          background:var(--white);border:1px solid var(--border-input);border-radius:10px;
          padding:11px 14px;font-size:14px;font-family:var(--font-body);color:var(--ink);
          outline:none;width:100%;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none
        }
        .field select{
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7d6e' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat;background-position:right 13px center;padding-right:36px;cursor:pointer
        }
        .field input:focus,.field select:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(26,77,46,.1)}
        .field input::placeholder{color:#c0c8c2}

        /* Money input wrapper */
        .money-wrap{position:relative}
        .money-prefix{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--ink-light);pointer-events:none;font-weight:500}
        .money-wrap input{padding-left:26px}

        /* Upload */
        .upload{
          border:2px dashed var(--border);border-radius:14px;padding:44px 28px;
          text-align:center;cursor:pointer;transition:all .2s;background:var(--white)
        }
        .upload:hover,.upload.drag{border-color:var(--brand);background:var(--brand-pale)}
        .upload.done{border-color:var(--brand);background:var(--brand-light);border-style:solid}
        .up-icon{width:48px;height:48px;background:var(--brand-light);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
        .up-icon.ok{background:var(--brand)}
        .up-t{font-size:15px;font-weight:500;color:var(--ink);margin-bottom:5px}
        .up-s{font-size:13px;color:var(--ink-light)}
        .up-fn{font-size:13px;font-weight:500;color:var(--brand);margin-top:8px;word-break:break-all}

        /* Analysis checklist */
        .checklist{margin-top:24px;background:var(--brand-pale);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
        .cl-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--brand);margin-bottom:12px}
        .cl-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        .cl-item{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink-mid)}

        /* Buttons */
        .btn-row{display:flex;gap:10px;margin-top:36px}
        .btn-p{
          flex:2;background:var(--brand);color:white;border:none;border-radius:12px;
          padding:15px 24px;font-size:15px;font-weight:500;font-family:var(--font-body);
          cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
          transition:all .15s
        }
        .btn-p:hover:not(:disabled){background:var(--brand-mid);transform:translateY(-1px);box-shadow:0 6px 16px rgba(26,77,46,.22)}
        .btn-p:disabled{opacity:.45;cursor:not-allowed}
        .btn-s{
          flex:1;background:transparent;color:var(--ink-mid);border:1.5px solid var(--border);
          border-radius:12px;padding:14px 20px;font-size:15px;font-weight:500;
          font-family:var(--font-body);cursor:pointer;transition:all .15s
        }
        .btn-s:hover{border-color:var(--ink-mid);color:var(--ink)}

        /* Confirm */
        .c-card{background:var(--white);border:1.5px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:20px}
        .c-row{display:flex;justify-content:space-between;align-items:center;padding:13px 18px;border-bottom:1px solid var(--border);font-size:13px}
        .c-row:last-child{border-bottom:none}
        .c-k{color:var(--ink-light);font-weight:500}
        .c-v{color:var(--ink);font-weight:500;text-align:right;max-width:58%}
        .deck-pill{display:flex;align-items:center;gap:12px;background:var(--brand-light);border:1px solid #c5e8cc;border-radius:12px;padding:14px 16px}
        .dk-icon{width:36px;height:36px;background:var(--brand);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}

        /* Error */
        .err{background:#fef2f2;border:1px solid #fecaca;color:var(--red);font-size:13px;padding:11px 15px;border-radius:10px;margin-top:18px}
        .limit-note{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin:-24px 0 28px;font-size:12px;color:var(--ink-mid);line-height:1.55}
        .limit-note strong{color:var(--ink)}
        .limit-note.blocked{background:#fef2f2;border-color:#fecaca;color:#991b1b}
        .limit-note.blocked strong{color:#7f1d1d}

        /* Processing */
        .proc{display:flex;align-items:center;justify-content:center;padding:76px 20px;min-height:560px}
        .proc-card{width:min(100%,520px);background:var(--white);border:1px solid var(--border);border-radius:16px;padding:34px;box-shadow:0 18px 45px rgba(26,77,46,.08);text-align:left}
        .proc-head{display:flex;gap:18px;align-items:flex-start}
        .proc-ring-wrap{position:relative;width:74px;height:74px;flex-shrink:0}
        .proc-ring{position:absolute;inset:0;border:3px solid var(--brand-light);border-top-color:var(--brand);border-radius:50%;animation:spin .8s linear infinite}
        .proc-core{position:absolute;inset:16px;border-radius:18px;background:var(--brand);box-shadow:0 0 0 8px rgba(26,77,46,.08);animation:corepulse 1.6s ease-in-out infinite}
        @keyframes corepulse{0%,100%{transform:scale(.92);opacity:.75}50%{transform:scale(1);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .proc-title{font-family:var(--font-display);font-size:26px;color:var(--ink)}
        .proc-sub{font-size:14px;color:var(--ink-light);line-height:1.65;margin-top:4px}
        .proc-meter{margin-top:24px;height:8px;background:#edf3ef;border-radius:999px;overflow:hidden}
        .proc-meter-fill{height:100%;background:linear-gradient(90deg,var(--brand),var(--brand-mid));border-radius:999px;transition:width .35s ease}
        .proc-steps{display:flex;flex-direction:column;gap:10px;margin-top:22px}
        .ps{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink-light);transition:color .2s}
        .ps.active{color:var(--ink);font-weight:600}
        .ps.done{color:var(--brand)}
        .ps-dot{width:8px;height:8px;border-radius:50%;background:#c9d8ce;flex-shrink:0;transition:all .2s}
        .ps.active .ps-dot{background:var(--brand);animation:pulse 1.1s ease-in-out infinite;box-shadow:0 0 0 5px rgba(26,77,46,.1)}
        .ps.done .ps-dot{background:var(--brand)}
        .proc-foot{margin-top:24px;padding-top:16px;border-top:1px solid var(--border);font-size:11px;color:var(--ink-light);line-height:1.55}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}

        @media(max-width:900px){
          .right{padding:0}
        }
      `}</style>

      <div className="page">
        {/* ── FORM (full width inside DashboardShell) ── */}
        <div className="right">
          {loading ? (
            <div className="proc">
              <div className="proc-card">
                <div className="proc-head">
                  <div className="proc-ring-wrap" aria-hidden="true">
                    <div className="proc-ring" />
                    <div className="proc-core" />
                  </div>
                  <div>
                    <div className="proc-title">{processingTitle}</div>
                    <div className="proc-sub">{processingSubtitle}</div>
                  </div>
                </div>

                <div className="proc-meter" aria-hidden="true">
                  <div className="proc-meter-fill" style={{ width: `${meterPct}%` }} />
                </div>

                <div className="proc-steps">
                  {processingSteps.map((s, i) => {
                    const state = i < activeProcessingStep ? 'done' : i === activeProcessingStep ? 'active' : ''
                    return (
                      <div className={`ps ${state}`} key={s}>
                        <div className="ps-dot" />
                        <span>{s}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="proc-foot">
                  {stage_ === 'uploading'
                    ? `Upload progress: ${uploadProgress}%`
                    : 'Keep this tab open. We will move you to the report as soon as it is ready.'}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Step indicator */}
              <div className="steps">
                {steps.map((s,i)=>{
                  const n=i+1, state=n<step?'done':n===step?'active':'pending'
                  return (
                    <div key={s} style={{display:'flex',alignItems:'center'}}>
                      <div className="si">
                        <div className={`sn sn-${state}`}>
                          {n < step ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="m5 12 5 5L20 7"/></svg> : n}
                        </div>
                        <span className={`sl-${state}`}>{s}</span>
                      </div>
                      {i < steps.length-1 && <div className={`sline ${n<step?'sline-done':''}`} />}
                    </div>
                  )
                })}
              </div>

              {usage.isLimited && (
                <div className={`limit-note ${deckLimitReached ? 'blocked' : ''}`}>
                  <strong>Monthly deck analyses:</strong>{' '}
                  {Math.min(usage.used, usage.limit)}/{usage.limit} used.
                  {' '}Resets {usage.resetLabel}.
                </div>
              )}

              {/* ── STEP 1 ── */}
              {step === 1 && (
                <>
                  <div className="fh">Your company</div>
                  <div className="fs">Tell us about your startup and raise</div>

                  <div className="sec">Company details</div>
                  <div className="g2">
                    <div className="field full">
                      <label>Company name <span className="req">*</span></label>
                      <input placeholder="e.g. Kopi Labs" value={form.company_name} onChange={e=>set('company_name',e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Country <span className="req">*</span></label>
                      <select value={form.country} onChange={e=>set('country',e.target.value)}>
                        {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Sector <span className="req">*</span></label>
                      <select value={form.sector} onChange={e=>set('sector',e.target.value)}>
                        {SECTORS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Stage <span className="req">*</span></label>
                      <select value={form.stage} onChange={e=>set('stage',e.target.value)}>
                        {STAGES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Raise target <span className="req">*</span></label>
                      <div className="money-wrap">
                        <span className="money-prefix">$</span>
                        <input
                          placeholder="1,500,000"
                          value={form.raise_display}
                          onChange={e=>handleMoneyInput('raise_target_usd','raise_display',e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="sec">Traction</div>
                  <div className="g2">
                    <div className="field">
                      <label>Business model <span className="req">*</span></label>
                      <select value={form.business_model} onChange={e=>set('business_model',e.target.value)}>
                        {BIZ_MODELS.map(b=><option key={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Annual revenue <span className="opt">(optional)</span></label>
                      <div className="money-wrap">
                        <span className="money-prefix">$</span>
                        <input
                          placeholder="0"
                          value={form.revenue_display}
                          onChange={e=>handleMoneyInput('annual_revenue_usd','revenue_display',e.target.value)}
                        />
                      </div>
                      <div className="hint">0 if pre-revenue · Gemini estimates from deck if blank</div>
                    </div>
                  </div>

                  <div className="sec">About you</div>
                  <div className="g2">
                    <div className="field">
                      <label>Your name <span className="req">*</span></label>
                      <input placeholder="Full name" value={form.founder_name} onChange={e=>set('founder_name',e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Email <span className="req">*</span></label>
                      <input type="email" placeholder="you@company.com" value={form.founder_email} onChange={e=>set('founder_email',e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Founder profile <span className="req">*</span></label>
                      <select value={form.founder_profile} onChange={e=>set('founder_profile',e.target.value)}>
                        {FOUNDER_PROFILES.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>LinkedIn <span className="opt">(optional)</span></label>
                      <input placeholder="linkedin.com/in/yourprofile" value={form.founder_linkedin} onChange={e=>set('founder_linkedin',e.target.value)} />
                    </div>
                    <div className="field full">
                      <label>Current investors <span className="opt">(optional)</span></label>
                      <input placeholder="e.g. East Ventures, SMD Ventures" value={form.current_investors} onChange={e=>set('current_investors',e.target.value)} />
                      <div className="hint">We exclude them from matches and map their co-investor networks for warm intros</div>
                    </div>
                  </div>

                  {error && <div className="err">{error}</div>}
                  <div className="btn-row">
                    <button className="btn-p" disabled={!canNext1} onClick={()=>{setError('');setStep(2)}}>
                      Next: Upload deck
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 2 ── */}
              {step === 2 && (
                <>
                  <div className="fh">Upload your deck</div>
                  <div className="fs">PDF only · Max 20 MB · Used for AI analysis and investor matching</div>

                  <input ref={fileRef} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0]||null)} />
                  <div
                    className={`upload ${dragOver?'drag':''} ${form.deck?'done':''}`}
                    onClick={()=>fileRef.current?.click()}
                    onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                    onDragLeave={()=>setDragOver(false)}
                    onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}}
                  >
                    {form.deck ? (
                      <>
                        <div className="up-icon ok">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="m5 12 5 5L20 7"/></svg>
                        </div>
                        <div className="up-t" style={{color:'var(--brand)'}}>Deck uploaded</div>
                        <div className="up-fn">{fileName}</div>
                        <div className="up-s" style={{marginTop:8}}>Click to replace</div>
                      </>
                    ) : (
                      <>
                        <div className="up-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a4d2e" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div className="up-t">Drop your pitch deck here</div>
                        <div className="up-s">or click to browse · PDF only · Max 20 MB</div>
                      </>
                    )}
                  </div>

                  <div className="checklist">
                    <div className="cl-title">What Gemini AI analyzes from your deck</div>
                    <div className="cl-grid">
                      {['Problem & opportunity','Solution & product','Market size','Business model','Traction evidence','Team background','Financials & ask','Narrative & design'].map(i=>(
                        <div className="cl-item" key={i}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3"><path d="m5 12 5 5L20 7"/></svg>
                          {i}
                        </div>
                      ))}
                    </div>
                  </div>

                  {error && <div className="err">{error}</div>}
                  <div className="btn-row">
                    <button className="btn-s" onClick={()=>{setError('');setStep(1)}}>Back</button>
                    <button className="btn-p" disabled={!canNext2} onClick={()=>{setError('');setStep(3)}}>
                      Review & submit
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 3 ── */}
              {step === 3 && (
                <>
                  <div className="fh">Confirm & submit</div>
                  <div className="fs">Review your details before we run the analysis</div>

                  <div className="c-card">
                    {([
                      ['Company', form.company_name],
                      ['Country', form.country],
                      ['Sector', form.sector],
                      ['Stage', form.stage],
                      ['Raise target', form.raise_target_usd ? `$${Number(form.raise_target_usd).toLocaleString()}` : '—'],
                      ['Business model', form.business_model],
                      ['Annual revenue', form.annual_revenue_usd ? `$${Number(form.annual_revenue_usd).toLocaleString()}` : 'Pre-revenue'],
                      ['Founder', form.founder_name],
                      ['Email', form.founder_email],
                      ['Founder profile', form.founder_profile],
                    ] as [string, string][]).map(([k, v]) => (
                      <div className="c-row" key={k}>
                        <span className="c-k">{k}</span>
                        <span className="c-v">{v}</span>
                      </div>
                    ))}
                  </div>

                  {form.deck && (
                    <div className="deck-pill">
                      <div className="dk-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--brand)'}}>Pitch deck ready</div>
                        <div style={{fontSize:12,color:'var(--ink-light)',marginTop:2}}>{fileName}</div>
                      </div>
                    </div>
                  )}

                  <div style={{marginTop:20,padding:'14px 16px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,fontSize:12,color:'#92400e',lineHeight:1.65}}>
                    By submitting, Gemini AI will analyze your deck (60–90 seconds). Your data is stored securely and never shared publicly without your consent.
                  </div>

                  {error && <div className="err">{error}</div>}
                  <div className="btn-row">
                    <button className="btn-s" onClick={()=>{setError('');setStep(2)}}>Back</button>
                    <button className="btn-p" onClick={handleSubmit} disabled={deckLimitReached}>
                      Run analysis
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
