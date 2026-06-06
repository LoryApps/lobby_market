import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TremorLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Seismograph-style cards */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="text-right space-y-1 flex-shrink-0">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            </div>
            {/* Waveform bar */}
            <div className="flex items-end gap-0.5 h-10">
              {Array.from({ length: 24 }).map((_, j) => (
                <Skeleton
                  key={j}
                  className="flex-1 rounded-sm"
                  style={{ height: `${20 + Math.sin((i + j) * 0.8) * 18}px` }}
                />
              ))}
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
