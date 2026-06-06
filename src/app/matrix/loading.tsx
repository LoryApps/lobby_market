import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MatrixLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-4xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full flex-shrink-0 animate-pulse" />
          ))}
        </div>

        {/* 10×10 heatmap grid skeleton */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 mb-5 overflow-auto">
          <div className="min-w-[520px]">
            {/* Column labels */}
            <div className="flex gap-1 mb-1 ml-16">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-5 flex-1 rounded" />
              ))}
            </div>
            {/* Rows */}
            {Array.from({ length: 10 }).map((_, row) => (
              <div key={row} className="flex gap-1 mb-1 items-center">
                <Skeleton className="h-5 w-14 rounded flex-shrink-0 mr-2" />
                {Array.from({ length: 10 }).map((_, col) => (
                  <Skeleton
                    key={col}
                    className="flex-1 aspect-square rounded"
                    style={{ opacity: Math.abs((row - col) % 3) === 0 ? 0.9 : 0.4 + (row + col) * 0.03 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Strongest correlation rows */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3">
          <Skeleton className="h-4 w-36 mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-14 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
