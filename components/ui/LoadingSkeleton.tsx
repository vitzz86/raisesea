// ═══════════════════════════════════════════════════════════════
// LoadingSkeleton — shimmer placeholders matching content shape
//
// Better than spinners because:
//   • Sets accurate expectations about layout
//   • Reduces perceived loading time (research-backed)
//   • Matches the "feels enterprise" goal
//
// Use shape props to compose realistic skeletons.
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

// ─── Preset skeletons for common shapes ────────────────────────────
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width={40} height={40} className="rounded-full" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton width="40%" height={14} />
          <Skeleton width="30%" height={12} />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div className="bg-surface-card border border-border rounded-lg p-6">
      <Skeleton width={100} height={12} className="mb-3" />
      <Skeleton width={140} height={40} className="mb-2" />
      <Skeleton width="80%" height={14} />
    </div>
  )
}
