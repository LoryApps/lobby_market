import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicsLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-40 mb-1" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5">
          {['w-20', 'w-18', 'w-24', 'w-17', 'w-21'].map((w, i) => (
            <Skeleton key={i} className={`h-8 rounded-lg flex-shrink-0 ${w}`} />
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3.5">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded" />
                </div>
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-14 rounded ml-auto" />
                <Skeleton className="h-3 w-10 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
