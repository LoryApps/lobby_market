import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function InfluenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-7 w-36" />
            </div>
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        {/* Stats grid — 4 cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300"
            >
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Category breakdown pills */}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>

        {/* Graph area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          {/* Graph toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>

          {/* Graph canvas placeholder */}
          <div className="relative h-64 sm:h-80 md:h-96 flex items-center justify-center">
            {/* Simulated node cloud */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="relative w-48 h-48">
                {Array.from({ length: 8 }).map((_, i) => {
                  const angle = (i / 8) * Math.PI * 2
                  const r = 60 + (i % 3) * 20
                  const x = 96 + r * Math.cos(angle)
                  const y = 96 + r * Math.sin(angle)
                  return (
                    <Skeleton
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: 10 + (i % 3) * 6,
                        height: 10 + (i % 3) * 6,
                        left: x,
                        top: y,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  )
                })}
                <Skeleton className="absolute rounded-full" style={{ width: 32, height: 32, left: 96, top: 96, transform: 'translate(-50%,-50%)' }} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 z-10">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </div>

        {/* Topic list rows */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
