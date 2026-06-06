import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function OvertonsWindowLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['All', 'Politics', 'Economics', 'Tech', 'Science', 'Ethics'].map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Overton Window zones */}
        {[
          { w: 'w-4/5', h: 'h-14' },
          { w: 'w-full', h: 'h-20' },
          { w: 'w-full', h: 'h-32' }, // main window (wider)
          { w: 'w-full', h: 'h-20' },
          { w: 'w-4/5', h: 'h-14' },
        ].map((zone, i) => (
          <div key={i} className="mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
            <Skeleton className={`${zone.h} ${zone.w} mx-auto rounded-xl`} />
            {/* Topic items within zone */}
            {i === 2 && (
              <div className="space-y-2 mt-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
