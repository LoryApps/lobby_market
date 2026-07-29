import { Skeleton } from '@/components/ui/Skeleton'

function TreatyCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-4 text-surface-500" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  )
}

export default function CoalitionTreatiesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-44" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-surface-200/80 border border-surface-300 rounded-xl p-1 mb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <TreatyCardSkeleton key={i} />
        ))}
      </main>
    </div>
  )
}
