import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SteelmanLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="space-y-6">
          {/* Market header */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-5 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-5/6 mb-4" />
            <Skeleton className="h-2.5 w-full rounded-full mb-2" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 rounded-lg" />
            ))}
          </div>
          {/* Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[0, 1].map((col) => (
              <div key={col} className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
