import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-4">
        <Skeleton className="h-4 w-32 mb-6" />

        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>

        {/* Podium */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-end justify-center gap-4 h-28">
            <Skeleton className="w-20 h-20 rounded-xl" />
            <Skeleton className="w-20 h-28 rounded-xl" />
            <Skeleton className="w-20 h-16 rounded-xl" />
          </div>
        </div>

        {/* Leaderboard rows */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-surface-300/40 last:border-0">
              <Skeleton className="h-6 w-6 rounded flex-shrink-0" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
