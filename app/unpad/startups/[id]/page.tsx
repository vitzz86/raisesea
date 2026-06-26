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
import { fetchUnpadStartup } from '../../incubator'
import type { IncubatorDeckVersionView } from '../../incubator'
import type { MilestoneStatus, StartupStatus } from '../../data'

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

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Startup Progress — Unpad x RaiseSEA',
  description: 'Unpad startup progress workspace with deck score history, mentor prompts, and milestones.',
}

export default async function UnpadStartupPage({ params }: StartupPageProps) {
  const { id } = await params
  const { startup, versions, schemaReady, error } = await fetchUnpadStartup(id)
  if (!startup) notFound()

  const deckDelta = startup.latestDelta ?? 0
  const milestones = buildMilestones(startup.latestVersion, startup.nextMilestone)
  const chronologicalVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber)

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
        {!schemaReady && (
          <div className="lg:col-span-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#991b1b]">
            Run `supabase/migrations/v22_incubator_unpad_workspace.sql` in Supabase before using this page. {error ? `Current error: ${error}` : ''}
          </div>
        )}

        <div className="bg-white border border-[#d9dfd2] rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex border rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[startup.status]}`}>{startup.status}</span>
                <span className="text-xs text-[#687468]">{startup.stage} · {startup.sector} · {startup.faculty}</span>
              </div>
              <h2 className="text-xl font-semibold text-[#102033] mt-4">Progress score {startup.progressScore}/100</h2>
              <p className="text-sm text-[#687468] leading-relaxed mt-2 max-w-2xl">
                {startup.deckScore == null
                  ? 'No deck has been uploaded yet. Upload the first deck to create the baseline.'
                  : `Latest deck upload shows the team is moving toward ${startup.nextMilestone.toLowerCase()}.`}
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
              value={startup.deckScore == null ? 'No deck' : `${startup.deckScore}/100`}
              detail={startup.previousDeckScore == null ? 'Baseline pending' : `${deckDelta >= 0 ? '+' : ''}${deckDelta} from prior deck`}
              valueNumber={startup.deckScore ?? 0}
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
                href={title.includes('pitch') ? '/mock-pitch' : title.includes('deck') ? '/unpad/upload' : '#mentor-notes'}
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

      <section className="mt-8">
        <Panel title="Score movement over time" icon={<TrendingUp className="w-4 h-4" strokeWidth={1.75} />}>
          <ScoreMovementChart versions={chronologicalVersions} />
        </Panel>
      </section>

      <section className="mt-8 grid lg:grid-cols-[1fr_.85fr] gap-5">
        <Panel title="Deck versions over time" icon={<Presentation className="w-4 h-4" strokeWidth={1.75} />}>
          {versions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d9dfd2] p-6 text-sm text-[#687468] text-center">
              No decks uploaded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((deck, index) => (
              <div key={deck.version} className="border border-[#e3e8df] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#102033]">{deck.version}</div>
                    <div className="text-xs text-[#687468] mt-1">{deck.uploadedAt} · Focus: {deck.focus}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-[#102033]">{deck.score ?? '—'}</div>
                    <div className="text-[11px] text-[#687468]">deck score</div>
                  </div>
                </div>
                <p className="text-sm text-[#425246] leading-relaxed mt-3">{deck.summary}</p>
                <div className="mt-4 flex items-center gap-3">
                  <ScoreBar value={deck.score ?? 0} tone={index === 0 ? 'green' : 'blue'} />
                  <span className="text-xs text-[#687468] shrink-0">
                    {deck.scoreDelta == null ? 'baseline' : `${deck.scoreDelta >= 0 ? '+' : ''}${deck.scoreDelta}`}
                  </span>
                </div>
                {deck.submissionSlug && (
                  <Link href={`/match/${deck.submissionSlug}`} className="mt-3 inline-flex text-xs font-medium text-[#1a4d2e] hover:underline">
                    Open full analysis
                  </Link>
                )}
              </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel id="mentor-notes" title="Mentor annotations" icon={<MessageSquareText className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="space-y-3">
            {versions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d9dfd2] p-6 text-sm text-[#687468] text-center">
                Mentor prompts appear after the first deck analysis.
              </div>
            ) : versions.map(deck => (
              <div key={deck.id} className="border-b border-[#edf0ea] last:border-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#102033]">{startup.mentor}</div>
                    <div className="text-[11px] text-[#687468]">Mentor prompt · {deck.uploadedAt}</div>
                  </div>
                  <span className="text-[10px] font-semibold rounded bg-[#eef4ef] text-[#1a4d2e] px-1.5 py-0.5">{deck.version}</span>
                </div>
                <p className="text-sm text-[#425246] leading-relaxed mt-3">{deck.mentorPrompt}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-8 grid lg:grid-cols-[.9fr_1.1fr] gap-5">
        <Panel title="Milestone tracker" icon={<CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />}>
          <div className="space-y-3">
            {milestones.map(milestone => (
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
              { title: 'Upload improved deck', description: 'Creates the next score point in this progress timeline.', href: '/unpad/upload', icon: FileText },
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

function ScoreMovementChart({ versions }: { versions: IncubatorDeckVersionView[] }) {
  const scoredVersions = versions.filter(deck => deck.score != null)

  if (scoredVersions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d9dfd2] p-6 text-sm text-[#687468] text-center">
        Score movement appears after the first deck upload.
      </div>
    )
  }

  const latest = scoredVersions[scoredVersions.length - 1]
  const first = scoredVersions[0]
  const best = scoredVersions.reduce((winner, deck) => (deck.score ?? 0) > (winner.score ?? 0) ? deck : winner, first)
  const movement = (latest.score ?? 0) - (first.score ?? 0)

  return (
    <div className="grid lg:grid-cols-[1fr_240px] gap-5 items-stretch">
      <div className="rounded-lg border border-[#e3e8df] bg-[#fbfcfa] p-4 overflow-hidden">
        <ScoreLineSvg versions={scoredVersions} />
      </div>
      <div className="grid sm:grid-cols-3 lg:grid-cols-1 gap-3">
        <TrendStat
          label="Latest score"
          value={`${latest.score}/100`}
          detail={`${latest.version} uploaded ${latest.uploadedAt}`}
        />
        <TrendStat
          label="Movement"
          value={`${movement >= 0 ? '+' : ''}${movement}`}
          detail={scoredVersions.length === 1 ? 'Baseline created' : `From ${first.version} to ${latest.version}`}
          tone={movement >= 0 ? 'green' : 'red'}
        />
        <TrendStat
          label="Best version"
          value={`${best.score}/100`}
          detail={`${best.version} focus: ${best.focus}`}
          tone="blue"
        />
      </div>
    </div>
  )
}

function ScoreLineSvg({ versions }: { versions: IncubatorDeckVersionView[] }) {
  const width = 760
  const height = 260
  const padding = { top: 22, right: 28, bottom: 54, left: 46 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const ticks = [100, 75, 50, 25, 0]
  const count = versions.length
  const xFor = (index: number) => padding.left + (count === 1 ? plotWidth / 2 : (plotWidth * index) / (count - 1))
  const yFor = (score: number) => padding.top + ((100 - Math.max(0, Math.min(100, score))) / 100) * plotHeight
  const points = versions.map((deck, index) => ({
    deck,
    x: xFor(index),
    y: yFor(deck.score ?? 0),
  }))
  const linePoints = points.map(point => `${point.x},${point.y}`).join(' ')
  const areaPath = points.length > 1
    ? `M ${points[0].x} ${padding.top + plotHeight} L ${points.map(point => `${point.x} ${point.y}`).join(' L ')} L ${points[points.length - 1].x} ${padding.top + plotHeight} Z`
    : ''

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-h-[220px]" role="img" aria-label="Deck score movement over time">
      <defs>
        <linearGradient id="scoreMovementArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1a4d2e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1a4d2e" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {ticks.map(tick => {
        const y = yFor(tick)
        return (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e3e8df" strokeWidth="1" />
            <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="11" fill="#687468">{tick}</text>
          </g>
        )
      })}

      <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} stroke="#cfd8ce" strokeWidth="1" />
      <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke="#cfd8ce" strokeWidth="1" />

      {areaPath && <path d={areaPath} fill="url(#scoreMovementArea)" />}
      {points.length > 1 ? (
        <polyline points={linePoints} fill="none" stroke="#1a4d2e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <line
          x1={padding.left + plotWidth * 0.25}
          x2={padding.left + plotWidth * 0.75}
          y1={points[0].y}
          y2={points[0].y}
          stroke="#1a4d2e"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}

      {points.map((point, index) => {
        const delta = point.deck.scoreDelta
        const isLatest = index === points.length - 1
        return (
          <g key={point.deck.id}>
            <circle cx={point.x} cy={point.y} r={isLatest ? 7 : 5} fill="#ffffff" stroke={isLatest ? '#1a4d2e' : '#d8a640'} strokeWidth={isLatest ? 4 : 3} />
            <text x={point.x} y={point.y - 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="#102033">
              {point.deck.score}
            </text>
            <text x={point.x} y={padding.top + plotHeight + 24} textAnchor="middle" fontSize="12" fontWeight="700" fill="#102033">
              {point.deck.version}
            </text>
            <text x={point.x} y={padding.top + plotHeight + 40} textAnchor="middle" fontSize="10" fill="#687468">
              {delta == null ? 'baseline' : `${delta >= 0 ? '+' : ''}${delta}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function TrendStat({ label, value, detail, tone = 'green' }: {
  label: string
  value: string
  detail: string
  tone?: 'green' | 'blue' | 'red'
}) {
  const toneClass = {
    green: 'text-[#1a4d2e] bg-[#eef4ef]',
    blue: 'text-[#1d5f91] bg-[#eef6ff]',
    red: 'text-[#991b1b] bg-[#fef2f2]',
  }

  return (
    <div className="rounded-lg border border-[#e3e8df] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687468]">{label}</div>
      <div className={`inline-flex rounded-md px-2 py-1 mt-3 text-xl font-semibold ${toneClass[tone]}`}>{value}</div>
      <p className="text-xs text-[#687468] leading-relaxed mt-3">{detail}</p>
    </div>
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

function buildMilestones(latestVersion: number, nextMilestone: string) {
  return [
    {
      title: latestVersion > 0 ? `Deck v${latestVersion} analysis completed` : 'Upload first deck',
      owner: 'Unpad operator',
      due: latestVersion > 0 ? 'Done' : 'Now',
      status: latestVersion > 0 ? 'done' : 'active',
    },
    {
      title: nextMilestone,
      owner: 'Assigned mentor',
      due: 'Next review',
      status: latestVersion > 0 ? 'active' : 'todo',
    },
    {
      title: 'Upload revised deck after mentor feedback',
      owner: 'Startup founder',
      due: 'Next sprint',
      status: 'todo',
    },
  ] as Array<{ title: string; owner: string; due: string; status: MilestoneStatus }>
}
