import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DiscoverLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-2.5 mb-8">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="space-y-10">
          {/* Users skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 mb-3" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
          {/* Topics skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mb-3" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          {/* Categories skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
