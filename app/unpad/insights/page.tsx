import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  Megaphone,
  PenLine,
  Plus,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react'
import { CoreToolsBand, UnpadShell, WorkspaceButton } from '../UnpadShell'
import { average, insights, startups } from '../data'

export const metadata: Metadata = {
  title: 'Unpad Insights — RaiseSEA',
  description: 'Unpad admin content hub for cohort materials, founder resources, and startup development insights.',
}

export default function UnpadInsightsPage() {
  const avgReadRate = average(insights.map(item => item.readRate))
  const lowReadInsight = insights.reduce((lowest, item) => item.readRate < lowest.readRate ? item : lowest, insights[0])
  const researchStartups = startups.filter(startup => ['Biotech', 'Deep Tech', 'Healthtech'].includes(startup.sector)).length

  return (
    <UnpadShell
      active="insights"
      title="Insights and Materials"
      subtitle="Publish incubator materials, commercialization notes, workshop recaps, and internal news for each startup cohort."
      actions={
        <>
          <WorkspaceButton href="/news" variant="secondary">
            <BookOpen className="w-4 h-4" strokeWidth={1.75} />
            SEA news
          </WorkspaceButton>
          <WorkspaceButton href="#composer">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            New material
          </WorkspaceButton>
        </>
      }
    >
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<FileText className="w-4 h-4" strokeWidth={1.75} />} label="Published materials" value={insights.length.toString()} detail="Templates, notes, and primers" />
        <MetricCard icon={<TrendingUp className="w-4 h-4" strokeWidth={1.75} />} label="Average read rate" value={`${avgReadRate}%`} detail="Across Batch A founders" accent="blue" />
        <MetricCard icon={<Users className="w-4 h-4" strokeWidth={1.75} />} label="Research-heavy teams" value={researchStartups.toString()} detail="Need IP and commercialization content" accent="gold" />
        <MetricCard icon={<Megaphone className="w-4 h-4" strokeWidth={1.75} />} label="Needs reminder" value={lowReadInsight.title} detail={`${lowReadInsight.readRate}% read rate`} compact accent="red" />
      </section>

      <section className="mt-8 grid lg:grid-cols-[1.25fr_.8fr] gap-5">
        <div className="bg-white border border-[#d9dfd2] rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a]">Content library</div>
              <h2 className="text-base font-semibold text-[#102033] mt-1">Founder-facing materials</h2>
            </div>
            <Link href="#composer" className="text-xs font-medium text-[#365141] hover:text-[#1a4d2e] inline-flex items-center gap-1">
              Draft material
              <ArrowRight className="w-3 h-3" strokeWidth={2} />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {insights.map(item => (
              <article key={item.id} className="border border-[#e3e8df] rounded-lg p-4 bg-[#fbfcfa]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold rounded bg-[#eef4ef] text-[#1a4d2e] px-1.5 py-0.5">{item.type}</span>
                  <span className="text-[10px] text-[#879184]">{item.publishedAt}</span>
                </div>
                <h3 className="text-base font-semibold text-[#102033] mt-4 leading-snug">{item.title}</h3>
                <p className="text-xs text-[#687468] leading-relaxed mt-2">{item.summary}</p>
                <div className="text-[11px] text-[#425246] mt-4">Audience: {item.audience}</div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={item.readRate} />
                  <span className="text-[11px] font-semibold text-[#102033] shrink-0">{item.readRate}%</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link href="/unpad/announcements" className="h-8 inline-flex items-center gap-1.5 rounded-md bg-[#102f4f] text-white px-3 text-xs font-medium hover:bg-[#0d2741]">
                    <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Share
                  </Link>
                  <Link href="#composer" className="h-8 inline-flex items-center gap-1.5 rounded-md border border-[#cfd9cf] px-3 text-xs font-medium text-[#102033] hover:border-[#94a394]">
                    <PenLine className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside id="composer" className="bg-[#102f4f] text-white rounded-lg p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Admin publishing</div>
          <h2 className="text-lg font-semibold mt-2">New material draft</h2>
          <div className="mt-5 space-y-3">
            {[
              ['Title', 'Investor Question Bank: Demo Day Edition'],
              ['Audience', 'Demo Day Ready and Incubating startups'],
              ['Content type', 'Workshop notes'],
              ['Schedule', 'Send Monday 09:00 to founder dashboards'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-white/15 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
                <div className="text-sm font-medium mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="/unpad/announcements" className="h-9 inline-flex items-center justify-center gap-2 rounded-md bg-[#d8a640] text-[#102f4f] px-3 text-sm font-semibold hover:bg-[#e4b956]">
              <Send className="w-4 h-4" strokeWidth={1.75} />
              Publish
            </Link>
            <Link href="/unpad" className="h-9 inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium text-white hover:bg-white/10">
              Save draft
            </Link>
          </div>
        </aside>
      </section>

      <section className="mt-8 grid lg:grid-cols-3 gap-5">
        {[
          {
            icon: CalendarClock,
            title: 'Commercialization runway',
            body: 'Sequence market validation, IP checks, buyer discovery, and demo day readiness into a visible founder path.',
          },
          {
            icon: Users,
            title: 'Mentor signal loop',
            body: 'Use mentor annotations to decide which materials should be sent to each startup segment next week.',
          },
          {
            icon: CheckCircle2,
            title: 'Progress-linked learning',
            body: 'Connect materials to startup milestones so leaders can see who reads, applies, and improves after each upload.',
          },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.title} className="bg-white border border-[#d9dfd2] rounded-lg p-5">
              <div className="w-9 h-9 rounded-md bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center">
                <Icon className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-semibold text-[#102033] mt-4">{item.title}</h2>
              <p className="text-xs text-[#687468] leading-relaxed mt-2">{item.body}</p>
            </div>
          )
        })}
      </section>

      <CoreToolsBand />
    </UnpadShell>
  )
}

function MetricCard({ icon, label, value, detail, compact = false, accent = 'green' }: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  compact?: boolean
  accent?: 'green' | 'blue' | 'gold' | 'red'
}) {
  const accentClasses = {
    green: 'bg-[#eef4ef] text-[#1a4d2e]',
    blue: 'bg-[#eef6ff] text-[#1d5f91]',
    gold: 'bg-[#fff5d8] text-[#8a5a09]',
    red: 'bg-[#fee2e2] text-[#991b1b]',
  }

  return (
    <div className="bg-white border border-[#d9dfd2] rounded-lg p-4">
      <div className={`w-9 h-9 rounded-md flex items-center justify-center ${accentClasses[accent]}`}>{icon}</div>
      <div className={`${compact ? 'text-base leading-tight' : 'text-2xl'} font-semibold text-[#102033] mt-4`}>{value}</div>
      <div className="text-xs font-semibold text-[#102033] mt-1">{label}</div>
      <div className="text-[11px] text-[#687468] mt-1">{detail}</div>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-[#e8ede6] overflow-hidden flex-1">
      <div className="h-full rounded-full bg-[#d8a640]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
