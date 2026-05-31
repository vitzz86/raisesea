// ═══════════════════════════════════════════════════════════════
// DashboardShell.tsx — chunk 12.3 Stage 1
//
// Unified shell for all authenticated pages. Replaces the old flat-list
// sidebar with a journey-grouped nav: ASSESS / PREPARE / EXECUTE / LEARN.
//
// Responsive strategy:
//   • Desktop (≥md / 768px): left sidebar always visible, 248px wide
//   • Mobile (<md): top bar + bottom-nav with 4 primary destinations,
//     hamburger button opens the full sidebar as a slide-in drawer
//
// All icons are Lucide (no emoji). All colors are semantic tokens.
// ═══════════════════════════════════════════════════════════════

'use client'

import Link from 'next/link'
import { useState, ReactNode } from 'react'
import {
  Home, Plus, Target, Users, Briefcase, Calendar, Calculator,
  Newspaper, Settings, Menu, X, LogOut, Shield, Inbox, Clock, UserCircle,
  Sparkles, HelpCircle, FileText, BookOpen
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tour, useTour } from './Tour'

type ShellProps = {
  user: { email?: string | null }
  profile: { full_name?: string | null; company_name?: string | null } | null
  isAdmin: boolean
  isApprovedExpert?: boolean
  activePath: string
  children: ReactNode
}

// ─── Nav structure ─────────────────────────────────────────────────
// Top-level "Home" item, then journey-grouped sections.

interface NavItem {
  key: string
  label: string
  href: string
  icon: ReactNode
}

interface NavSection {
  label: string
  items: NavItem[]
}

const HOME_ITEM: NavItem = {
  key: 'dashboard',
  label: 'Home',
  href: '/dashboard',
  icon: <Home className="w-4 h-4" strokeWidth={1.75} />,
}

const FOUNDER_SECTIONS: NavSection[] = [
  {
    label: 'Assess',
    items: [
      { key: 'apply',         label: 'New deck analysis', href: '/apply',                  icon: <Plus className="w-4 h-4" strokeWidth={1.75} /> },
      { key: 'submissions',   label: 'Analysis results',  href: '/dashboard/submissions',  icon: <FileText className="w-4 h-4" strokeWidth={1.75} /> },
    ],
  },
  {
    label: 'Prepare',
    items: [
      { key: 'mock-pitch',    label: 'Mock pitch',        href: '/mock-pitch',      icon: <Target className="w-4 h-4" strokeWidth={1.75} /> },
      { key: 'experts',       label: 'Find an expert',    href: '/meet',            icon: <Users className="w-4 h-4" strokeWidth={1.75} /> },
    ],
  },
  {
    label: 'Execute',
    items: [
      { key: 'crm',           label: 'CRM',               href: '/crm',             icon: <Briefcase className="w-4 h-4" strokeWidth={1.75} /> },
      { key: 'meetings',      label: 'Meetings',          href: '/dashboard/meetings', icon: <Calendar className="w-4 h-4" strokeWidth={1.75} /> },
      { key: 'calculator',    label: 'Calculator',        href: '/tools/calculator', icon: <Calculator className="w-4 h-4" strokeWidth={1.75} /> },
    ],
  },
  {
    label: 'Learn',
    items: [
      { key: 'news',          label: 'Weekly news',       href: '/news',            icon: <Newspaper className="w-4 h-4" strokeWidth={1.75} /> },
      { key: 'glossary',      label: 'Glossary',          href: '/glossary',        icon: <BookOpen className="w-4 h-4" strokeWidth={1.75} /> },
    ],
  },
]

const EXPERT_SECTION: NavSection = {
  label: 'As an expert',
  items: [
    { key: 'expert-meetings',     label: 'Incoming requests', href: '/experts/meetings',             icon: <Inbox className="w-4 h-4" strokeWidth={1.75} /> },
    { key: 'expert-availability', label: 'Availability',      href: '/experts/profile/availability', icon: <Clock className="w-4 h-4" strokeWidth={1.75} /> },
    { key: 'expert-profile',      label: 'Expert profile',    href: '/experts/profile',              icon: <UserCircle className="w-4 h-4" strokeWidth={1.75} /> },
  ],
}

const ADMIN_SECTION: NavSection = {
  label: 'Admin',
  items: [
    { key: 'admin',       label: 'Admin panel',     href: '/admin',       icon: <Shield className="w-4 h-4" strokeWidth={1.75} /> },
    { key: 'admin-news',  label: 'News & digest',   href: '/admin/news',  icon: <Sparkles className="w-4 h-4" strokeWidth={1.75} /> },
  ],
}

// Mobile bottom-nav: 4 most-used destinations (the user's research-backed pattern)
const MOBILE_BOTTOM_NAV: NavItem[] = [
  { key: 'dashboard',  label: 'Home',     href: '/dashboard',       icon: <Home className="w-5 h-5" strokeWidth={1.75} /> },
  { key: 'mock-pitch', label: 'Practice', href: '/mock-pitch',      icon: <Target className="w-5 h-5" strokeWidth={1.75} /> },
  { key: 'crm',        label: 'CRM',      href: '/crm',             icon: <Briefcase className="w-5 h-5" strokeWidth={1.75} /> },
  { key: 'experts',    label: 'Experts',  href: '/meet',            icon: <Users className="w-5 h-5" strokeWidth={1.75} /> },
]

// ─── Main component ───────────────────────────────────────────────
export default function DashboardShell({ user, profile, isAdmin, isApprovedExpert = false, activePath, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { open: tourOpen, openTour, closeTour } = useTour()

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'You'
  const initial = (displayName[0] || 'U').toUpperCase()

  // Compose visible sections based on user role
  const sections = [...FOUNDER_SECTIONS]
  if (isApprovedExpert) sections.push(EXPERT_SECTION)
  if (isAdmin) sections.push(ADMIN_SECTION)

  return (
    <div className="min-h-screen bg-surface-page">

      {/* ─── DESKTOP SIDEBAR (≥md) — FIXED so always visible regardless of scroll ─── */}
      <aside className="hidden md:flex w-[248px] bg-surface-card border-r border-border flex-col fixed top-0 left-0 h-screen z-30">
        <SidebarContent
          activePath={activePath}
          sections={sections}
          displayName={displayName}
          initial={initial}
          email={user.email}
          onTourClick={openTour}
        />
      </aside>

      {/* ─── MOBILE TOP BAR (<md) ────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-card border-b border-border h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <Link href="/" className="text-base font-semibold text-brand tracking-tight">
            RaiseSEA
          </Link>
        </div>
        <div className="w-8 h-8 rounded-full bg-brand text-text-inverse flex items-center justify-center text-sm font-semibold">
          {initial}
        </div>
      </header>

      {/* ─── MOBILE DRAWER (<md) ─────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-surface-overlay animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-surface-card flex flex-col animate-slide-down" style={{ animation: 'slide-down 200ms cubic-bezier(0.0, 0, 0.2, 1)' }}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Link href="/" className="text-base font-semibold text-brand tracking-tight" onClick={() => setDrawerOpen(false)}>
                RaiseSEA
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <SidebarContent
              activePath={activePath}
              sections={sections}
              displayName={displayName}
              initial={initial}
              email={user.email}
              onItemClick={() => setDrawerOpen(false)}
              onTourClick={() => { setDrawerOpen(false); openTour() }}
            />
          </aside>
        </>
      )}

      {/* ─── MAIN CONTENT AREA ──────────────────────────────────── */}
      {/* md:ml-[248px] compensates for the fixed sidebar width (248px). */}
      <main className="min-w-0 pt-14 md:pt-0 pb-20 md:pb-0 md:ml-[248px]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
          {children}
        </div>
      </main>

      {/* ─── MOBILE BOTTOM NAV (<md) ────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-border flex items-stretch h-16">
        {MOBILE_BOTTOM_NAV.map(item => {
          const active = activePath === item.key
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative',
                active ? 'text-brand' : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              {/* Active state: top accent bar + soft background */}
              {active && (
                <>
                  <span className="absolute top-0 left-4 right-4 h-0.5 bg-brand rounded-full" aria-hidden="true" />
                  <span className="absolute inset-x-2 inset-y-1 bg-brand-soft rounded-md -z-0" aria-hidden="true" />
                </>
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className={cn('text-[11px] relative z-10', active && 'font-semibold')}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ─── FIRST-RUN TOUR MODAL ───────────────────────────────── */}
      <Tour open={tourOpen} onClose={closeTour} />
    </div>
  )
}

// ─── Sidebar content (shared between desktop sidebar + mobile drawer) ──
interface SidebarContentProps {
  activePath: string
  sections: NavSection[]
  displayName: string
  initial: string
  email?: string | null
  onItemClick?: () => void
  onTourClick?: () => void
}

function SidebarContent({ activePath, sections, displayName, initial, email, onItemClick, onTourClick }: SidebarContentProps) {
  return (
    <>
      {/* Logo header (desktop only — mobile shows it in the drawer header) */}
      <div className="hidden md:flex px-6 py-5 border-b border-border items-center">
        <Link href="/" className="text-lg font-semibold text-brand tracking-tight">
          RaiseSEA
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Home item — top-level, no section header */}
        <NavLink
          item={HOME_ITEM}
          active={activePath === HOME_ITEM.key}
          onClick={onItemClick}
        />

        {/* Journey-grouped sections */}
        {sections.map((section, sectionIdx) => (
          <div key={section.label} className="mt-6 first:mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2 px-3">
              {section.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.key}
                  item={item}
                  active={activePath === item.key}
                  onClick={onItemClick}
                  // Admin section gets warning tone
                  isAdmin={section.label === 'Admin'}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card at bottom — clickable, links to /settings */}
      <div className="px-3 py-3 border-t border-border">
        <Link
          href="/settings"
          onClick={onItemClick}
          className="flex items-center gap-2 px-2 py-2 rounded-md bg-surface-muted hover:bg-surface-sunken transition-colors group"
          title="Edit your profile + settings"
        >
          <div className="w-8 h-8 rounded-full bg-brand text-text-inverse flex items-center justify-center text-sm font-semibold shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-text-primary truncate group-hover:text-brand transition-colors">{displayName}</div>
            <div className="text-[11px] text-text-tertiary truncate">{email}</div>
          </div>
          <Settings className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" strokeWidth={1.75} />
        </Link>
        <div className="flex items-center justify-between mt-2 px-2 gap-2">
          {onTourClick && (
            <button
              type="button"
              onClick={onTourClick}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1"
              title="Show product tour"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
              Tour
            </button>
          )}
          <form action="/api/auth/signout" method="POST" className="ml-auto">
            <button
              type="submit"
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── NavLink — single nav row ──────────────────────────────────────
interface NavLinkProps {
  item: NavItem
  active: boolean
  onClick?: () => void
  isAdmin?: boolean
}

function NavLink({ item, active, onClick, isAdmin }: NavLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all',
        active
          ? isAdmin
            ? 'bg-warning-solid text-text-inverse font-semibold shadow-subtle'
            : 'bg-brand text-text-inverse font-semibold shadow-subtle'
          : isAdmin
            ? 'text-warning-text hover:bg-warning-bg'
            : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  )
}
