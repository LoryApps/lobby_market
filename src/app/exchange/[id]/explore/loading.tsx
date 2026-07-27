import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ExchangeExploreLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header skeleton */}
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-full max-w-xl" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-16 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full mb-6" />

        {/* Quick nav skeleton */}
        <div className="flex gap-1.5 flex-wrap mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-lg" />
          ))}
        </div>

        {/* Section skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-10 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
            <div className="rounded-2xl border border-surface-300/30 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-24 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
