'use client'

import { useState, useMemo } from 'react'
import { TermTooltip } from '@/components/ui'
import { DilutionInsight, type FundingStage } from '@/components/calculator/DilutionInsight'
import {
  calculateConversion, calculateScenarios, instrumentNotes, fmtUSD, fmtComma,
  type Instrument, type SafeInputs,
} from '@/lib/safe-math'

type Saved = { id: string; name: string; instrument: string; inputs: SafeInputs; created_at: string }

const DEFAULTS: SafeInputs = {
  instrument: 'safe_post',
  investment: 500000,
  valuationCap: 8000000,
  discountPct: 20,
  interestPct: 6,
  termMonths: 18,
  nextPreMoney: 20000000,
  newMoneyRaised: 5000000,
  founderPct: 100,
  optionPoolPct: 0,
  existingInvestorPct: 0,
}

const INSTRUMENTS: { key: Instrument; name: string; blurb: string; badge?: string }[] = [
  { key: 'safe_post', name: 'Post-money SAFE', blurb: 'Investor % locked in now. Simplest & most common today.', badge: 'Most common' },
  { key: 'safe_pre',  name: 'Pre-money SAFE',  blurb: 'Older style. Investor % depends on total raised before next round.' },
  { key: 'note',      name: 'Convertible note', blurb: 'A loan that converts — adds interest + a maturity date.' },
]

// ─── Tooltip ───
function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
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

// Money field with thousands separators
function MoneyField({ label, value, onChange, tip, glossaryTerm }: {
  label: string; value: number; onChange: (n: number) => void; tip?: string; glossaryTerm?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">
        {glossaryTerm ? <TermTooltip term={glossaryTerm}>{label}</TermTooltip> : label}{tip && <Info text={tip} />}
      </label>
      <div className="flex items-center border border-border-strong rounded-md overflow-hidden focus-within:border-brand">
        <span className="px-2 text-text-tertiary text-sm bg-surface-muted border-r border-border">$</span>
        <input type="text" inputMode="numeric" value={value === 0 ? '' : fmtComma(value)}
          onChange={e => onChange(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
          placeholder="0"
          className="w-full px-2 py-1.5 text-sm focus:outline-none" />
      </div>
    </div>
  )
}

// Percent / plain number field
function NumField({ label, value, onChange, suffix, tip }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; tip?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">
        {label}{tip && <Info text={tip} />}
      </label>
      <div className="flex items-center border border-border-strong rounded-md overflow-hidden focus-within:border-brand">
        <input type="text" inputMode="decimal" value={value === 0 ? '' : String(value)}
          onChange={e => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, '')
            onChange(cleaned === '' ? 0 : parseFloat(cleaned) || 0)
          }}
          placeholder="0"
          className="w-full px-2 py-1.5 text-sm focus:outline-none" />
        {suffix && <span className="px-2 text-text-tertiary text-sm bg-surface-muted border-l border-border">{suffix}</span>}
      </div>
    </div>
  )
}

export default function SafeCalculator({ initialSaved, userStage }: { initialSaved: Saved[]; userStage?: FundingStage | null }) {
  const [inp, setInp] = useState<SafeInputs>(DEFAULTS)
  const [saved, setSaved] = useState<Saved[]>(initialSaved)
  const [showIntro, setShowIntro] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCapTable, setShowCapTable] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const [showWorst, setShowWorst] = useState(false)

  const set = (patch: Partial<SafeInputs>) => setInp(prev => ({ ...prev, ...patch }))

  const result = useMemo(() => calculateConversion(inp), [inp])
  const scenarios = useMemo(() => calculateScenarios(inp), [inp])
  const notes = useMemo(() => instrumentNotes(inp.instrument), [inp.instrument])

  async function saveScenario() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tools/safe-scenarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), instrument: inp.instrument, inputs: inp }),
      })
      const data = await res.json()
      if (res.ok && data.scenario) { setSaved([data.scenario, ...saved]); setSaveName('') }
    } finally { setSaving(false) }
  }

  async function deleteScenario(id: string) {
    const res = await fetch(`/api/tools/safe-scenarios?id=${id}`, { method: 'DELETE' })
    if (res.ok) setSaved(saved.filter(s => s.id !== id))
  }

  function loadScenario(s: Saved) { setInp({ ...DEFAULTS, ...s.inputs }); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  // Download as PDF — expands the detail sections, then uses the browser's
  // native print-to-PDF. A print stylesheet (below) hides nav/inputs.
  function downloadPDF() {
    setShowSteps(true)
    setShowWorst(true)
    // let React render the expanded sections before invoking print
    setTimeout(() => window.print(), 100)
  }

  const isNote = inp.instrument === 'note'

  return (
    <div className="max-w-5xl safe-print-root">
      <style>{`
        @media print {
          /* Hide everything outside the calculator (nav, sidebar, etc.) */
          body * { visibility: hidden !important; }
          .safe-print-root, .safe-print-root * { visibility: visible !important; }
          .safe-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; padding: 0 12px; }
          /* Hide interactive-only bits */
          .no-print { display: none !important; }
          /* Expand the input column to full width stack for a clean report */
          .safe-grid { display: block !important; }
          .safe-results > * { break-inside: avoid; }
          .print-only { display: block !important; }
          /* Force colored backgrounds to print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 14mm; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Print-only report header */}
      <div className="print-only mb-4">
        <div className="text-xl font-bold text-text-primary">RaiseSEA — SAFE / Note Analysis</div>
        <div className="text-sm text-text-tertiary">
          {inp.instrument === 'note' ? 'Convertible note' : inp.instrument === 'safe_post' ? 'Post-money SAFE' : 'Pre-money SAFE'} · ${fmtComma(inp.investment)} on ${fmtComma(inp.valuationCap)} cap · Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <hr className="my-3 border-border" />
      </div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">SAFE / Note Calculator</h1>
          <p className="text-sm text-text-tertiary mt-1">Model how your SAFE or convertible note converts — and how much of your company you give away.</p>
        </div>
        <button onClick={downloadPDF}
          className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap flex-shrink-0 no-print">
          Download PDF
        </button>
      </div>

      {/* Guide dropdown — explains all 3 instruments */}
      <div className="bg-[#f4f9f5] border border-brand/20 rounded-xl mb-5">
        <button onClick={() => setShowIntro(!showIntro)} className="w-full flex items-center justify-between p-4 text-left">
          <span className="text-sm font-semibold text-brand">📘 New to SAFEs &amp; notes? Read the 2-minute guide</span>
          <span className="text-brand">{showIntro ? '−' : '+'}</span>
        </button>
        {showIntro && (
          <div className="px-4 pb-4 text-sm text-text-secondary leading-relaxed space-y-3">
            <p>A <strong><TermTooltip term="SAFE">SAFE</TermTooltip></strong> or <strong><TermTooltip term="convertible note">convertible note</TermTooltip></strong> lets investors put money in now and get shares later — at your next priced round. You don&apos;t set a share price today. Two terms protect them: a <strong><TermTooltip term="valuation cap">valuation cap</TermTooltip></strong> (max company value used for their conversion) and a <strong>discount</strong> (they convert cheaper than new investors). The investor gets whichever gives them more shares.</p>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">1. Post-money SAFE <span className="text-[10px] uppercase bg-brand text-white px-1.5 py-0.5 rounded-full ml-1">most common</span></div>
              <p className="text-xs text-text-tertiary">The investor&apos;s % is locked the moment you sign (Investment ÷ post-money cap). Any SAFE you raise <em>after</em> dilutes you, not them. Predictable — the modern standard.</p>
            </div>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">2. Pre-money SAFE</div>
              <p className="text-xs text-text-tertiary">Older style. The cap is measured before other SAFEs are counted, so all SAFE holders dilute each other <em>and</em> you. Less predictable; the next-round option pool also hits founders.</p>
            </div>
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="font-semibold text-text-primary mb-1">3. Convertible note</div>
              <p className="text-xs text-text-tertiary">Like a SAFE but it&apos;s <em>debt</em>: it accrues interest and has a maturity date. It converts on principal + interest. If maturity hits before you raise, it can be called for repayment — so the maturity terms matter a lot.</p>
            </div>
            <p className="text-xs text-text-tertiary">Tip: hover the <span className="inline-flex w-4 h-4 rounded-full bg-surface-sunken text-text-tertiary text-[10px] font-bold items-center justify-center">i</span> icons on any field for help.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 safe-grid">
        {/* ── INPUTS ── */}
        <div className="space-y-4 safe-inputs">
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Instrument</div>
            <div className="space-y-2">
              {INSTRUMENTS.map(it => (
                <button key={it.key} onClick={() => set({ instrument: it.key })}
                  className={`w-full text-left border rounded-lg p-2.5 transition ${
                    inp.instrument === it.key ? 'border-brand bg-[#f4f9f5]' : 'border-border hover:border-border-strong'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{it.name}</span>
                    {it.badge && <span className="text-[9px] uppercase bg-brand text-white px-1.5 py-0.5 rounded-full">{it.badge}</span>}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">{it.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Your {isNote ? 'note' : 'SAFE'}</div>
            <MoneyField label="Investment amount" value={inp.investment} onChange={n => set({ investment: n })}
              tip="How much the investor is putting in now." />
            <MoneyField label="Valuation cap" value={inp.valuationCap} onChange={n => set({ valuationCap: n })}
              tip="The maximum company value used to calculate the investor's share. A lower cap means they get more of your company. Set 0 for no cap." />
            <NumField label="Discount" value={inp.discountPct} onChange={n => set({ discountPct: n })} suffix="%"
              tip="A reward for early investors — they convert this % cheaper than the next round's price. Only matters if the round prices below the cap. Set 0 for none." />
            {isNote && (
              <>
                <NumField label="Interest rate (annual)" value={inp.interestPct} onChange={n => set({ interestPct: n })} suffix="%"
                  tip="Notes are loans — interest accrues until conversion and converts to equity too." />
                <NumField label="Months to conversion" value={inp.termMonths} onChange={n => set({ termMonths: n })} suffix="mo"
                  tip="How long until the note converts. If maturity passes before a raise, the note can be called for repayment." />
              </>
            )}
          </div>

          <div className="bg-white border border-border rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Next priced round (the conversion trigger)</div>
            <MoneyField label="Next round pre-money valuation" value={inp.nextPreMoney} onChange={n => set({ nextPreMoney: n })}
              tip="Your company's value at the next round, BEFORE the new money goes in. This triggers conversion."
              glossaryTerm="Pre-money valuation" />
            <MoneyField label="New money raised in that round" value={inp.newMoneyRaised} onChange={n => set({ newMoneyRaised: n })}
              tip="How much you raise in the priced round itself (separate from the SAFE/note)." />
          </div>

          <div className="bg-white border border-border rounded-xl p-4">
            <button onClick={() => setShowCapTable(!showCapTable)} className="w-full flex items-center justify-between text-left">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Current ownership (optional)</span>
              <span className="text-text-disabled">{showCapTable ? '−' : '+'}</span>
            </button>
            {showCapTable && (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-text-tertiary">Add your current split to see the full before/after picture. Leave founders at 100% if unsure. These should add up to 100%.</p>
                <NumField label="Founder ownership" value={inp.founderPct} onChange={n => set({ founderPct: n })} suffix="%"
                  tip="What the founders own today, before this SAFE/note converts." />
                <NumField label="Option pool (ESOP)" value={inp.optionPoolPct} onChange={n => set({ optionPoolPct: n })} suffix="%"
                  tip="Shares reserved for employees, if any." />
                <NumField label="Current investors" value={inp.existingInvestorPct} onChange={n => set({ existingInvestorPct: n })} suffix="%"
                  tip="Any investors already on your cap table from earlier rounds." />
                <div className={`text-[11px] ${inp.founderPct + inp.optionPoolPct + inp.existingInvestorPct === 100 ? 'text-text-disabled' : 'text-warning-text'}`}>
                  Total: {inp.founderPct + inp.optionPoolPct + inp.existingInvestorPct}% {inp.founderPct + inp.optionPoolPct + inp.existingInvestorPct !== 100 ? '(should be 100%)' : '✓'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RESULTS ── */}
        <div className="space-y-4 safe-results">
          <div className="bg-gradient-to-br from-[#1a4d2e] to-[#143d24] text-white rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Investor ends up with</div>
            <div className="text-4xl font-bold">{result.investorOwnershipPct.toFixed(2)}%</div>
            <div className="text-sm opacity-90 mt-1">
              of your company, converting on the <strong>{result.conversionBasis === 'cap' ? 'valuation cap' : result.conversionBasis === 'discount' ? 'discount' : 'round price'}</strong>
            </div>
          </div>

          {/* Pre/post-money valuation clarity */}
          {result.impliedPreMoneyCap !== null && result.impliedPostMoneyCap !== null && (
            <div className="bg-white border border-border rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">
                Your cap, both ways
                <Info text="Post-money cap INCLUDES the SAFE/note money; pre-money cap EXCLUDES it. A post-money SAFE locks the investor's % against the post-money figure; a pre-money SAFE uses the pre-money figure, so the SAFE money sits on top." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg p-3 ${inp.instrument === 'safe_post' ? 'bg-[#f4f9f5] border border-brand/30' : 'bg-surface-muted border border-border'}`}>
                  <div className="text-[10px] uppercase tracking-wide text-text-tertiary"><TermTooltip term="Post-money valuation">Post-money cap</TermTooltip></div>
                  <div className="text-lg font-bold text-text-primary">{fmtUSD(result.impliedPostMoneyCap)}</div>
                  <div className="text-[10px] text-text-tertiary">includes the {isNote ? 'note' : 'SAFE'}</div>
                </div>
                <div className={`rounded-lg p-3 ${inp.instrument !== 'safe_post' ? 'bg-[#f4f9f5] border border-brand/30' : 'bg-surface-muted border border-border'}`}>
                  <div className="text-[10px] uppercase tracking-wide text-text-tertiary"><TermTooltip term="Pre-money valuation">Pre-money cap</TermTooltip></div>
                  <div className="text-lg font-bold text-text-primary">{fmtUSD(result.impliedPreMoneyCap)}</div>
                  <div className="text-[10px] text-text-tertiary">excludes the {isNote ? 'note' : 'SAFE'}</div>
                </div>
              </div>
              <p className="text-[11px] text-text-tertiary mt-2">
                You entered <strong>${fmtComma(inp.valuationCap)}</strong> as a {inp.instrument === 'safe_post' ? 'post-money' : 'pre-money'} cap (highlighted). The other figure is the equivalent the {inp.instrument === 'safe_post' ? 'pre-money' : 'post-money'} way — this is the core difference between pre- and post-money instruments.
              </p>
            </div>
          )}

          {/* CLN principal vs interest */}
          {isNote && result.interestAccrued > 0 && (
            <div className="bg-white border border-border rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">What converts (principal + interest)</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-text-tertiary">Principal (your investment)</span><span className="font-medium text-text-primary">${fmtComma(result.principal)}</span></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Interest accrued ({inp.interestPct}% × {(inp.termMonths / 12).toFixed(1)} yr)</span><span className="font-medium text-warning-text">+ ${fmtComma(result.interestAccrued)}</span></div>
                <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="font-semibold text-text-primary">Total converting</span><span className="font-bold text-text-primary">${fmtComma(result.principalPlusInterest)}</span></div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-900 mb-1">💡 What just happened?</div>
            <p className="text-sm text-blue-900 leading-relaxed">{result.explanation}</p>
          </div>

          {/* Calculation breakdown */}
          <div className="bg-white border border-border rounded-xl p-4">
            <button onClick={() => setShowSteps(!showSteps)} className="w-full flex items-center justify-between text-left">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">How we got {result.investorOwnershipPct.toFixed(2)}% — show the math</span>
              <span className="text-text-disabled">{showSteps ? '−' : '+'}</span>
            </button>
            {showSteps && (
              <div className="mt-3 space-y-1.5">
                {result.steps.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm gap-3">
                    <span className="text-text-tertiary">{s.label}</span>
                    <span className="font-medium text-text-primary text-right whitespace-nowrap">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Before vs after with dilution */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Before vs after conversion</div>
            <DilutionBar result={result} />
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
                  <CompareRow label="Founders" color="#1a4d2e" before={result.before.founder} after={result.founderOwnershipPct} delta={-result.dilution.founder} />
                  {(result.before.pool > 0.01 || result.optionPoolOwnershipPct > 0.01) &&
                    <CompareRow label="Option pool" color="#9ca3af" before={result.before.pool} after={result.optionPoolOwnershipPct} delta={-result.dilution.pool} />}
                  {(result.before.existingInvestor > 0.01 || result.existingInvestorOwnershipPct > 0.01) &&
                    <CompareRow label="Current investors" color="#7c3aed" before={result.before.existingInvestor} after={result.existingInvestorOwnershipPct} delta={-result.dilution.existingInvestor} />}
                  <CompareRow label={isNote ? 'Note investor' : 'SAFE investor'} color="#d97706" before={0} after={result.investorOwnershipPct} delta={result.investorOwnershipPct} isNew />
                  <CompareRow label="New round investor" color="#2563eb" before={0} after={result.newInvestorOwnershipPct} delta={result.newInvestorOwnershipPct} isNew />
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-text-tertiary mt-2">Your founder stake drops by <strong>{result.dilution.founder.toFixed(2)} percentage points</strong> from this {isNote ? 'note' : 'SAFE'} + the new round.</p>
          </div>

          {/* SEA-benchmarked dilution insight */}
          <DilutionInsight
            dilutionPct={result.dilution.founder}
            raiseUsd={inp.newMoneyRaised + inp.investment}
            stage={userStage}
            fromUserDeck={!!userStage}
          />

          {/* Scenario comparison incl. worst case */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-1">Scenario analysis</div>
            <p className="text-[11px] text-text-tertiary mb-3">Same terms, different next-round outcomes — including a down round.</p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-[10px] uppercase text-text-disabled text-left">
                    <th className="pb-1.5 font-medium">Scenario</th>
                    <th className="pb-1.5 font-medium">Pre-money</th>
                    <th className="pb-1.5 font-medium">Converts on</th>
                    <th className="pb-1.5 font-medium text-right">Investor %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scenarios.map(s => (
                    <tr key={s.label} className={s.isWorstCase ? 'bg-danger-bg' : ''}>
                      <td className="py-1.5">
                        <div className={`${s.isWorstCase ? 'text-danger-text font-semibold' : 'text-text-secondary'}`}>{s.isWorstCase ? '⚠ ' : ''}{s.label}</div>
                        <div className="text-[10px] text-text-disabled">{s.sublabel}</div>
                      </td>
                      <td className="py-1.5 text-text-secondary">{fmtUSD(s.nextPreMoney)}</td>
                      <td className="py-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.basis === 'cap' ? 'bg-warning-bg text-warning-text' : s.basis === 'discount' ? 'bg-blue-100 text-blue-700' : 'bg-surface-muted text-text-tertiary'}`}>{s.basis === 'none' ? 'round price' : s.basis}</span></td>
                      <td className="py-1.5 text-right font-semibold text-text-primary">{s.investorPct.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-text-tertiary mt-2">💡 Above the cap, the investor&apos;s % stays put no matter how high the round (that&apos;s the cap working for you). In a <strong>down round below the cap</strong>, the discount kicks in and they take a bigger slice — see the worst case.</p>
          </div>

          {/* Save */}
          <div className="bg-white border border-border rounded-xl p-4 no-print">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Save this scenario</div>
            <div className="flex gap-2">
              <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. Seed round — $8M cap"
                className="flex-1 text-sm border border-border-strong rounded-md px-2 py-1.5 focus:outline-none focus:border-brand" />
              <button onClick={saveScenario} disabled={saving || !saveName.trim()}
                className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-3 py-1.5 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instrument deep-dive incl. worst case mechanics */}
      <div className="mt-6 bg-white border border-border rounded-xl p-4">
        <button onClick={() => setShowWorst(!showWorst)} className="w-full flex items-center justify-between text-left">
          <span className="text-sm font-semibold text-text-primary">📋 {notes.title}: how it works &amp; the worst case</span>
          <span className="text-text-disabled">{showWorst ? '−' : '+'}</span>
        </button>
        {showWorst && (
          <div className="mt-3 space-y-3">
            <ul className="space-y-1.5">
              {notes.points.map((p, i) => (
                <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-brand">•</span><span>{p}</span></li>
              ))}
            </ul>
            <div className="bg-danger-bg border border-danger-border rounded-lg p-3">
              <div className="text-xs font-semibold text-danger-text mb-1">⚠ Worst case</div>
              <p className="text-sm text-red-900 leading-relaxed">{notes.worstCase}</p>
            </div>
          </div>
        )}
      </div>

      {/* Saved scenarios */}
      {saved.length > 0 && (
        <div className="mt-6 no-print">
          <h2 className="text-sm font-semibold text-text-primary mb-2">My saved scenarios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {saved.map(s => (
              <div key={s.id} className="bg-white border border-border rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{s.name}</div>
                  <div className="text-[11px] text-text-tertiary">
                    {s.instrument === 'note' ? 'Convertible note' : s.instrument === 'safe_post' ? 'Post-money SAFE' : 'Pre-money SAFE'} · ${fmtComma(s.inputs.investment)} @ ${fmtComma(s.inputs.valuationCap)} cap
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => loadScenario(s)} className="text-xs text-brand hover:underline">Load</button>
                  <button onClick={() => deleteScenario(s.id)} className="text-xs text-danger-text hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-disabled text-center mt-8 max-w-2xl mx-auto">
        This calculator is for planning and education only — not legal or financial advice. Conversion mechanics vary by contract; always confirm exact terms with your lawyer before signing.
      </p>
    </div>
  )
}

function CompareRow({ label, color, before, after, delta, isNew }: {
  label: string; color: string; before: number; after: number; delta: number; isNew?: boolean
}) {
  return (
    <tr>
      <td className="py-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: color }} />
        <span className="text-text-secondary">{label}</span>
      </td>
      <td className="py-1.5 text-right text-text-tertiary">{before > 0.01 ? before.toFixed(2) + '%' : '—'}</td>
      <td className="py-1.5 text-right font-semibold text-text-primary">{after.toFixed(2)}%</td>
      <td className={`py-1.5 text-right text-xs font-medium ${isNew ? 'text-success-text' : delta < -0.01 ? 'text-danger-text' : 'text-text-disabled'}`}>
        {isNew ? `+${after.toFixed(2)}` : delta < -0.01 ? delta.toFixed(2) : '0.00'}
      </td>
    </tr>
  )
}

function DilutionBar({ result }: { result: ReturnType<typeof calculateConversion> }) {
  const segs = [
    { pct: result.founderOwnershipPct, color: '#1a4d2e' },
    { pct: result.optionPoolOwnershipPct, color: '#9ca3af' },
    { pct: result.existingInvestorOwnershipPct, color: '#7c3aed' },
    { pct: result.investorOwnershipPct, color: '#d97706' },
    { pct: result.newInvestorOwnershipPct, color: '#2563eb' },
  ].filter(s => s.pct > 0.01)
  return (
    <div className="flex h-6 rounded-full overflow-hidden">
      {segs.map((s, i) => (
        <div key={i} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.pct.toFixed(1)}%`} />
      ))}
    </div>
  )
}
