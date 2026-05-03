import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ConnectionsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-3 w-64 rounded" />
          </div>
        </div>

        {/* 4x4 word grid */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Attempts */}
        <div className="flex items-center gap-2 justify-center">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-3 rounded-full" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
