import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ScreenerLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Filter panel */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Results table */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="p-4 border-b border-surface-300 flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-surface-300/30">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
