import { Skeleton } from '@/components/ui/Skeleton'

function TopicCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      {/* Status + category row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Statement */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </div>

      {/* Vote bar */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Author + vote buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function FeedLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Ticker skeleton */}
      <div className="h-8 border-b border-surface-300 bg-surface-100/50 flex items-center px-4 gap-3 flex-shrink-0">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>

      {/* Feed cards */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-24">
          {/* Filter pills skeleton */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
            ))}
          </div>

          {/* Topic cards */}
          {[0, 1, 2, 3].map((i) => (
            <TopicCardSkeleton key={i} />
          ))}
        </div>
      </main>

      {/* BottomNav skeleton */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface-100 border-t border-surface-300 flex items-center justify-around px-2 md:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
