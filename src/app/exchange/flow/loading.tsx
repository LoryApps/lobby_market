import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function FlowLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Flow chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>

        {/* Flow metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Top movers by flow */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-surface-300/30">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
