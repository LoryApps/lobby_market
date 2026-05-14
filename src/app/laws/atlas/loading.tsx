import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function LawsAtlasLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-5 w-36 mb-1" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <Skeleton className="h-3 w-14 mb-3" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
        {/* Matrix */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-4">
          <Skeleton className="h-4 w-40 mb-5" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-md flex-shrink-0" />
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-9 flex-1 rounded-md" />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Bars */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <Skeleton className="h-4 w-28 mb-5" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}>
                    <div className="flex justify-between mb-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Law list */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-300 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-full" />
            ))}
          </div>
          <div className="divide-y divide-surface-300/60">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4 animate-pulse">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
