import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BridgeLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-start gap-4">
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
        </div>
        {/* Tier legend skeleton */}
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
        {/* My stats skeleton */}
        <Skeleton className="h-36 w-full rounded-2xl" />
        {/* Podium skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
        </div>
        {/* List skeleton */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
