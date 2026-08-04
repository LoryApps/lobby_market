import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function IdeasLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-60" />
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
        {/* List */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100">
              <Skeleton className="h-6 w-6 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-14 rounded" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
