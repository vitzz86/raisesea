// ═══════════════════════════════════════════════════════════════
// app/tools/calculator/Calculator.tsx
//
// Tabbed calculator wrapper. Three tabs:
//   • Equity      — priced round modeling
//   • Debt        — loan amortization
//   • Convertible — SAFE/Note (existing calculator from chunk 12.7)
//
// Tab state lives in URL (?tab=equity|debt|convertible) so users
// can share/bookmark specific tabs.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { TrendingUp, Banknote, Repeat } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FundingStage } from '@/components/calculator/DilutionInsight'
import EquityTab from './EquityTab'
import DebtTab from './DebtTab'
import SafeCalculator from '@/app/tools/safe-calculator/SafeCalculator'

type TabKey = 'equity' | 'debt' | 'convertible'

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; description: string }[] = [
  { key: 'equity',      label: 'Equity',      icon: TrendingUp, description: 'Priced rounds — Series A and up' },
  { key: 'debt',        label: 'Debt',        icon: Banknote,   description: 'Loans with monthly repayment' },
  { key: 'convertible', label: 'Convertible', icon: Repeat,     description: 'SAFE notes and convertible notes' },
]

interface CalculatorProps {
  initialSaved: Array<{ id: string; name: string; instrument: string; inputs: unknown; created_at: string }>
  userStage:    FundingStage | null
}

export default function Calculator({ initialSaved, userStage }: CalculatorProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const initialTab   = (searchParams.get('tab') as TabKey) || 'equity'
  const [activeTab, setActiveTab] = useState<TabKey>(
    ['equity', 'debt', 'convertible'].includes(initialTab) ? initialTab : 'equity'
  )

  // Sync URL when tab changes (shallow — no scroll)
  useEffect(() => {
    const current = searchParams.get('tab')
    if (current !== activeTab) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', activeTab)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [activeTab, pathname, router, searchParams])

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Calculator</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Model the math before you sign. Equity dilution, debt repayment, SAFE/note conversion.
        </p>
      </div>

      {/* Tab strip — horizontal scroll on mobile if needed, with hidden description to save space */}
      <div className="bg-surface-card border border-border rounded-xl p-1 mb-6 overflow-x-auto scrollbar-hide">
        <div className="inline-flex gap-1 min-w-full">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'group inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all flex-1 sm:flex-initial justify-center sm:justify-start whitespace-nowrap',
                  isActive
                    ? 'bg-brand text-text-inverse shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <div className="text-left">
                  <div className="text-sm font-medium leading-tight">{tab.label}</div>
                  {/* Description hidden on mobile to save width — label alone is clear enough */}
                  <div className={cn('hidden sm:block text-[10px] mt-0.5 leading-tight', isActive ? 'text-white/80' : 'opacity-70')}>{tab.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'equity'      && <EquityTab userStage={userStage} initialSaved={initialSaved as Parameters<typeof EquityTab>[0]['initialSaved']} />}
        {activeTab === 'debt'        && <DebtTab initialSaved={initialSaved as Parameters<typeof DebtTab>[0]['initialSaved']} />}
        {activeTab === 'convertible' && (
          <SafeCalculator
            initialSaved={initialSaved as Parameters<typeof SafeCalculator>[0]['initialSaved']}
            userStage={userStage}
          />
        )}
      </div>
    </div>
  )
}
