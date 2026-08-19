import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CartographyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-5 flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
          <div className="ml-auto">
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>

        {/* Scatter plot canvas */}
        <div className="relative rounded-2xl bg-surface-100 border border-surface-300/60 overflow-hidden" style={{ height: '420px' }}>
          {/* Axis labels */}
          <Skeleton className="absolute bottom-4 left-1/2 -translate-x-1/2 h-3 w-28" />
          <Skeleton className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-20" style={{ transform: 'rotate(-90deg) translateX(-50%)' }} />

          {/* Simulated scatter dots */}
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${8 + (i % 4) * 5}px`,
                height: `${8 + (i % 4) * 5}px`,
                left: `${10 + (i * 37 + i * i * 3) % 78}%`,
                top: `${10 + (i * 41 + i * i * 5) % 78}%`,
              }}
            />
          ))}

          {/* Quadrant labels */}
          <Skeleton className="absolute top-4 left-4 h-4 w-24 rounded" />
          <Skeleton className="absolute top-4 right-4 h-4 w-20 rounded" />
          <Skeleton className="absolute bottom-10 left-4 h-4 w-20 rounded" />
          <Skeleton className="absolute bottom-10 right-4 h-4 w-24 rounded" />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full shrink-0" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
