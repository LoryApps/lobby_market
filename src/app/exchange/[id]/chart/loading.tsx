import { Skeleton } from '@/components/ui/Skeleton'

export default function ChartStudioLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 space-y-5">
        {/* Back nav */}
        <Skeleton className="h-8 w-24 rounded-lg" />

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
        </div>

        {/* Window selector + MA toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-14 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        {/* Stats pills */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>

        {/* Nav links */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 flex-shrink-0 rounded-lg" />
          ))}
        </div>
      </main>

      {/* BottomNav */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface-100 border-t border-surface-300 flex items-center justify-around px-2 md:hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
