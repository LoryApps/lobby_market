import React from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`}
      style={style}
    />
  )
}

function ArgumentSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  )
}

export default function ArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 md:pb-8">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* Filter skeletons */}
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            {[80, 96, 88, null, 72, 80, 100].map((w, i) =>
              w ? (
                <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />
              ) : (
                <div key={i} className="w-px bg-surface-300 mx-1 self-center h-4" />
              )
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[64, 72, 80, 64, 56, 80, 68, 60, 84, 76, 80].map((w, i) => (
              <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArgumentSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
