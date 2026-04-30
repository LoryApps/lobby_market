import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PipelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-screen-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6">
          <Skeleton className="h-3 w-24 mb-4" />
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="h-3 w-full max-w-xl" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Controls skeleton */}
        <div className="flex items-center gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Column skeletons */}
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[280px] flex-shrink-0 rounded-2xl border border-surface-300 bg-surface-100/40">
              <div className="px-4 py-3 border-b border-surface-300">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="p-3 space-y-2.5">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="rounded-xl border border-surface-300 bg-surface-100 p-3.5">
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-4/5 mb-3" />
                    <Skeleton className="h-1.5 w-full rounded-full mb-2" />
                    <div className="flex justify-between">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
