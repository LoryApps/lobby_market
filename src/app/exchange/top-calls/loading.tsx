import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="flex gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-28 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-6 w-14 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-3">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
