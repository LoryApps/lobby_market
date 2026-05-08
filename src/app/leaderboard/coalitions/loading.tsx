import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 flex flex-col items-center gap-1.5">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
          {/* Sort tabs */}
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>

        {/* Podium skeleton */}
        <div className="flex items-end gap-2 mb-6">
          {[70, 40, 90].map((h, i) => (
            <div key={i} className="flex-1 rounded-2xl border border-surface-300 bg-surface-100 p-3" style={{ paddingTop: i === 0 ? '2.5rem' : i === 1 ? '1rem' : '3.5rem' }}>
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-4 w-8 rounded" />
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Ranked list skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3 w-24 hidden sm:block" />
              <Skeleton className="h-5 w-14" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
