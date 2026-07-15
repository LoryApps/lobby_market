import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function EmergencyDebatesLoading() {
  return (
    <div className="min-h-screen bg-surface-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-3 text-center space-y-1">
              <Skeleton className="h-6 w-12 rounded mx-auto" />
              <Skeleton className="h-3 w-16 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Debate cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <SkeletonText lines={2} className="flex-1" />
                <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
