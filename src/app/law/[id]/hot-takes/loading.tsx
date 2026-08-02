import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <div className="max-w-2xl mx-auto px-4 pt-6 w-full">
        {/* Header skeleton */}
        <div className="flex items-start gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
        </div>

        {/* Split bar skeleton */}
        <div className="mb-5 rounded-xl border border-surface-300/40 px-4 py-3 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>

        {/* Filter row skeleton */}
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>

        {/* Cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-surface-300/30 bg-surface-200/30 p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
