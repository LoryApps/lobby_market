import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TradersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>

        {/* Trader list */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
