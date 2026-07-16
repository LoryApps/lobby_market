import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TradesLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-200 p-3">
              <Skeleton className="h-6 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <Skeleton className="h-10 w-full rounded-xl mb-5" />

        {/* Trade rows */}
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-200 p-3"
            >
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-10 rounded-full" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2 mt-1">
                  <Skeleton className="h-1.5 w-24 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
