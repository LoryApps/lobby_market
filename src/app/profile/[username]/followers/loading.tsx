import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function FollowersLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-surface-300 mb-1">
          <div className="flex-1 flex items-center justify-center py-3 gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
          <div className="flex-1 flex items-center justify-center py-3 gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
        </div>

        {/* User rows */}
        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-surface-300 last:border-0">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-20 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
