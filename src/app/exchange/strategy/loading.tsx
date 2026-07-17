import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function StrategyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        {/* Strategy selector */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-4">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
          ))}
        </div>
        {/* Signals */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-14 ml-auto rounded" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-9 rounded" />
                <Skeleton className="h-9 rounded" />
                <Skeleton className="h-9 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
