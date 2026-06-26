import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowUpRight, Building2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { unpadCoreTools, unpadNavItems } from './data'

type UnpadShellProps = {
  active: 'dashboard' | 'insights' | 'announcements'
  eyebrow?: string
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
}

export function UnpadShell({ active, eyebrow = 'Institution workspace', title, subtitle, children, actions }: UnpadShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f8f5] text-text-primary">
      <header className="border-b border-[#d9dfd2] bg-[#102f4f] text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Link href="/unpad" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white border border-white/15 flex items-center justify-center p-1.5 shadow-sm">
                <img
                  src="/brand/unpad-crest.png"
                  alt="Universitas Padjadjaran crest"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Universitas Padjadjaran</div>
                <div className="text-[11px] text-white/70">Incubator workspace powered by RaiseSEA</div>
              </div>
            </Link>

            <nav className="flex items-center gap-1 overflow-x-auto">
              {unpadNavItems.map(item => {
                const Icon = item.icon
                const isActive = active === item.key
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'h-9 inline-flex items-center gap-2 rounded-md px-3 text-sm transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-white text-[#102f4f]'
                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-7 md:py-10">
        <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a] mb-2">
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              {eyebrow}
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#102033]">{title}</h1>
            <p className="text-sm text-[#687468] mt-2 max-w-3xl leading-relaxed">{subtitle}</p>
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>

        {children}
      </main>

      <footer className="border-t border-[#d9dfd2] bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center justify-between gap-5 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg border border-[#e3e8df] bg-white flex items-center justify-center p-1.5">
                <img
                  src="/brand/unpad-crest.png"
                  alt="Universitas Padjadjaran crest"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#102033]">Universitas Padjadjaran Incubator Workspace</div>
                <div className="text-xs text-[#687468] mt-0.5">Startup progress, mentor annotations, cohort insights, and RaiseSEA founder tools.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#687468]">Powered by</span>
              <img
                src="/brand/raisesea-wordmark.svg"
                alt="RaiseSEA"
                className="h-9 w-auto"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function CoreToolsBand() {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1d5a3a]">RaiseSEA core tools</div>
          <h2 className="text-base font-semibold text-[#102033] mt-1">Still available for every Unpad startup and leader</h2>
        </div>
        <Link href="/dashboard" className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-[#365141] hover:text-[#1a4d2e]">
          Open founder workspace
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {unpadCoreTools.map(tool => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.label}
              href={tool.href}
              className="group bg-white border border-[#d9dfd2] rounded-lg p-4 hover:border-[#1a4d2e]/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="w-9 h-9 rounded-md bg-[#eef4ef] text-[#1a4d2e] flex items-center justify-center">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#879184] group-hover:text-[#1a4d2e]" strokeWidth={1.75} />
              </div>
              <div className="mt-3 text-sm font-semibold text-[#102033]">{tool.label}</div>
              <p className="text-[11px] text-[#687468] leading-relaxed mt-1">{tool.description}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function WorkspaceButton({ href, children, variant = 'primary' }: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Link
      href={href}
      className={cn(
        'h-9 inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
        variant === 'primary'
          ? 'bg-[#1a4d2e] text-white hover:bg-[#153f26]'
          : 'bg-white text-[#102033] border border-[#cfd9cf] hover:border-[#94a394]'
      )}
    >
      {children}
    </Link>
  )
}
