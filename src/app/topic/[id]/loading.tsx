import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back button */}
        <div className="mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        {/* Topic card skeleton */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-4 space-y-4">
          {/* Status + category row */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          {/* Statement */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-5/6" />
            <Skeleton className="h-7 w-3/4" />
          </div>

          {/* Author row */}
          <div className="flex items-center gap-2 mt-1">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>

          {/* Vote bar */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>

          {/* Vote buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>

        {/* Wiki section skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Chains / related skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
