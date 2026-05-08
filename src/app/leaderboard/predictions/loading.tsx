import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PredictionsLeaderboardLoading() {
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
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5">
              <Skeleton className="h-3.5 w-3.5 mx-auto mb-1 rounded" />
              <Skeleton className="h-4 w-10 mx-auto mb-1" />
              <Skeleton className="h-2.5 w-14 mx-auto" />
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <Skeleton className="h-11 w-full rounded-xl mb-5" />

        {/* Description strip */}
        <Skeleton className="h-9 w-full rounded-lg mb-4" />

        {/* Rows */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300"
            >
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
