import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function SurgeSkeletonSection() {
  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-surface-300/60 bg-surface-100/50 p-4 space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full mt-2" />
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SurgeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Page header skeleton */}
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        <SurgeSkeletonSection />
        <SurgeSkeletonSection />
        <SurgeSkeletonSection />
      </main>
      <BottomNav />
    </div>
  )
}
