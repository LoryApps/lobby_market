import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TodayLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {/* Date header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-56" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-2 animate-pulse"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </div>

        {/* Hot topic */}
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-4 mb-5 animate-pulse">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {/* Top argument */}
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-3 mb-5 animate-pulse">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Recent law */}
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-3 animate-pulse">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
