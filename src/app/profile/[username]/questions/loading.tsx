import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <div className="h-14 border-b border-surface-300 bg-surface-0" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
        {/* Back link */}
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-12 h-12 rounded-2xl flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-1.5" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <Skeleton className="h-2.5 w-16 mb-2" />
              <Skeleton className="h-7 w-12 mb-1.5" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))}
        </div>

        {/* Expertise badges placeholder */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
          <Skeleton className="h-2.5 w-32 mb-3" />
          <div className="flex gap-2 flex-wrap">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Questions section */}
        <div className="mb-8">
          <Skeleton className="h-2.5 w-32 mb-3" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300/60 bg-surface-100/50 p-4 flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <SkeletonText lines={2} className="mb-2" />
                  <Skeleton className="h-2.5 w-3/4 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-10 rounded" />
                  </div>
                </div>
                <Skeleton className="h-3 w-12 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Answers section */}
        <div>
          <Skeleton className="h-2.5 w-28 mb-3" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300/60 bg-surface-100/50 p-4 flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <SkeletonText lines={2} className="mb-2" />
                  <Skeleton className="h-2.5 w-2/3 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                </div>
                <Skeleton className="h-3 w-12 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
