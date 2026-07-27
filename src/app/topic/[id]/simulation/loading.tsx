import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopicSimulationLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-3/4 rounded" />
          </div>
        </div>
        {/* Consensus bar */}
        <Skeleton className="h-36 w-full rounded-2xl" />
        {/* Controls */}
        <Skeleton className="h-56 w-full rounded-2xl" />
        {/* Outcomes */}
        <Skeleton className="h-48 w-full rounded-2xl" />
        {/* Vote math */}
        <Skeleton className="h-32 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
