import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicStatsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Status badges */}
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-2.5 w-24 mt-1.5" />
            </div>
          ))}
        </div>

        {/* Split bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex justify-between mb-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-full rounded-full" />
        </div>

        {/* Velocity chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex justify-between mb-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
          <Skeleton className="h-28 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-300">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-6 w-12 mx-auto mb-1.5" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Role breakdown */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
