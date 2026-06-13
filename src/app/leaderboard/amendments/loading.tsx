import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AmendmentLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6 flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <Skeleton className="h-6 w-10 mx-auto mb-1" />
              <Skeleton className="h-3 w-14 mx-auto" />
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-surface-200/50 p-1 rounded-xl mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-9 rounded-lg" />
          ))}
        </div>

        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300/50">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
