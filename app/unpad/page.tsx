import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  KanbanSquare,
  Megaphone,
  MessageSquareText,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react'
import { CoreToolsBand, UnpadShell, WorkspaceButton } from './UnpadShell'
import { announcements, insights, statusColumns, type StartupStatus } from './data'
import { average, fetchUnpadStartups } from './incubator'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unpad Incubator Workspace — RaiseSEA',
  description: 'Institution dashboard for monitoring Unpad startup applicants, cohort progress, mentor feedback, and RaiseSEA tools.',
}

const statusTone: Record<StartupStatus, string> = {
  Applied: 'bg-[#eef2f7] text-[#31506f] border-[#cfdae8]',
  Screening: 'bg-[#fff7e6] text-[#8a5a09] border-[#f1d48a]',
  Accepted: 'bg-[#edf7ee] text-[#1f6b3b] border-[#badfc1]',
  Incubating: 'bg-[#eef6ff] text-[#215d8f] border-[#bdd7ee]',
  'Demo Day Ready': 'bg-[#f7f1ff] text-[#6540a0] border-[#dcc9ff]',
  Alumni: 'bg-[#f1f4ef] text-[#58635a] border-[#d8dfd4]',
}

function riskTone(risk: string) {
  if (risk === 'High') return 'bg-[#fee2e2] text-[#991b1b]'
  if (risk === 'Medium') return 'bg-[#fff3cf] text-[#7a5200]'
  return 'bg-[#e7f6ea] text-[#1c6a39]'
}

function ScoreBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'blue' | 'gold' }) {
  const colors = {
    green: 'bg-[#1a4d2e]',
    blue: 'bg-[#1d5f91]',
    gold: 'bg-[#d8a640]',
  }
  return (
    <div className="h-2 rounded-full bg-[#e8ede6] overflow-hidden">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export default async function UnpadDashboardPage() {
  const { startups, schemaReady, error } = await fetchUnpadStartups()
  const activeStartups = startups.filter(s => ['Accepted', 'Incubating', 'Demo Day Ready'].includes(s.status)).length
  const avgProgress = average(startups.map(s => s.progressScore))
  const avgDeck = average(startups.map(s => s.deckScore).filter((score): score is number => score != null))
  const pendingReviews = startups.filter(s => s.risk !== 'Low' || s.status === 'Screening').length
  const recentActivity = startups
    .filter(startup => startup.latestVersion > 0)
    .slice(0, 4)
    .map(startup => ({
      icon: FileText,
      text: `${startup.name} added Deck v${startup.latestVersion}${startup.latestDelta == null ? '' : ` (${startup.latestDelta >= 0 ? '+' : ''}${startup.latestDelta} pts)`}.`,
      time: startup.lastActivity,
    }))

  return (
    <UnpadShell
      active="dashboard"
      title="Unpad Incubator Dashboard"
      subtitle="Monitor applicants, cohort progress, mentor feedback, and founder readiness while keeping the full RaiseSEA founder toolkit available."
      actions={
        <>
          <WorkspaceButton href="/unpad/announcements" variant="secondary">
            <Megaphone className="w-4 h-4" strokeWidth={1.75} />
            New announcement
          </WorkspaceButton>
          <WorkspaceButton href="/unpad/upload">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Add deck
          </WorkspaceButton>
        </>
      }
    >
      {!schemaReady && (
        <div className="mb-5 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#991b1b]">
          Run `supabase/migrations/v22_incubator_unpad_workspace.sql` in Supabase before using the real Unpad workspace. {error ? `Current error: ${error}` : ''}
        </div>
      )}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<Users className="w-4 h-4" strokeWidth={1.75} />} label="Active startups" value={activeStartups.toString()} detail={`${startups.length} total in Batch A`} />
        <MetricCard icon={<TrendingUp className="w-4 h-4" strokeWidth={1.75} />} label="Avg progress score" value={`${avgProgress}/100`} detail="+9 points across latest deck uploads" accent="blue" />
        <MetricCard icon={<FileText className="w-4 h-4" strokeWidth={1.75} />} label="Avg deck score" value={`${avgDeck}/100`} detail="AI score from latest deck version" accent="gold" />
        <MetricCard icon={<Clock3 className="w-4 h-4" strokeWidth={1.75} />} label="Needs review" value={pendingReviews.toString()} detail="Screening or mentor-risk flagged" accent="red" />
      </section>

      <section className="mt-8 grid xl:grid-cols-[1.5fr_.8fr] gap-5">
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a] flex items-center gap-1.5">
                <KanbanSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cohort Kanban
              </div>
              <h2 className="text-base font-semibold text-[#102033] mt-1">Applicant and incubation stages</h2>
            </div>
            <Link href="#startups" className="text-xs font-medium text-[#365141] hover:text-[#1a4d2e] inline-flex items-center gap-1">
              View table
              <ArrowRight className="w-3 h-3" strokeWidth={2} />
            </Link>
          </div>

          {startups.length === 0 ? (
            <div className="bg-white border border-dashed border-[#d9dfd2] rounded-lg p-8 text-center">
              <FileText className="w-8 h-8 text-[#9aa69b] mx-auto" strokeWidth={1.75} />
              <h2 className="text-base font-semibold text-[#102033] mt-3">No Unpad startups yet</h2>
              <p className="text-sm text-[#687468] mt-2 max-w-md mx-auto">
                Add the first startup deck through the operator upload flow. The dashboard will populate from real Supabase records after analysis finishes.
              </p>
              <Link href="/unpad/upload" className="mt-4 h-9 inline-flex items-center justify-center gap-2 rounded-md bg-[#1a4d2e] text-white px-4 text-sm font-medium hover:bg-[#153f26]">
                Add first deck
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
              {statusColumns.map(status => {
              const columnStartups = startups.filter(startup => startup.status === status)
              return (
                <div key={status} className="bg-white border border-[#d9dfd2] rounded-lg min-h-[220px]">
                  <div className="px-3 py-2.5 border-b border-[#edf0ea]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#102033]">{status}</div>
                      <span className="text-[10px] font-semibold rounded-full bg-[#f3f5f1] text-[#687468] px-1.5 py-0.5">{columnStartups.length}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
                    {columnStartups.length === 0 ? (
                      <div className="h-20 rounded-md border border-dashed border-[#d9dfd2] text-[11px] text-[#96a096] flex items-center justify-center">
                        Empty
                      </div>
                    ) : (
                      columnStartups.map(startup => (
                        <Link
                          key={startup.id}
                          href={`/unpad/startups/${startup.id}`}
                          className="block rounded-md border border-[#e3e8df] bg-[#fbfcfa] p-2 hover:border-[#1a4d2e]/40 transition-colors"
                        >
                          <div className="text-xs font-semibold text-[#102033] leading-snug">{startup.name}</div>
                          <div className="text-[10px] text-[#687468] mt-0.5 truncate">{startup.faculty}</div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#687468]">Progress</span>
                            <span className="text-[11px] font-semibold text-[#102033]">{startup.progressScore}</span>
                          </div>
                          <ScoreBar value={startup.progressScore} />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )
              })}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <Panel title="Recent mentor activity" icon={<MessageSquareText className="w-4 h-4" strokeWidth={1.75} />}>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#d9dfd2] p-4 text-xs text-[#687468] text-center">
                  No deck activity yet.
                </div>
              ) : recentActivity.map(item => {
                const Icon = item.icon
                return (
                  <div key={item.text} className="flex gap-3">
                    <div className="w-8 h-8 rounded-md bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[#102033] leading-relaxed">{item.text}</p>
                      <div className="text-[10px] text-[#879184] mt-0.5">{item.time}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title="Announcements" icon={<Megaphone className="w-4 h-4" strokeWidth={1.75} />} href="/unpad/announcements">
            <div className="space-y-3">
              {announcements.slice(0, 2).map(item => (
                <div key={item.id} className="border-b border-[#edf0ea] last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold rounded bg-[#fff3cf] text-[#7a5200] px-1.5 py-0.5">{item.status}</span>
                    <span className="text-[10px] text-[#879184]">{item.date}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#102033]">{item.title}</div>
                  <p className="text-[11px] text-[#687468] leading-relaxed mt-1">{item.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>

      <section id="startups" className="mt-10">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a]">Startup tracker</div>
            <h2 className="text-base font-semibold text-[#102033] mt-1">Cohort progress table</h2>
          </div>
          <div className="text-xs text-[#687468]">Sorted by latest activity</div>
        </div>

        <div className="bg-white border border-[#d9dfd2] rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead className="bg-[#f3f5f1] text-[#687468]">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Startup</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Progress</th>
                <th className="text-left font-semibold px-4 py-3">Deck</th>
                <th className="text-left font-semibold px-4 py-3">Mentor</th>
                <th className="text-left font-semibold px-4 py-3">Next milestone</th>
                <th className="text-left font-semibold px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ea]">
              {startups.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[#687468]" colSpan={7}>
                    No startup submissions yet. Use the Unpad deck upload flow to create the first record.
                  </td>
                </tr>
              ) : startups.map(startup => (
                <tr key={startup.id} className="hover:bg-[#fbfcfa]">
                  <td className="px-4 py-3">
                    <Link href={`/unpad/startups/${startup.id}`} className="font-semibold text-[#102033] hover:text-[#1a4d2e]">{startup.name}</Link>
                    <div className="text-xs text-[#687468] mt-0.5">{startup.founder} · {startup.faculty}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex border rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[startup.status]}`}>{startup.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ScoreBar value={startup.progressScore} /></div>
                      <span className="text-xs font-semibold text-[#102033]">{startup.progressScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-[#102033]">{startup.deckScore != null ? `${startup.deckScore}/100` : 'No deck yet'}</div>
                    <div className="text-[11px] text-[#1d5a3a]">
                      {startup.latestDelta == null ? 'baseline pending' : `${startup.latestDelta >= 0 ? '+' : ''}${startup.latestDelta} since previous`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#687468]">{startup.mentor}</td>
                  <td className="px-4 py-3 text-xs text-[#102033] max-w-[240px]">{startup.nextMilestone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${riskTone(startup.risk)}`}>{startup.risk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 grid lg:grid-cols-3 gap-5">
        <Panel title="Latest insights" icon={<FileText className="w-4 h-4" strokeWidth={1.75} />} href="/unpad/insights" className="lg:col-span-2">
          <div className="grid sm:grid-cols-3 gap-3">
            {insights.map(item => (
              <Link key={item.id} href="/unpad/insights" className="border border-[#e3e8df] rounded-lg p-3 hover:border-[#1a4d2e]/40 transition-colors">
                <div className="text-[10px] text-[#879184] mb-2">{item.type} · {item.publishedAt}</div>
                <div className="text-sm font-semibold text-[#102033] leading-snug">{item.title}</div>
                <p className="text-[11px] text-[#687468] leading-relaxed mt-2">{item.summary}</p>
                <div className="mt-3 flex items-center gap-2">
                  <ScoreBar value={item.readRate} tone="gold" />
                  <span className="text-[10px] text-[#687468] shrink-0">{item.readRate}% read</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="This week" icon={<CalendarDays className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="space-y-3">
            {(startups.length > 0
              ? startups.slice(0, 4).map(startup => [startup.lastActivity, startup.nextMilestone, startup.name])
              : [['Now', 'Upload the first startup deck', 'Unpad operator']]
            ).map(([date, title, owner]) => (
              <div key={title} className="flex gap-3">
                <div className="w-12 text-[11px] font-semibold text-[#1d5a3a] shrink-0">{date}</div>
                <div>
                  <div className="text-xs font-semibold text-[#102033]">{title}</div>
                  <div className="text-[11px] text-[#687468]">{owner}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <CoreToolsBand />
    </UnpadShell>
  )
}

function MetricCard({ icon, label, value, detail, accent = 'green' }: {
  icon: ReactNode
  label: string
  value: string
  detail: string
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
      <div className="flex items-center justify-between gap-3">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${accentClasses[accent]}`}>{icon}</div>
        <CheckCircle2 className="w-4 h-4 text-[#9ba69b]" strokeWidth={1.75} />
      </div>
      <div className="text-2xl font-semibold text-[#102033] mt-4">{value}</div>
      <div className="text-xs font-semibold text-[#102033] mt-1">{label}</div>
      <div className="text-[11px] text-[#687468] mt-1">{detail}</div>
    </div>
  )
}

function Panel({ title, icon, children, href, className = '' }: {
  title: string
  icon: ReactNode
  children: ReactNode
  href?: string
  className?: string
}) {
  return (
    <div className={`bg-white border border-[#d9dfd2] rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center">{icon}</div>
          <h2 className="text-sm font-semibold text-[#102033]">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="text-xs text-[#365141] hover:text-[#1a4d2e] inline-flex items-center gap-1">
            Open
            <ArrowRight className="w-3 h-3" strokeWidth={2} />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}
