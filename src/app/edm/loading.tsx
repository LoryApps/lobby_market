import { Skeleton } from '@/components/ui/Skeleton'

function EDMCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  )
}

export default function EDMLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300 flex items-center px-4 justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => <EDMCardSkeleton key={i} />)}
      </main>
    </div>
  )
}
