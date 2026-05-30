import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function EpochLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3.5 w-72" />
        </div>

        {/* Summary banner */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/50">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6 space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap gap-2">
            {[60, 80, 70, 90, 65, 75, 55].map((w, i) => (
              <Skeleton key={i} className={`h-7 rounded-lg`} style={{ width: `${w}px` }} />
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap mb-5">
          {[50, 80, 85, 75, 65, 70, 55].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" style={{ width: `${w}px` }} />
          ))}
        </div>

        {/* Epoch cards */}
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
                <Skeleton className="h-6 w-20 rounded-lg flex-shrink-0" />
              </div>
              <Skeleton className="h-3.5 w-5/6" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
