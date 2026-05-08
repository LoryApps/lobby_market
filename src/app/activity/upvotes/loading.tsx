import { Skeleton } from '@/components/ui/Skeleton'

export default function UpvotesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-24 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-3.5 w-40 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          {[80, 90, 70, 80, 110].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-3.5 w-14 rounded" />
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
