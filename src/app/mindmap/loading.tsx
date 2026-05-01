import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MindMapLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      {/* Toolbar skeleton */}
      <div className="border-b border-surface-300 bg-surface-100/80">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <Skeleton className="h-5 w-36" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Legend strip */}
      <div className="border-b border-surface-300 bg-surface-100/50">
        <div className="max-w-[1400px] mx-auto px-4 h-10 flex items-center gap-4">
          {[
            { w: 'w-16', dot: 'bg-for-500' },
            { w: 'w-12', dot: 'bg-gold' },
            { w: 'w-20', dot: 'bg-purple' },
            { w: 'w-14', dot: 'bg-against-500' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${item.dot} opacity-60`} />
              <Skeleton className={`h-3 ${item.w}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Graph canvas placeholder */}
      <div className="flex-1 relative overflow-hidden bg-surface-50">
        {/* Simulated node cluster — decorative */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full max-w-2xl h-96">
            {/* Central hub node */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Skeleton className="h-14 w-14 rounded-full" />
            </div>
            {/* Orbiting nodes — decorative positions */}
            {[
              { top: '10%',  left: '20%',  size: 'h-9 w-9' },
              { top: '15%',  left: '60%',  size: 'h-11 w-11' },
              { top: '20%',  left: '80%',  size: 'h-8 w-8' },
              { top: '45%',  left: '10%',  size: 'h-10 w-10' },
              { top: '40%',  left: '75%',  size: 'h-9 w-9' },
              { top: '70%',  left: '25%',  size: 'h-11 w-11' },
              { top: '65%',  left: '65%',  size: 'h-8 w-8' },
              { top: '80%',  left: '50%',  size: 'h-9 w-9' },
              { top: '55%',  left: '40%',  size: 'h-7 w-7' },
              { top: '30%',  left: '35%',  size: 'h-8 w-8' },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute"
                style={{ top: pos.top, left: pos.left }}
              >
                <Skeleton className={`${pos.size} rounded-full opacity-60`} />
              </div>
            ))}
          </div>
        </div>

        {/* Loading label overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Zoom controls skeleton */}
      <div className="absolute bottom-24 right-4 md:bottom-8 flex flex-col gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      <BottomNav />
    </div>
  )
}
