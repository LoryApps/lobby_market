import { GitFork } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SplitLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Split bar accent */}
        <div className="flex h-0.5 w-full mb-5 rounded-full overflow-hidden">
          <div className="flex-1 bg-against-500/50" />
          <div className="flex-1 bg-for-500/50" />
        </div>

        {/* Header skeleton */}
        <div className="mb-7">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
              <GitFork className="h-5 w-5 text-surface-600" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>

        {/* Filter row skeleton */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>

        {/* Card skeletons */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-surface-100 border border-surface-300 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-6 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
