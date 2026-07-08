import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GazetteArchiveLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div>
            <Skeleton className="h-7 w-48 mb-1.5" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        {/* Calendar grid header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Skeleton key={i} className="h-5 w-5 mx-auto rounded" />
          ))}
        </div>

        {/* Calendar grid – 5 weeks × 7 days */}
        {Array.from({ length: 5 }).map((_, week) => (
          <div key={week} className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, day) => {
              const hasContent = (week * 7 + day) % 3 !== 0
              return (
                <div
                  key={day}
                  className="aspect-square rounded-lg bg-surface-200 border border-surface-300 flex flex-col items-center justify-center gap-1 p-1"
                >
                  <Skeleton className="h-3.5 w-5 rounded" />
                  {hasContent && <Skeleton className="h-1.5 w-1.5 rounded-full" />}
                </div>
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
