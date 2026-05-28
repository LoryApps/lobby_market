import { Skeleton } from '@/components/ui/Skeleton'

export default function VortexLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <Skeleton className="h-6 w-44 rounded" />
          </div>
          <Skeleton className="h-4 w-3/4 rounded ml-9 mt-2" />
          <Skeleton className="h-3 w-24 rounded ml-9 mt-1" />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-100/40 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-7 h-4 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-14 rounded" />
                  </div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-10 rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
