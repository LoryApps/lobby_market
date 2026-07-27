import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TodayRelaysLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />

        {/* Live count badge */}
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>

        {/* Today's relay cards */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-12 rounded-full flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex -space-x-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-7 w-7 rounded-full ring-2 ring-surface-50" />
                  ))}
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
