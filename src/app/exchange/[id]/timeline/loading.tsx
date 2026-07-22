import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Timeline entries */}
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-surface-300">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="absolute left-0 w-4 h-4 rounded-full bg-surface-300 flex-shrink-0" style={{ marginTop: 16 }} />
              <div className="ml-4 flex-1 rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
