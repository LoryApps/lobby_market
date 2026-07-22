import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MarketVolatilityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="rounded-2xl border border-surface-300 bg-surface-200 p-5 flex items-center gap-6">
            <Skeleton className="h-32 w-32 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3">
                <Skeleton className="h-3 w-8" />
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="space-y-1">
                      <Skeleton className="h-2 w-12" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
