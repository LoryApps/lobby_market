import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function UnderratedLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 pb-24 pt-4 md:pt-8">
        <div className="mx-auto max-w-3xl px-4 space-y-8">
          <div className="text-center space-y-4 py-6">
            <Skeleton className="h-12 w-12 rounded-2xl mx-auto" />
            <Skeleton className="h-9 w-48 mx-auto" />
            <Skeleton className="h-4 w-80 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="space-y-3">
            {[3, 4, 3].map((count, row) => (
              <div key={row} className="flex gap-2 flex-wrap">
                {Array.from({ length: count }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-24 rounded-full" />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
                <div className="rounded-xl border border-surface-300/30 p-3 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
