import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawsLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-52 mb-1" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {[22, 20, 20, 24, 18].map((w, i) => (
            <Skeleton key={i} className={`h-8 rounded-lg flex-shrink-0 w-${w}`} />
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-4"
            >
              {/* Rank */}
              <Skeleton className="h-7 w-7 rounded-md flex-shrink-0 mt-0.5" />
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
                <div className="flex gap-3 mt-1">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              </div>
              {/* Metric */}
              <div className="flex-shrink-0 text-right space-y-1">
                <Skeleton className="h-6 w-16 rounded ml-auto" />
                <Skeleton className="h-3 w-12 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
