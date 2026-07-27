import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-4">
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" style={{ width: `${90 - i * 12}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap placeholder */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-4">
          <Skeleton className="h-4 w-40 mb-3" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 56 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded-sm" />
            ))}
          </div>
        </div>

        {/* Compass */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-48 w-48 rounded-full mx-auto" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
