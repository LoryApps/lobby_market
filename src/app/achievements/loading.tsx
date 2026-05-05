import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function AchievementsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        {/* Tier stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2 animate-pulse">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Branch mastery */}
        <div className="mb-6">
          <Skeleton className="h-3 w-36 mb-3" />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-surface-300 bg-surface-100 animate-pulse">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-0.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Tier filter pills */}
        <div className="flex gap-2 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Branch filter pills */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl border border-surface-300 bg-surface-100 p-4 animate-pulse">
              <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
