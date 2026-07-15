import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function ForYouLoading() {
  return (
    <div className="min-h-screen bg-surface-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-950 border-b border-surface-800 px-4 py-3">
        <Skeleton className="h-7 w-40 rounded" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-8">
        {/* Topics to Vote On */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-36 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4">
                <SkeletonText lines={2} className="mb-3" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* People to Follow */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-3 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>

        {/* Coalitions */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-36 rounded" />
          </div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Debates */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-36 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4">
                <Skeleton className="h-4 w-48 rounded mb-2" />
                <SkeletonText lines={1} className="mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
