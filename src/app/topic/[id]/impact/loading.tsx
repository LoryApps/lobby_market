import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicImpactLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        {/* Split bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
          <Skeleton className="h-4 w-36 mb-2" />
          <Skeleton className="h-5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
        {/* Grade distribution */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-2">
          <Skeleton className="h-4 w-40 mb-3" />
          <div className="flex items-end gap-2 h-16">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${[90, 60, 40, 20, 10][i]}%` }} />
            ))}
          </div>
        </div>
        {/* Top arguments */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full max-w-xs" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-5 w-8 rounded-full flex-shrink-0" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
