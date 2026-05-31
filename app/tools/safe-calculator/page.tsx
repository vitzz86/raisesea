// ═══════════════════════════════════════════════════════════════
// app/tools/safe-calculator/page.tsx
//
// Legacy redirect — the SAFE calculator was unified into a tabbed
// "Calculator" route in chunk 12.7.5. Anyone hitting the old URL
// lands on the Convertible tab, which has the same UI as before.
// ═══════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'

export default function LegacySafeCalculatorRedirect() {
  redirect('/tools/calculator?tab=convertible')
}
