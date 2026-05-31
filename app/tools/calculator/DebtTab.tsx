// ═══════════════════════════════════════════════════════════════
// app/tools/calculator/DebtTab.tsx
//
// Loan amortization calculator. Matches SAFE/Equity calc patterns:
//   • Info tooltips on every input
//   • Collapsible 2-minute guide
//   • Outcome metrics + amortization schedule
//   • Save scenario + download PDF
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { calculateDebt, fmtUSDPrecise, fmtUSDCompact, type DebtInputs } from '@/lib/debt-math'
import { TermTooltip } from '@/components/ui'
import { Info as InfoIcon, AlertCircle, TrendingUp, Download, Save, Trash2, ChevronDown } from 'lucide-react'

type Saved = { id: string; name: string; instrument: string; inputs: DebtInputs; created_at: string }

interface DebtTabProps {
  initialSaved?: Saved[]
}

const DEFAULTS: DebtInputs = {
  principal:     500_000,
  annualRatePct: 8,
  termMonths:    36,
}

// ─── Tooltip ───────────────────────────────────────────────────

function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 w-4 h-4 rounded-full bg-surface-sunken text-text-tertiary text-[10px] font-bold inline-flex items-center justify-center hover:bg-gray-300 align-middle">
        i
      </button>
      {open && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg p-2.5 shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

// ─── Number field (FIXED leading-zero bug) ─────────────────────
//
// Controlled-string-state pattern matching EquityTab.PctField.
// Shows empty + placeholder when value is at minimum, allows
// decimals for rates and integer-only for months.

interface NumberFieldProps {
  label:     string
  value:     number
  onChange:  (v: number) => void
  suffix:    string
  min:       number
  max:       number
  step:      number
  allowDecimal?: boolean
  tip?:      string
}

function NumberField({ label, value, onChange, suffix, min, max, allowDecimal = true, tip }: NumberFieldProps) {
  const [draft, setDraft] = useState<string>(value > 0 ? String(value) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return
    const parsed = parseFloat(draft)
    if (Number.isNaN(parsed) || Math.abs(parsed - value) > 0.001) {
      setDraft(value > 0 ? String(value) : '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const inputRegex = allowDecimal
    ? /^\d{0,4}(\.\d{0,2})?$/
    : /^\d{0,3}$/

  return (
    <div>
      <label className="flex items-center text-xs font-medium text-text-secondary mb-1.5">
        {label}
        {tip && <Info text={tip} />}
      </label>
      <div className="flex items-stretch border border-border-strong rounded-md focus-within:border-brand transition-colors">
        <input
          ref={inputRef}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          value={draft}
          onChange={e => {
            const raw = e.target.value
            if (raw === '' || inputRegex.test(raw)) {
              setDraft(raw)
              const parsed = parseFloat(raw)
              const clamped = Number.isNaN(parsed) ? min : Math.max(min, Math.min(max, parsed))
              onChange(clamped)
            }
          }}
          onBlur={() => {
            if (draft === '' || draft === '.') {
              setDraft(String(min))
              onChange(min)
            }
          }}
          className="flex-1 px-2.5 py-1.5 bg-transparent text-sm text-text-primary tabular-nums focus:outline-none"
          placeholder={String(min)}
        />
        <span className="px-2.5 py-1.5 bg-surface-muted text-text-tertiary text-sm font-medium border-l border-border-strong">{suffix}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════

export default function DebtTab({ initialSaved = [] }: DebtTabProps) {
  const [inp, setInp] = useState<DebtInputs>(DEFAULTS)
  const [saved, setSaved] = useState<Saved[]>(initialSaved)
  const [showFullSchedule, setShowFullSchedule] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')

  const result = useMemo(() => calculateDebt(inp), [inp])

  function set(patch: Partial<DebtInputs>) { setInp(prev => ({ ...prev, ...patch })) }

  async function saveScenario() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tools/safe-scenarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: saveName.trim(), instrument: 'debt', inputs: inp }),
      })
      const data = await res.json()
      if (res.ok && data.scenario) { setSaved([data.scenario, ...saved]); setSaveName('') }
    } finally { setSaving(false) }
  }
  async function deleteScenario(id: string) {
    const res = await fetch(`/api/tools/safe-scenarios?id=${id}`, { method: 'DELETE' })
    if (res.ok) setSaved(saved.filter(s => s.id !== id))
  }
  function loadScenario(s: Saved) {
    setInp({ ...DEFAULTS, ...s.inputs })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function downloadPDF() {
    setShowIntro(true)
    setShowFullSchedule(true)
    setTimeout(() => window.print(), 100)
  }

  const displaySchedule = showFullSchedule
    ? result.schedule
    : (result.schedule.length > 12
        ? [...result.schedule.slice(0, 6), null, ...result.schedule.slice(-6)]
        : result.schedule)

  return (
    <div className="max-w-5xl debt-print-root">

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .debt-print-root, .debt-print-root * { visibility: visible !important; }
          .debt-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; padding: 0 12px; }
          .no-print { display: none !important; }
          details { display: block !important; }
          summary { display: none !important; }
          input { border: none !important; background: transparent !important; }
        }
      `}</style>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <div className="text-xl font-bold text-text-primary">RaiseSEA — Debt Repayment Schedule</div>
        <div className="text-sm text-text-tertiary mt-1">
          ${inp.principal.toLocaleString()} @ {inp.annualRatePct}% APR over {inp.termMonths} months · Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Debt Calculator</h2>
          <p className="text-sm text-text-tertiary mt-1">
            Model a loan with standard monthly amortization. No equity impact, no dilution — just predictable cash payments.
          </p>
        </div>
        <button onClick={downloadPDF}
          className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap flex-shrink-0 no-print inline-flex items-center gap-1.5">
          <Download className="w-3 h-3" strokeWidth={2} />
          Download PDF
        </button>
      </div>

      {/* 2-minute guide */}
      <div className="bg-brand-soft/30 border border-brand/20 rounded-xl mb-5 no-print">
        <button
          type="button"
          onClick={() => setShowIntro(!showIntro)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-brand-soft/50 transition-colors rounded-xl"
        >
          <span className="text-sm font-semibold text-brand">📘 New to debt financing? Read the 2-minute guide</span>
          <ChevronDown className={`w-4 h-4 text-brand transition-transform ${showIntro ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>
        {showIntro && (
          <div className="px-4 pb-4 text-sm text-text-secondary leading-relaxed space-y-3">
            <p>
              Debt = you borrow money and pay it back over time with interest. <strong>No equity given up</strong> — but you commit future cash flow to service it. Different beast from SAFEs or priced rounds.
            </p>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">When debt makes sense</div>
              <p className="text-xs text-text-tertiary">
                You have <strong>predictable recurring revenue</strong> (SaaS MRR, subscription cash flow, established sales). The monthly payment must fit comfortably inside your cash flow — usually under 15% of monthly revenue to be safe. Early-stage pre-revenue startups almost never qualify.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">SEA debt rates (rough guide)</div>
              <p className="text-xs text-text-tertiary">
                <strong>Bank SME loans:</strong> 6–10% <TermTooltip term="APR">APR</TermTooltip>, often need collateral or directors&apos; guarantee · <strong>Venture debt:</strong> 10–14% APR + warrants (small equity kicker) · <strong>Revenue-based financing:</strong> ~12–24% effective APR · <strong>Family/founder loans:</strong> 0–5%, but document properly.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">Amortization vs interest-only</div>
              <p className="text-xs text-text-tertiary">
                This calculator models <strong>standard <TermTooltip term="amortization">amortization</TermTooltip></strong>: equal monthly payments where each one is partly principal + partly interest. Other structures exist (interest-only with balloon payment at end, declining-balance) — ask your lender. The total interest paid is much higher than a quick &quot;X% rate&quot; would suggest.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">

        {/* ═══ LEFT: INPUTS ═══ */}
        <div className="space-y-4 no-print min-w-0">
          <div className="bg-surface-card border border-border rounded-xl p-4 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Loan terms</div>
            <div>
              <label className="flex items-center text-xs font-medium text-text-secondary mb-1.5">
                Principal (loan amount)
                <Info text="The amount you're borrowing. Comes in as cash upfront." />
              </label>
              <div className="flex items-stretch border border-border-strong rounded-md focus-within:border-brand">
                <span className="px-2.5 py-1.5 bg-surface-muted text-text-tertiary text-sm font-medium border-r border-border-strong">$</span>
                <input type="text" inputMode="numeric"
                  value={inp.principal > 0 ? inp.principal.toLocaleString('en-US') : ''}
                  onChange={e => set({ principal: parseInt(e.target.value.replace(/[^\d]/g, '') || '0', 10) })}
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-sm text-text-primary tabular-nums focus:outline-none"
                  placeholder="0" />
              </div>
            </div>
            <NumberField
              label="Annual interest rate"
              value={inp.annualRatePct}
              onChange={v => set({ annualRatePct: v })}
              suffix="%"
              min={0}
              max={50}
              step={0.25}
              allowDecimal={true}
              tip="Annual Percentage Rate (APR). SEA: bank loans 6–10%, venture debt 10–14%, RBF 12–24% effective, family loans 0–5%."
            />
            <NumberField
              label="Term"
              value={inp.termMonths}
              onChange={v => set({ termMonths: v })}
              suffix="months"
              min={1}
              max={360}
              step={1}
              allowDecimal={false}
              tip="How long until the loan is fully repaid. Standard venture debt: 24–36 months. Bank SME: 36–60 months."
            />
          </div>

          {/* Reality check */}
          {inp.principal > 0 && (
            <div className="bg-warning-bg border border-warning-border rounded-xl p-3 flex items-start gap-2.5 no-print">
              <AlertCircle className="w-3.5 h-3.5 text-warning-text shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-[11px] text-warning-text leading-relaxed">
                <strong>Reality check:</strong> debt requires monthly payments from cash flow regardless of how the business is doing. Most early-stage startups can&apos;t service debt yet. Make sure your monthly revenue comfortably exceeds the {fmtUSDPrecise(result.monthlyPayment)} payment.
              </p>
            </div>
          )}

          {/* Save scenario */}
          <div className="bg-surface-card border border-border rounded-xl p-4 no-print">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Save this scenario</div>
            <div className="flex gap-2 mb-3">
              <input type="text" placeholder="e.g. SME loan, 4 years"
                value={saveName} onChange={e => setSaveName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-border-strong rounded-md text-sm focus:outline-none focus:border-brand" />
              <button onClick={saveScenario} disabled={saving || !saveName.trim()}
                className="bg-brand hover:bg-brand-hover text-text-inverse text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                <Save className="w-3 h-3" strokeWidth={2} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {saved.filter(s => s.instrument === 'debt').length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {saved.filter(s => s.instrument === 'debt').map(s => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <button onClick={() => loadScenario(s)}
                      className="flex-1 text-left text-xs text-text-secondary hover:text-brand truncate py-1">
                      {s.name}
                    </button>
                    <button onClick={() => deleteScenario(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger-text">
                      <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: RESULTS ═══ */}
        <div className="space-y-4 min-w-0">
          {/* Outcome card */}
          <div className="bg-surface-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Outcome</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <Metric label="Monthly payment" value={fmtUSDPrecise(result.monthlyPayment)} sub={`for ${inp.termMonths} months`} accent="brand" />
              <Metric label="Total interest"  value={fmtUSDCompact(result.totalInterestPaid)} sub={`${((result.totalInterestPaid / Math.max(1, inp.principal)) * 100).toFixed(1)}% of principal`}
                accent={result.totalInterestPaid > inp.principal * 0.3 ? 'warning' : 'neutral'} />
              <Metric label="Total paid" value={fmtUSDCompact(result.totalPaid)} sub="Principal + interest" />
            </div>
          </div>

          {/* Amortization schedule */}
          <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-muted flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" strokeWidth={2} />
                Amortization schedule
              </h3>
              {result.schedule.length > 12 && (
                <button onClick={() => setShowFullSchedule(s => !s)}
                  className="no-print text-[11px] font-medium text-brand hover:text-brand-hover transition-colors">
                  {showFullSchedule ? 'Show summary' : `Show all ${result.schedule.length} months`}
                </button>
              )}
            </div>

            {/* Horizontal scroll wrapper for mobile — table has 5 cols of $-precise values that need ~480px to render properly */}
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 bg-surface-muted/60 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  <div>#</div>
                  <div className="text-right">Principal</div>
                  <div className="text-right">Interest</div>
                  <div className="text-right">Payment</div>
                  <div className="text-right">Balance</div>
                </div>

                <div className={showFullSchedule ? 'max-h-[360px] overflow-y-auto print:max-h-none print:overflow-visible' : 'max-h-[360px] overflow-y-auto'}>
                  {displaySchedule.map((row, i) => {
                    if (row === null) {
                      return (
                        <div key={`gap-${i}`} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 border-b border-border-muted text-[10px] text-text-tertiary text-center">
                          <div className="col-span-5 italic">…{result.schedule.length - 12} months hidden — click &quot;Show all&quot;…</div>
                        </div>
                      )
                    }
                    return (
                      <div key={row.month} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 border-b border-border-muted last:border-b-0 text-[11px] tabular-nums hover:bg-surface-muted/40">
                        <div className="text-text-tertiary">{row.month}</div>
                        <div className="text-right text-text-primary">{fmtUSDPrecise(row.principalPaid)}</div>
                        <div className="text-right text-warning-text">{fmtUSDPrecise(row.interestPaid)}</div>
                        <div className="text-right font-medium text-text-primary">{fmtUSDPrecise(row.totalPayment)}</div>
                        <div className="text-right text-text-secondary">{fmtUSDPrecise(row.remainingBalance)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Helpful context */}
          <div className="bg-surface-muted/60 border border-border rounded-xl p-3 flex items-start gap-2.5">
            <InfoIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0 mt-0.5" strokeWidth={1.75} />
            <div className="text-[11px] text-text-secondary leading-relaxed">
              <strong className="text-text-primary">No equity given up.</strong> Unlike SAFEs or priced rounds, debt doesn&apos;t affect your cap table. But it does affect your runway — you&apos;re committing future cash to service it.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: 'brand' | 'warning' | 'neutral' }) {
  const colorClass = { brand: 'text-brand', warning: 'text-warning-text', neutral: 'text-text-primary' }[accent || 'neutral']
  return (
    <div className="min-w-0 overflow-hidden">
      <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary truncate">{label}</div>
      <div className={`text-base font-semibold mt-0.5 tabular-nums truncate ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{sub}</div>
    </div>
  )
}
