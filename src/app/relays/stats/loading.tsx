import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayStatsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <Skeleton className="h-4 w-36 mb-3" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>

        {/* Leaderboard */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-surface-300 last:border-0">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
