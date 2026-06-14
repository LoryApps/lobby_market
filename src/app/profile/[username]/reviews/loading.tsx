import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ReviewsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-7 w-12 mx-auto mb-1" />
              <Skeleton className="h-2.5 w-16 mx-auto" />
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="h-2 w-6" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex justify-between mb-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-3.5 w-3.5 rounded" />
                ))}
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
