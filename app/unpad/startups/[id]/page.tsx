import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock3,
  FileText,
  MessageSquareText,
  Mic,
  PencilLine,
  Presentation,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { CoreToolsBand, UnpadShell, WorkspaceButton } from '../../UnpadShell'
import { getStartup, startups, type MilestoneStatus, type StartupStatus } from '../../data'

type StartupPageProps = {
  params: Promise<{ id: string }>
}

const statusTone: Record<StartupStatus, string> = {
  Applied: 'bg-[#eef2f7] text-[#31506f] border-[#cfdae8]',
  Screening: 'bg-[#fff7e6] text-[#8a5a09] border-[#f1d48a]',
  Accepted: 'bg-[#edf7ee] text-[#1f6b3b] border-[#badfc1]',
  Incubating: 'bg-[#eef6ff] text-[#215d8f] border-[#bdd7ee]',
  'Demo Day Ready': 'bg-[#f7f1ff] text-[#6540a0] border-[#dcc9ff]',
  Alumni: 'bg-[#f1f4ef] text-[#58635a] border-[#d8dfd4]',
}

const milestoneTone: Record<MilestoneStatus, string> = {
  done: 'bg-[#e7f6ea] text-[#1c6a39]',
  active: 'bg-[#fff3cf] text-[#7a5200]',
  blocked: 'bg-[#fee2e2] text-[#991b1b]',
  todo: 'bg-[#eef2f7] text-[#31506f]',
}

export function generateStaticParams() {
  return startups.map(startup => ({ id: startup.id }))
}

export async function generateMetadata({ params }: StartupPageProps): Promise<Metadata> {
  const { id } = await params
  const startup = getStartup(id)

  return {
    title: startup ? `${startup.name} Progress — Unpad x RaiseSEA` : 'Startup Progress — Unpad x RaiseSEA',
    description: startup
      ? `Progress workspace for ${startup.name}, including deck score history, mentor annotations, and milestones.`
      : 'Unpad startup progress workspace.',
  }
}

export default async function UnpadStartupPage({ params }: StartupPageProps) {
  const { id } = await params
  const startup = getStartup(id)
  if (!startup) notFound()

  const deckDelta = startup.deckScore - startup.previousDeckScore

  return (
    <UnpadShell
      active="dashboard"
      eyebrow={`${startup.cohort} / ${startup.status}`}
      title={startup.name}
      subtitle={startup.oneLiner}
      actions={
        <>
          <WorkspaceButton href="/unpad" variant="secondary">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            Dashboard
          </WorkspaceButton>
          <WorkspaceButton href="/mock-pitch">
            <Mic className="w-4 h-4" strokeWidth={1.75} />
            Start mock pitch
          </WorkspaceButton>
        </>
      }
    >
      <section className="grid lg:grid-cols-[1.35fr_.75fr] gap-5">
        <div className="bg-white border border-[#d9dfd2] rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex border rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[startup.status]}`}>{startup.status}</span>
                <span className="text-xs text-[#687468]">{startup.stage} · {startup.sector} · {startup.faculty}</span>
              </div>
              <h2 className="text-xl font-semibold text-[#102033] mt-4">Progress score {startup.progressScore}/100</h2>
              <p className="text-sm text-[#687468] leading-relaxed mt-2 max-w-2xl">
                Latest deck upload and mentor review show the team is moving toward {startup.nextMilestone.toLowerCase()}.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#687468]">Assigned mentor</div>
              <div className="text-sm font-semibold text-[#102033] mt-1">{startup.mentor}</div>
              <div className="text-[11px] text-[#687468] mt-1">Last activity {startup.lastActivity}</div>
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            <ScoreCard
              icon={<TrendingUp className="w-4 h-4" strokeWidth={1.75} />}
              label="Cohort progress"
              value={`${startup.progressScore}/100`}
              detail={`${startup.milestoneCompletion}% milestone completion`}
              valueNumber={startup.progressScore}
            />
            <ScoreCard
              icon={<FileText className="w-4 h-4" strokeWidth={1.75} />}
              label="Latest deck score"
              value={`${startup.deckScore}/100`}
              detail={`${deckDelta >= 0 ? '+' : ''}${deckDelta} from prior deck`}
              valueNumber={startup.deckScore}
              tone="gold"
            />
            <ScoreCard
              icon={<Target className="w-4 h-4" strokeWidth={1.75} />}
              label="Next milestone"
              value={startup.risk}
              detail={startup.nextMilestone}
              valueNumber={startup.risk === 'Low' ? 82 : startup.risk === 'Medium' ? 54 : 28}
              tone={startup.risk === 'Low' ? 'green' : startup.risk === 'Medium' ? 'gold' : 'red'}
            />
          </div>
        </div>

        <aside className="bg-[#102f4f] text-white rounded-lg p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Leader actions</div>
          <h2 className="text-lg font-semibold mt-2">Move this startup forward</h2>
          <div className="mt-5 space-y-2">
            {[
              ['Request new deck version', 'Ask founder to upload through deck analysis.'],
              ['Assign mentor annotation', 'Leave slide-specific comments for the next review.'],
              ['Schedule pitch drill', 'Send the team into mock pitch practice.'],
            ].map(([title, description]) => (
              <Link
                key={title}
                href={title.includes('pitch') ? '/mock-pitch' : title.includes('deck') ? '/apply' : '#mentor-notes'}
                className="block rounded-md border border-white/15 bg-white/5 p-3 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{title}</div>
                  <ArrowRight className="w-4 h-4 text-white/70" strokeWidth={1.75} />
                </div>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">{description}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-8 grid lg:grid-cols-[1fr_.85fr] gap-5">
        <Panel title="Deck versions over time" icon={<Presentation className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="space-y-3">
            {startup.deckVersions.map((deck, index) => (
              <div key={deck.version} className="border border-[#e3e8df] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#102033]">{deck.version}</div>
                    <div className="text-xs text-[#687468] mt-1">{deck.uploadedAt} · Focus: {deck.focus}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-[#102033]">{deck.score}</div>
                    <div className="text-[11px] text-[#687468]">deck score</div>
                  </div>
                </div>
                <p className="text-sm text-[#425246] leading-relaxed mt-3">{deck.summary}</p>
                <div className="mt-4 flex items-center gap-3">
                  <ScoreBar value={deck.score} tone={index === 0 ? 'green' : 'blue'} />
                  <span className="text-xs text-[#687468] shrink-0">
                    {deck.previousScore ? `${deck.score - deck.previousScore >= 0 ? '+' : ''}${deck.score - deck.previousScore}` : 'baseline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel id="mentor-notes" title="Mentor annotations" icon={<MessageSquareText className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="space-y-3">
            {startup.comments.map(comment => (
              <div key={`${comment.author}-${comment.date}`} className="border-b border-[#edf0ea] last:border-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#102033]">{comment.author}</div>
                    <div className="text-[11px] text-[#687468]">{comment.role} · {comment.date}</div>
                  </div>
                  <span className="text-[10px] font-semibold rounded bg-[#eef4ef] text-[#1a4d2e] px-1.5 py-0.5">{comment.area}</span>
                </div>
                <p className="text-sm text-[#425246] leading-relaxed mt-3">{comment.body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-8 grid lg:grid-cols-[.9fr_1.1fr] gap-5">
        <Panel title="Milestone tracker" icon={<CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="space-y-3">
            {startup.milestones.map(milestone => (
              <div key={milestone.title} className="flex gap-3">
                <div className="pt-0.5">
                  {milestone.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#1a4d2e]" strokeWidth={1.75} />
                  ) : milestone.status === 'blocked' ? (
                    <CircleAlert className="w-5 h-5 text-[#991b1b]" strokeWidth={1.75} />
                  ) : milestone.status === 'active' ? (
                    <Clock3 className="w-5 h-5 text-[#8a5a09]" strokeWidth={1.75} />
                  ) : (
                    <Circle className="w-5 h-5 text-[#8b978c]" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#102033]">{milestone.title}</div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-1 ${milestoneTone[milestone.status]}`}>{milestone.status}</span>
                  </div>
                  <div className="text-xs text-[#687468] mt-1">{milestone.owner} · due {milestone.due}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Founder workspace shortcuts" icon={<Users className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { title: 'Upload improved deck', description: 'Creates the next score point in this progress timeline.', href: '/apply', icon: FileText },
              { title: 'Practice Q&A', description: 'Use mock pitch to prepare for mentor and investor questions.', href: '/mock-pitch', icon: Mic },
              { title: 'Update investor CRM', description: 'Track warm introductions, next actions, and follow-ups.', href: '/crm', icon: Users },
              { title: 'Post mentor note', description: 'Add slide-level annotations and founder-facing comments.', href: '#mentor-notes', icon: PencilLine },
            ].map(item => {
              const Icon = item.icon
              return (
                <Link key={item.title} href={item.href} className="border border-[#e3e8df] rounded-lg p-4 hover:border-[#1a4d2e]/40 transition-colors">
                  <div className="w-9 h-9 rounded-md bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center">
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="text-sm font-semibold text-[#102033] mt-3">{item.title}</div>
                  <p className="text-xs text-[#687468] leading-relaxed mt-1">{item.description}</p>
                </Link>
              )
            })}
          </div>
        </Panel>
      </section>

      <CoreToolsBand />
    </UnpadShell>
  )
}

function ScoreCard({ icon, label, value, detail, valueNumber, tone = 'green' }: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  valueNumber: number
  tone?: 'green' | 'blue' | 'gold' | 'red'
}) {
  return (
    <div className="border border-[#e3e8df] rounded-lg p-4 bg-[#fbfcfa]">
      <div className="flex items-center gap-2 text-[#1a4d2e]">
        {icon}
        <div className="text-[11px] font-semibold uppercase tracking-wider">{label}</div>
      </div>
      <div className="text-2xl font-semibold text-[#102033] mt-4">{value}</div>
      <p className="text-xs text-[#687468] mt-1 leading-relaxed">{detail}</p>
      <div className="mt-4">
        <ScoreBar value={valueNumber} tone={tone} />
      </div>
    </div>
  )
}

function ScoreBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'blue' | 'gold' | 'red' }) {
  const colors = {
    green: 'bg-[#1a4d2e]',
    blue: 'bg-[#1d5f91]',
    gold: 'bg-[#d8a640]',
    red: 'bg-[#b42318]',
  }
  return (
    <div className="h-2 rounded-full bg-[#e8ede6] overflow-hidden flex-1">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function Panel({ id, title, icon, children }: {
  id?: string
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div id={id} className="bg-white border border-[#d9dfd2] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-md bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center">{icon}</div>
        <h2 className="text-sm font-semibold text-[#102033]">{title}</h2>
      </div>
      {children}
    </div>
  )
}
