import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TagGraphLoading() {
  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      <TopBar />

      {/* Graph canvas skeleton */}
      <div className="flex-1 relative overflow-hidden bg-surface-50">
        {/* Simulated graph nodes */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full max-w-3xl">
            {/* Center cluster */}
            <Skeleton className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full" />

            {/* Surrounding nodes - positioned radially */}
            {[
              { top: '20%', left: '30%', size: 10 },
              { top: '15%', left: '55%', size: 8 },
              { top: '25%', left: '70%', size: 12 },
              { top: '45%', left: '80%', size: 9 },
              { top: '65%', left: '72%', size: 11 },
              { top: '75%', left: '55%', size: 7 },
              { top: '72%', left: '35%', size: 10 },
              { top: '60%', left: '20%', size: 9 },
              { top: '40%', left: '15%', size: 13 },
              { top: '20%', left: '22%', size: 8 },
            ].map((node, i) => (
              <Skeleton
                key={i}
                className="absolute rounded-full"
                style={{
                  top: node.top,
                  left: node.left,
                  width: `${node.size * 4}px`,
                  height: `${node.size * 4}px`,
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.4 + (i % 3) * 0.2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Controls overlay skeleton */}
        <div className="absolute top-4 left-4 right-4 flex items-center gap-2">
          <Skeleton className="h-9 flex-1 rounded-xl max-w-xs" />
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Legend skeleton */}
        <div className="absolute bottom-20 right-4 bg-surface-100 border border-surface-300 rounded-xl p-3 space-y-2 md:bottom-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
