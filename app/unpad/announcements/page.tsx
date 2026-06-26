import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Megaphone,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { CoreToolsBand, UnpadShell, WorkspaceButton } from '../UnpadShell'
import { announcements } from '../data'
import { fetchUnpadStartups, requireUnpadOperator } from '../incubator'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unpad Announcements — RaiseSEA',
  description: 'Unpad announcement center for cohort updates, mentor reminders, and incubator deadlines.',
}

export default async function UnpadAnnouncementsPage() {
  await requireUnpadOperator('/unpad/announcements')
  const { startups } = await fetchUnpadStartups()
  const demoReadyCount = startups.filter(startup => startup.status === 'Demo Day Ready').length
  const incubatingCount = startups.filter(startup => startup.status === 'Incubating').length
  const mentorReviewCount = startups.filter(startup => startup.risk !== 'Low').length

  return (
    <UnpadShell
      active="announcements"
      title="Announcements"
      subtitle="Send cohort-wide updates, deadline reminders, mentor requests, and program notices into founder dashboards."
      actions={
        <>
          <WorkspaceButton href="/unpad/insights" variant="secondary">
            <PenLine className="w-4 h-4" strokeWidth={1.75} />
            Materials
          </WorkspaceButton>
          <WorkspaceButton href="#composer">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            New announcement
          </WorkspaceButton>
        </>
      }
    >
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<Megaphone className="w-4 h-4" strokeWidth={1.75} />} label="Announcements" value={announcements.length.toString()} detail="Pinned, scheduled, and sent" />
        <MetricCard icon={<Users className="w-4 h-4" strokeWidth={1.75} />} label="Incubating teams" value={incubatingCount.toString()} detail="Need weekly milestone rhythm" accent="blue" />
        <MetricCard icon={<ShieldCheck className="w-4 h-4" strokeWidth={1.75} />} label="Demo-ready teams" value={demoReadyCount.toString()} detail="Preparing for investor showcase" accent="gold" />
        <MetricCard icon={<Clock3 className="w-4 h-4" strokeWidth={1.75} />} label="Mentor review" value={mentorReviewCount.toString()} detail="Medium or high risk teams" accent="red" />
      </section>

      <section className="mt-8 grid lg:grid-cols-[1.2fr_.85fr] gap-5">
        <div className="bg-white border border-[#d9dfd2] rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a]">Announcement queue</div>
              <h2 className="text-base font-semibold text-[#102033] mt-1">Program notices</h2>
            </div>
            <Link href="#composer" className="h-8 inline-flex items-center gap-1.5 rounded-md border border-[#cfd9cf] px-3 text-xs font-medium text-[#102033] hover:border-[#94a394]">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              Compose
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.map(item => (
              <article key={item.id} className="border border-[#e3e8df] rounded-lg p-4 bg-[#fbfcfa]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill status={item.status} />
                      <span className="text-[11px] text-[#879184]">{item.date}</span>
                      <span className="text-[11px] text-[#879184]">Audience: {item.audience}</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#102033] mt-3">{item.title}</h3>
                    <p className="text-sm text-[#425246] leading-relaxed mt-2">{item.body}</p>
                  </div>
                  <Bell className="w-5 h-5 text-[#879184] shrink-0" strokeWidth={1.75} />
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Link href="#composer" className="h-8 inline-flex items-center gap-1.5 rounded-md bg-[#102f4f] text-white px-3 text-xs font-medium hover:bg-[#0d2741]">
                    <PenLine className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Edit
                  </Link>
                  <Link href="/unpad" className="h-8 inline-flex items-center gap-1.5 rounded-md border border-[#cfd9cf] px-3 text-xs font-medium text-[#102033] hover:border-[#94a394]">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    View recipients
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside id="composer" className="bg-[#102f4f] text-white rounded-lg p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Admin composer</div>
          <h2 className="text-lg font-semibold mt-2">Program update draft</h2>
          <div className="mt-5 space-y-3">
            <DraftField label="Title" value="Demo Day mentor rehearsal slots are open" />
            <DraftField label="Recipients" value="Demo Day Ready, Incubating, assigned mentors" />
            <DraftField label="Delivery" value="Founder dashboard, email digest, mentor dashboard" />
            <DraftField label="Schedule" value="Jun 29, 2026 at 08:30" />
          </div>
          <div className="mt-5 rounded-md border border-white/15 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/55">Message preview</div>
            <p className="text-sm leading-relaxed mt-2 text-white/85">
              Please book one 20-minute rehearsal slot before uploading your final deck. Mentors will leave final comments in the startup progress page.
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="/unpad" className="h-9 inline-flex items-center justify-center gap-2 rounded-md bg-[#d8a640] text-[#102f4f] px-3 text-sm font-semibold hover:bg-[#e4b956]">
              <Send className="w-4 h-4" strokeWidth={1.75} />
              Send
            </Link>
            <Link href="/unpad/announcements" className="h-9 inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium text-white hover:bg-white/10">
              Schedule
            </Link>
          </div>
        </aside>
      </section>

      <section className="mt-8 grid lg:grid-cols-3 gap-5">
        {[
          {
            icon: Users,
            title: 'Segment by stage',
            body: 'Send different reminders to applicants, incubating startups, demo-ready teams, mentors, and leadership.',
          },
          {
            icon: CalendarClock,
            title: 'Deadline rhythm',
            body: 'Keep deck upload deadlines, office hours, and pitch rehearsal windows visible from the same workspace.',
          },
          {
            icon: Bell,
            title: 'Founder dashboard delivery',
            body: 'Announcements become startup-facing notices alongside deck scores, mentor notes, and progress tasks.',
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
      <div className={`w-9 h-9 rounded-md flex items-center justify-center ${accentClasses[accent]}`}>{icon}</div>
      <div className="text-2xl font-semibold text-[#102033] mt-4">{value}</div>
      <div className="text-xs font-semibold text-[#102033] mt-1">{label}</div>
      <div className="text-[11px] text-[#687468] mt-1">{detail}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone = status === 'Pinned'
    ? 'bg-[#e7f6ea] text-[#1c6a39]'
    : status === 'Scheduled'
      ? 'bg-[#fff3cf] text-[#7a5200]'
      : 'bg-[#eef2f7] text-[#31506f]'

  return <span className={`text-[10px] font-semibold rounded-full px-2 py-1 ${tone}`}>{status}</span>
}

function DraftField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/15 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  )
}
