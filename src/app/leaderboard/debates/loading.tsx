import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebatesLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-52 mb-1.5" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex gap-1.5 mb-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg flex-shrink-0" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <Skeleton className="h-1.5 w-24 rounded-full" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-12 rounded" />
                    <Skeleton className="h-3 w-10 rounded" />
                    <Skeleton className="h-3 w-10 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
