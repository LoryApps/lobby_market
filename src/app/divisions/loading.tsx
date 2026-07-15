import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function DivisionsLoading() {
  return (
    <div className="min-h-screen bg-surface-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-4 w-56 rounded" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-3 text-center space-y-1">
              <Skeleton className="h-6 w-10 rounded mx-auto" />
              <Skeleton className="h-3 w-14 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Division cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <SkeletonText lines={2} className="flex-1" />
                <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
              </div>
              {/* Aye / No bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
