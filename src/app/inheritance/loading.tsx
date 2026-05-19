import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function InheritanceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-3.5 w-72" />
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center">
                <Skeleton className="h-8 w-16 mx-auto mb-1.5" />
                <Skeleton className="h-3 w-24 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          {/* Card skeletons */}
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-1.5">
                      <Skeleton className="h-4 w-16 rounded-full" />
                      <Skeleton className="h-4 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar skeletons */}
          <div className="space-y-5">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <Skeleton className="h-4 w-28 mb-4" />
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <Skeleton className="h-4 w-32 mb-3" />
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
