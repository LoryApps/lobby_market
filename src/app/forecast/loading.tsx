import { Skeleton } from '@/components/ui/Skeleton'

export default function ForecastLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>

        {/* Calibration chart */}
        <Skeleton className="h-12 rounded-xl mb-5" />

        {/* Topic cards */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
              <div className="px-4 pt-4 pb-3 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="px-4 pb-3">
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="border-t border-surface-300 px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-14 flex-shrink-0 rounded" />
                  <Skeleton className="h-2 flex-1 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                </div>
                <Skeleton className="h-7 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
