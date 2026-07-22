import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AnalysisLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
          ))}
        </div>

        {/* Price chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-7 w-12 rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>

        {/* Distribution */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${20 + Math.sin(i) * 15 + 30}%` }} />
            ))}
          </div>
        </div>

        {/* Statistical breakdown */}
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-5 w-44" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex justify-between py-2 border-b border-surface-300/30">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
