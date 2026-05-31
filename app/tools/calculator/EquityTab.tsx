// ═══════════════════════════════════════════════════════════════
// app/tools/calculator/EquityTab.tsx
//
// Priced equity round calculator. Models how a new investor's
// slice dilutes founders + ESOP + existing investors pro-rata.
//
// No "Pool refresh" — that concept overlaps with ESOP in the
// Current ownership block. One pool concept per page.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  calculateEquity, calculateEquityScenarios, fmtUSD, fmtPct, fmtComma,
  type EquityInputs,
} from '@/lib/equity-math'
import { DilutionInsight, type FundingStage } from '@/components/calculator/DilutionInsight'
import { TermTooltip } from '@/components/ui'
import { Download, Save, Trash2, ChevronDown } from 'lucide-react'

type Saved = { id: string; name: string; instrument: string; inputs: EquityInputs; created_at: string }

interface EquityTabProps {
  userStage?:    FundingStage | null
  initialSaved?: Saved[]
}

const DEFAULTS: EquityInputs = {
  preMoney:             8_000_000,
  raiseAmount:          1_500_000,
  founderPct:           100,
  esopPct:              0,
  existingInvestorPct:  0,
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

// ─── Money input (already handles empty/zero state correctly) ──

function MoneyField({ label, value, onChange, tip, glossaryTerm }: { label: string; value: number; onChange: (v: number) => void; tip?: string; glossaryTerm?: string }) {
  const display = value > 0 ? value.toLocaleString('en-US') : ''
  return (
    <div>
      <label className="flex items-center text-xs font-medium text-text-secondary mb-1.5">
        {glossaryTerm ? <TermTooltip term={glossaryTerm}>{label}</TermTooltip> : label}
        {tip && <Info text={tip} />}
      </label>
      <div className="flex items-stretch border border-border-strong rounded-md focus-within:border-brand transition-colors">
        <span className="px-2.5 py-1.5 bg-surface-muted text-text-tertiary text-sm font-medium border-r border-border-strong">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={e => {
            const cleaned = e.target.value.replace(/[^\d]/g, '')
            onChange(parseInt(cleaned || '0', 10))
          }}
          className="flex-1 px-2.5 py-1.5 bg-transparent text-sm text-text-primary tabular-nums focus:outline-none"
          placeholder="0"
        />
      </div>
    </div>
  )
}

// ─── Percent input (FIXED: no leading-zero bug) ────────────────
//
// Uses type="text" + inputMode="decimal" instead of type="number"
// so we control rendering. Shows empty string when value is 0,
// placeholder "0" provides the visual cue. Allows decimal entry.

function PctField({ label, value, onChange, tip }: { label: string; value: number; onChange: (v: number) => void; tip?: string }) {
  // Local string state lets the user type freely (including partial values like "20.")
  // without the parent's numeric state corrupting the display. We sync from `value`
  // when it changes externally (e.g., loading a saved scenario), but skip the sync
  // while the user is actively typing in this field.
  const [draft, setDraft] = useState<string>(value > 0 ? String(value) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Skip if user is actively typing in this field
    if (inputRef.current && document.activeElement === inputRef.current) return
    // Sync only if the parsed draft doesn't already match the external value
    const parsed = parseFloat(draft)
    if (Number.isNaN(parsed) || Math.abs(parsed - value) > 0.001) {
      setDraft(value > 0 ? String(value) : '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

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
          inputMode="decimal"
          value={draft}
          onChange={e => {
            const raw = e.target.value
            // Allow empty, digits, single dot, up to 2 decimals
            if (raw === '' || /^\d{0,3}(\.\d{0,2})?$/.test(raw)) {
              setDraft(raw)
              const parsed = parseFloat(raw)
              onChange(Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed)))
            }
          }}
          onBlur={() => {
            // Normalize on blur: if user left it empty or just ".", show "0"
            if (draft === '' || draft === '.') setDraft('0')
          }}
          className="flex-1 px-2.5 py-1.5 bg-transparent text-sm text-text-primary tabular-nums focus:outline-none"
          placeholder="0"
        />
        <span className="px-2.5 py-1.5 bg-surface-muted text-text-tertiary text-sm font-medium border-l border-border-strong">%</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function EquityTab({ userStage, initialSaved = [] }: EquityTabProps) {
  const [inp, setInp] = useState<EquityInputs>(DEFAULTS)
  const [saved, setSaved] = useState<Saved[]>(initialSaved)
  const [showIntro, setShowIntro] = useState(false)
  const [showOwnership, setShowOwnership] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')

  const result    = useMemo(() => calculateEquity(inp), [inp])
  const scenarios = useMemo(() => calculateEquityScenarios(inp), [inp])

  function set(patch: Partial<EquityInputs>) { setInp(prev => ({ ...prev, ...patch })) }

  // ─── Save / load / delete scenarios ──────────────────────────

  async function saveScenario() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tools/safe-scenarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: saveName.trim(), instrument: 'equity', inputs: inp }),
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
    setShowOwnership(true)
    setTimeout(() => window.print(), 100)
  }

  const totalOwnership = inp.founderPct + inp.esopPct + inp.existingInvestorPct
  const ownershipOk = Math.abs(totalOwnership - 100) <= 0.5

  return (
    <div className="max-w-5xl equity-print-root">

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .equity-print-root, .equity-print-root * { visibility: visible !important; }
          .equity-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; padding: 0 12px; }
          .no-print { display: none !important; }
          details { display: block !important; }
          summary { display: none !important; }
          input { border: none !important; background: transparent !important; }
          .print-page-break { page-break-before: always; }
        }
      `}</style>

      <div className="hidden print:block mb-6">
        <div className="text-xl font-bold text-text-primary">RaiseSEA — Equity Round Analysis</div>
        <div className="text-sm text-text-tertiary mt-1">
          ${fmtComma(inp.raiseAmount)} on ${fmtComma(inp.preMoney)} pre-money · Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Equity Calculator</h2>
          <p className="text-sm text-text-tertiary mt-1">
            Model what a priced equity round actually does to your cap table. See your dilution, post-money valuation, and how sensitive your outcome is to terms.
          </p>
        </div>
        <button onClick={downloadPDF}
          className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap flex-shrink-0 no-print inline-flex items-center gap-1.5">
          <Download className="w-3 h-3" strokeWidth={2} />
          Download PDF
        </button>
      </div>

      {/* ─── 2-MINUTE GUIDE (updated — no more option-pool-trap card) ─ */}
      <div className="bg-brand-soft/30 border border-brand/20 rounded-xl mb-5 no-print">
        <button
          type="button"
          onClick={() => setShowIntro(!showIntro)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-brand-soft/50 transition-colors rounded-xl"
        >
          <span className="text-sm font-semibold text-brand">📘 New to equity rounds? Read the 2-minute guide</span>
          <ChevronDown className={`w-4 h-4 text-brand transition-transform ${showIntro ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>
        {showIntro && (
          <div className="px-4 pb-4 text-sm text-text-secondary leading-relaxed space-y-3">
            <p>
              A <strong>priced equity round</strong> is when investors agree on your company&apos;s value <em>today</em> and buy newly-issued shares at that price. Common at Series A and up — though some seeds are priced too. Unlike a <TermTooltip term="SAFE">SAFE</TermTooltip>, the price per share is set now, and your <TermTooltip term="cap table">cap table</TermTooltip> immediately reflects the new investor.
            </p>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">Pre-money vs post-money</div>
              <p className="text-xs text-text-tertiary">
                <strong><TermTooltip term="Pre-money valuation">Pre-money</TermTooltip></strong> = what the company is worth BEFORE the new money. <strong><TermTooltip term="Post-money valuation">Post-money</TermTooltip></strong> = pre-money + raise amount. Your new investor&apos;s % is always <code className="text-[11px] bg-surface-sunken px-1 rounded">raise ÷ post-money</code>. So a $1.5M raise on $8M pre-money gives the investor $1.5M ÷ $9.5M = 15.79%.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">How dilution works</div>
              <p className="text-xs text-text-tertiary">
                When new investor enters, everyone else (you, your <TermTooltip term="ESOP">ESOP</TermTooltip>, existing investors) keeps the <em>same share of what&apos;s left</em> — but the cap table got bigger, so their <em>overall %</em> drops. If founders had 100% before and new investor takes 15.79%, founders now own (100 − 15.79) = 84.21%. Same pro-rata math applies to ESOP and existing investors. This is called <TermTooltip term="dilution">dilution</TermTooltip>.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">Why valuation negotiation matters</div>
              <p className="text-xs text-text-tertiary">
                A $1.5M raise on $6M pre-money = 20% dilution. The same raise on $10M pre-money = 13% dilution. That&apos;s 7 percentage points of your company. Use the Scenario Analysis below to see how sensitive you are to terms.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">

        {/* ═══ LEFT: INPUTS ═══ */}
        <div className="space-y-4 no-print min-w-0">

          {/* Round terms */}
          <div className="bg-surface-card border border-border rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Round terms</div>
            <MoneyField
              label="Pre-money valuation"
              value={inp.preMoney}
              onChange={v => set({ preMoney: v })}
              tip="What your company is worth BEFORE the new money comes in. This sets the price per share."
              glossaryTerm="Pre-money valuation"
            />
            <MoneyField
              label="Amount being raised"
              value={inp.raiseAmount}
              onChange={v => set({ raiseAmount: v })}
              tip="The new money coming in this round. Together with pre-money, this sets the new investor's ownership."
            />
          </div>

          {/* Current ownership */}
          <details className="bg-surface-card border border-border rounded-xl group" open={showOwnership} onToggle={(e) => setShowOwnership((e.target as HTMLDetailsElement).open)}>
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between list-none">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Current ownership <span className="text-text-tertiary normal-case font-normal lowercase">(optional)</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-text-tertiary transition-transform group-open:rotate-180" strokeWidth={2} />
            </summary>
            <div className="px-4 pb-4 space-y-3">
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                Your current cap table before this round. Leave founders at 100% if it&apos;s just you. <strong>These must add up to 100%.</strong>
              </p>
              <PctField
                label="Founder ownership"
                value={inp.founderPct}
                onChange={v => set({ founderPct: v })}
                tip="What % of the company you and your co-founders own today."
              />
              <PctField
                label="ESOP (employee stock)"
                value={inp.esopPct}
                onChange={v => set({ esopPct: v })}
                tip="Stock reserved or already granted to employees. If you have an option pool, this is its current size."
              />
              <PctField
                label="Current investors"
                value={inp.existingInvestorPct}
                onChange={v => set({ existingInvestorPct: v })}
                tip="Any existing investors — angels, prior SAFE holders who already converted, prior VCs."
              />
              <div className={`text-[11px] font-medium px-2 py-1.5 rounded-md ${ownershipOk ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
                Total: {fmtPct(totalOwnership, 1)} {ownershipOk ? '✓' : '— must be 100%'}
              </div>
            </div>
          </details>

          {/* Save scenario */}
          <div className="bg-surface-card border border-border rounded-xl p-4 no-print">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Save this scenario</div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="e.g. Tough market scenario"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-border-strong rounded-md text-sm focus:outline-none focus:border-brand"
              />
              <button onClick={saveScenario} disabled={saving || !saveName.trim()}
                className="bg-brand hover:bg-brand-hover text-text-inverse text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors">
                <Save className="w-3 h-3" strokeWidth={2} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {saved.filter(s => s.instrument === 'equity').length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {saved.filter(s => s.instrument === 'equity').map(s => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <button onClick={() => loadScenario(s)}
                      className="flex-1 text-left text-xs text-text-secondary hover:text-brand truncate py-1 transition-colors">
                      {s.name}
                    </button>
                    <button onClick={() => deleteScenario(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger-text transition-all">
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

            {!result.valid ? (
              <div className="text-sm text-danger-text bg-danger-bg border border-danger-border rounded-md p-3">
                {result.validationError}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                  <Metric label={<TermTooltip term="Post-money valuation">Post-money</TermTooltip>} value={fmtUSD(result.postMoney)}                    sub="Pre + raise" />
                  <Metric label="New investor"        value={fmtPct(result.after.newInvestor, 2)}         sub="of post-money cap table" accent="brand" />
                  <Metric label="Founder dilution"    value={fmtPct(result.dilution.founder, 2)}          sub="percentage points lost"
                    accent={result.dilution.founder > 25 ? 'warning' : 'neutral'} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  At ${fmtComma(inp.preMoney)} pre on ${fmtComma(inp.raiseAmount)} raised, your new investor takes{' '}
                  <strong>{fmtPct(result.after.newInvestor, 2)}</strong> of the company. Founders move from{' '}
                  <strong>{fmtPct(inp.founderPct, 1)}</strong> to <strong>{fmtPct(result.after.founder, 2)}</strong>.
                </p>
              </>
            )}
          </div>

          {/* Before vs after */}
          {result.valid && (
            <div className="bg-surface-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Before vs after this round closes</div>

              {/* Stacked bar */}
              <div className="flex h-8 rounded-md overflow-hidden border border-border-muted mb-3">
                {result.after.founder > 0.5 && (
                  <div className="bg-brand flex items-center justify-center text-[9px] font-semibold text-text-inverse"
                    style={{ width: `${result.after.founder}%` }} title={`Founders: ${fmtPct(result.after.founder, 2)}`}>
                    {result.after.founder > 8 && fmtPct(result.after.founder, 0)}
                  </div>
                )}
                {result.after.existingInvestor > 0.5 && (
                  <div className="bg-purple-500 flex items-center justify-center text-[9px] font-semibold text-text-inverse"
                    style={{ width: `${result.after.existingInvestor}%` }} title={`Existing: ${fmtPct(result.after.existingInvestor, 2)}`}>
                    {result.after.existingInvestor > 8 && fmtPct(result.after.existingInvestor, 0)}
                  </div>
                )}
                {result.after.newInvestor > 0.5 && (
                  <div className="bg-blue-600 flex items-center justify-center text-[9px] font-semibold text-text-inverse"
                    style={{ width: `${result.after.newInvestor}%` }} title={`New: ${fmtPct(result.after.newInvestor, 2)}`}>
                    {result.after.newInvestor > 8 && fmtPct(result.after.newInvestor, 0)}
                  </div>
                )}
                {result.after.esop > 0.5 && (
                  <div className="bg-gray-400 flex items-center justify-center text-[9px] font-semibold text-text-inverse"
                    style={{ width: `${result.after.esop}%` }} title={`ESOP: ${fmtPct(result.after.esop, 2)}`}>
                    {result.after.esop > 8 && fmtPct(result.after.esop, 0)}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-sm mt-3 min-w-[420px]">
                  <thead>
                    <tr className="text-[10px] uppercase text-text-disabled text-left">
                      <th className="pb-1.5 font-medium">Holder</th>
                      <th className="pb-1.5 font-medium text-right">Before</th>
                      <th className="pb-1.5 font-medium text-right">After</th>
                      <th className="pb-1.5 font-medium text-right">Change</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <CompareRow label="Founders"          color="#1a4d2e" before={result.before.founder}          after={result.after.founder}          delta={-result.dilution.founder} />
                  {(result.before.esop > 0.01 || result.after.esop > 0.01) && (
                    <CompareRow label="ESOP"            color="#9ca3af" before={result.before.esop}             after={result.after.esop}             delta={-result.dilution.esop} />
                  )}
                  {(result.before.existingInvestor > 0.01 || result.after.existingInvestor > 0.01) && (
                    <CompareRow label="Current investors" color="#7c3aed" before={result.before.existingInvestor} after={result.after.existingInvestor} delta={-result.dilution.existingInvestor} />
                  )}
                    <CompareRow label="New investor" color="#2563eb" before={0} after={result.after.newInvestor} delta={result.after.newInvestor} isNew />
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-text-tertiary mt-2">
                Your founder stake drops by <strong>{result.dilution.founder.toFixed(2)} percentage points</strong> from this round.
              </p>
            </div>
          )}

          {/* SEA dilution insight */}
          {result.valid && (
            <DilutionInsight
              dilutionPct={result.dilution.founder}
              raiseUsd={inp.raiseAmount}
              stage={userStage}
              fromUserDeck={!!userStage}
            />
          )}

          {/* Scenarios */}
          {result.valid && (
            <div className="bg-surface-card border border-border rounded-xl p-4 print-page-break">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-1">Scenario analysis</div>
              <p className="text-[11px] text-text-tertiary mb-3">
                Same cap table, different terms. See how sensitive your dilution is to valuation and raise size.
              </p>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-[10px] uppercase text-text-disabled text-left">
                      <th className="pb-1.5 font-medium">Scenario</th>
                      <th className="pb-1.5 font-medium text-right">Pre-money</th>
                      <th className="pb-1.5 font-medium text-right">Raise</th>
                      <th className="pb-1.5 font-medium text-right">New inv. %</th>
                      <th className="pb-1.5 font-medium text-right">Founder %</th>
                      <th className="pb-1.5 font-medium text-right">Dilution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scenarios.map((s, i) => (
                      <tr key={i} className={s.highlight ? 'bg-brand-soft/40 font-medium' : ''}>
                        <td className="py-2 text-text-secondary">{s.label}</td>
                        <td className="py-2 text-right text-text-primary tabular-nums">{fmtUSD(s.preMoney)}</td>
                        <td className="py-2 text-right text-text-primary tabular-nums">{fmtUSD(s.raiseAmount)}</td>
                        <td className="py-2 text-right text-blue-600 tabular-nums">{fmtPct(s.newInvestorPct, 1)}</td>
                        <td className="py-2 text-right text-brand tabular-nums">{fmtPct(s.founderAfterPct, 1)}</td>
                        <td className={`py-2 text-right tabular-nums ${s.founderDilution > 25 ? 'text-warning-text' : 'text-text-tertiary'}`}>−{fmtPct(s.founderDilution, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompareRow({ label, color, before, after, delta, isNew }: {
  label:  string; color: string; before: number; after: number; delta: number; isNew?: boolean
}) {
  return (
    <tr>
      <td className="py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
        <span className="text-text-secondary">{label}</span>
      </td>
      <td className="py-2 text-right text-text-tertiary tabular-nums">{isNew ? '—' : fmtPct(before, 2)}</td>
      <td className="py-2 text-right text-text-primary tabular-nums font-medium">{fmtPct(after, 2)}</td>
      <td className={`py-2 text-right tabular-nums ${delta < -0.01 ? 'text-warning-text' : delta > 0.01 ? 'text-success-text' : 'text-text-tertiary'}`}>
        {delta > 0.01 ? '+' : ''}{fmtPct(delta, 2)}
      </td>
    </tr>
  )
}

function Metric({ label, value, sub, accent }: { label: React.ReactNode; value: string; sub: string; accent?: 'brand' | 'warning' | 'neutral' }) {
  const colorClass = { brand: 'text-brand', warning: 'text-warning-text', neutral: 'text-text-primary' }[accent || 'neutral']
  return (
    <div className="min-w-0 overflow-hidden">
      <div className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary truncate">{label}</div>
      <div className={`text-base font-semibold mt-0.5 tabular-nums truncate ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{sub}</div>
    </div>
  )
}
