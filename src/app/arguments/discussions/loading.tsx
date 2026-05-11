import { Skeleton } from '@/components/ui/Skeleton'

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full ml-auto" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
    </div>
  )
}

export default function ArgumentDiscussionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100" />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-12">
        <div className="mb-6 flex items-start gap-4">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0 mt-1" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-32 rounded-lg" />)}
        </div>
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      </main>
    </div>
  )
}
