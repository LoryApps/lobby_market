import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PerformanceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Performance chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-7 w-12 rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>

        {/* By category */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-surface-300/30">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
