import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HeatmapLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* View controls */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
            {Array.from({ length: 40 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 flex-1 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>

        {/* Top performers */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2 py-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
