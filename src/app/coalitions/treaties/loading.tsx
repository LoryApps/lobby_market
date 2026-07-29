import { Skeleton } from '@/components/ui/Skeleton'

function TreatyRowSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-4 mx-1" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24 ml-auto" />
      </div>
    </div>
  )
}

export default function TreatiesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-surface-200/80 border border-surface-300 rounded-xl p-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <TreatyRowSkeleton key={i} />
        ))}
      </main>
    </div>
  )
}
