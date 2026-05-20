import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MomentumLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-7 w-12 rounded" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <Skeleton className="h-4 w-40 rounded mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="flex justify-between mt-3">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
