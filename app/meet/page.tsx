// app/meet/page.tsx
// Phase 4 — ADP List style browse page
// Profiles include: VCs, Angels, Industry experts, Tech experts,
// Startup advisors, Mentors, Corporate innovation leads
import Link from 'next/link'
export default function MeetPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">Meet experts</h1>
          <p className="text-gray-500 max-w-xl mx-auto">Request 30-minute meetings with investors, industry experts, tech advisors, and mentors across Southeast Asia.</p>
          <Link href="/meet/register" className="mt-4 inline-block text-sm text-[#1a4d2e] border border-[#1a4d2e] px-4 py-2 rounded-lg hover:bg-[#1a4d2e] hover:text-white transition-colors">List yourself as an expert →</Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400">Profiles coming soon — Phase 4</p>
          <p className="text-gray-300 text-sm mt-1">Investors, industry experts, tech experts, advisors, mentors, corporate innovation leads</p>
        </div>
      </div>
    </div>
  )
}
