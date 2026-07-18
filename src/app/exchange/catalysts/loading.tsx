import { Skeleton } from '@/components/ui/Skeleton'

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
        <div className="flex-shrink-0 space-y-1">
          <Skeleton className="h-4 w-12 ml-auto" />
          <Skeleton className="h-3 w-10 ml-auto" />
          <Skeleton className="h-3 w-8 ml-auto" />
        </div>
      </div>
    </div>
  )
}

export default function CatalystsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>

        {/* Window + kind filter rows */}
        <div className="flex gap-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-14 rounded-lg" />)}
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <Skeleton className="h-6 w-12 mx-auto mb-1" />
              <Skeleton className="h-2.5 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </main>
    </div>
  )
}
