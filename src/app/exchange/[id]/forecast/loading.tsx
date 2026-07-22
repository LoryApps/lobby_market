import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ForecastLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>

        {/* Forecast chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="flex justify-between">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-3 w-10" />
            ))}
          </div>
        </div>

        {/* Confidence intervals */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-300/30">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>

        {/* Top forecasters */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
