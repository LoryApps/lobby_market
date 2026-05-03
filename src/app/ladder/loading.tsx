import { Skeleton } from '@/components/ui/Skeleton'

export default function LadderLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <div className="mb-6 space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1.5">
              {[64, 80, 80].map((w, i) => (
                <Skeleton key={i} className={`h-7 w-${w === 64 ? '16' : '20'} rounded-lg`} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1.5">
              {[48, 56, 72].map((_, i) => (
                <Skeleton key={i} className="h-7 w-16 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="hidden sm:flex gap-4">
                  <div className="space-y-1 text-right">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-2 w-12" />
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
