import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CalibrationLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-3">
              <Skeleton className="h-3.5 w-3.5 mx-auto mb-1.5 rounded" />
              <Skeleton className="h-4 w-10 mx-auto mb-1" />
              <Skeleton className="h-2.5 w-14 mx-auto" />
            </div>
          ))}
        </div>

        {/* Grade legend */}
        <Skeleton className="h-16 w-full rounded-2xl mb-6" />

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[80, 72, 88].map((w, i) => (
            <Skeleton key={i} className={`h-9 w-${w === 80 ? 28 : w === 72 ? 24 : 32} rounded-xl flex-shrink-0`} />
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-surface-300 bg-surface-100"
            >
              <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-36" />
              </div>
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="text-right flex-shrink-0 min-w-[52px] space-y-1">
                <Skeleton className="h-3.5 w-10 ml-auto" />
                <Skeleton className="h-2.5 w-12 ml-auto" />
              </div>
              <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
