import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ConvergenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-60" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        {/* Tab skeletons */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl ml-auto" />
        </div>

        {/* Category pill skeletons */}
        <div className="flex gap-1.5 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>

        {/* Card skeletons */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="space-y-2.5 mt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-36" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </div>
                </div>
                <Skeleton className="h-16 w-16 rounded-xl flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
