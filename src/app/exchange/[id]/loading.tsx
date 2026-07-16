import { Skeleton } from '@/components/ui/Skeleton'

export default function ExchangeMarketLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3 flex-shrink-0">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 space-y-5">
        {/* Back + watch */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>

        {/* Market header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6 space-y-5">
          {/* Status + category badges */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>

          {/* Statement */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-5/6" />
            <Skeleton className="h-7 w-2/3" />
          </div>

          {/* Price block */}
          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="space-y-2">
              <Skeleton className="h-14 w-36 rounded-xl" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-16 w-48 rounded-xl" />
          </div>

          {/* Vote bar */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-200 p-3 space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Price chart card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-7 w-12 rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>

        {/* Tab strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 flex-shrink-0 rounded-lg" />
          ))}
        </div>

        {/* Argument list */}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-10 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
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
