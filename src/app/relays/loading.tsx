import { Skeleton } from '@/components/ui/Skeleton'

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RelaysLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-6" />
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
