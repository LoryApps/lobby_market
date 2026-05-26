import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HallOfFameLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 pb-24 pt-4 md:pt-8">
        <div className="mx-auto max-w-3xl px-4 space-y-8">
          {/* Hero skeleton */}
          <div className="text-center space-y-4 py-6">
            <Skeleton className="h-12 w-12 rounded-2xl mx-auto" />
            <Skeleton className="h-9 w-56 mx-auto" />
            <Skeleton className="h-4 w-80 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          {/* Tab skeleton */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-surface-200/60 border border-surface-300/40">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          {/* Category filter skeleton */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
          {/* Cards */}
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
                <div className="rounded-xl border border-surface-300/30 p-3 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-36" />
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
